const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const pty = require('node-pty');
const { autoUpdater } = require('electron-updater');

const USER_DATA = () => app.getPath('userData');
const SNIPPETS_FILE = () => path.join(USER_DATA(), 'snippets.json');
const HISTORY_FILE = () => path.join(USER_DATA(), 'history.json');
const SETTINGS_FILE = () => path.join(USER_DATA(), 'settings.json');
const CREDENTIALS_FILE = () => path.join(USER_DATA(), 'credentials.json');
const HISTORY_LIMIT = 5000;

let mainWindow = null;
const ptyProcesses = new Map(); // tabId -> pty process

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 560,
    minHeight: 360,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0b10' : '#fafafc',
    frame: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', { maximized: false }));

  // Never navigate away from the app shell; open external links in the
  // user's default browser instead of inside the terminal window.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function restoreThemeSource() {
  const settings = readJson(SETTINGS_FILE(), {});
  if (settings.themeSource === 'light' || settings.themeSource === 'dark') {
    nativeTheme.themeSource = settings.themeSource;
  }
  // Otherwise leave the default 'system', which follows the desktop theme.
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function sendUpdateState(state, extra) {
  if (mainWindow) mainWindow.webContents.send('update:state', { state, ...extra });
}

autoUpdater.on('update-available', (info) => sendUpdateState('available', { version: info.version }));
autoUpdater.on('update-not-available', () => sendUpdateState('not-available'));
autoUpdater.on('error', (err) => sendUpdateState('error', { message: err == null ? 'Unknown error' : err.message }));
autoUpdater.on('download-progress', (progress) => sendUpdateState('downloading', { percent: progress.percent }));
autoUpdater.on('update-downloaded', (info) => sendUpdateState('downloaded', { version: info.version }));

function runUpdateCheck() {
  sendUpdateState('checking');
  if (!app.isPackaged) {
    sendUpdateState('not-available');
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => sendUpdateState('error', { message: err.message }));
}

ipcMain.handle('update:check', () => runUpdateCheck());

ipcMain.handle('update:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    sendUpdateState('error', { message: err.message });
  }
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall();
});

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

app.whenReady().then(() => {
  restoreThemeSource();
  createWindow();
  mainWindow.once('ready-to-show', runUpdateCheck);
  setInterval(runUpdateCheck, UPDATE_CHECK_INTERVAL_MS);
});

ipcMain.handle('theme:set', (event, source) => {
  if (source !== 'light' && source !== 'dark' && source !== 'system') return;
  nativeTheme.themeSource = source;
  writeJson(SETTINGS_FILE(), { ...readJson(SETTINGS_FILE(), {}), themeSource: source });
});

ipcMain.handle('theme:get', () => readJson(SETTINGS_FILE(), {}).themeSource || 'system');

ipcMain.handle('accent:get', () => readJson(SETTINGS_FILE(), {}).accentHue);

ipcMain.handle('accent:set', (event, hue) => {
  if (typeof hue !== 'number' || Number.isNaN(hue)) return;
  writeJson(SETTINGS_FILE(), { ...readJson(SETTINGS_FILE(), {}), accentHue: hue });
});

// Passwords are encrypted at rest via the OS keyring (safeStorage) and are
// never sent back to the renderer once saved — only a name, never the
// plaintext or ciphertext. "Typing" one decrypts it in this process only
// and writes it straight to the pty; the decrypted value never crosses
// back over IPC.
//
// Encryption at rest alone doesn't stop someone else who's simply sitting
// at this already-unlocked computer from using a saved password, so every
// credentials:* call below is also gated behind a separate vault PIN that
// auto-locks after a few minutes idle.
const VAULT_IDLE_MS = 5 * 60 * 1000;
let vaultUnlockedUntil = 0;

function readCredentialsFile() {
  return readJson(CREDENTIALS_FILE(), { pin: null, entries: [] });
}
function writeCredentialsFile(data) {
  writeJson(CREDENTIALS_FILE(), data);
}
function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString('hex');
}
function isVaultUnlocked() {
  return Date.now() < vaultUnlockedUntil;
}
function touchVaultActivity() {
  vaultUnlockedUntil = Date.now() + VAULT_IDLE_MS;
}
function sendVaultState() {
  if (mainWindow) mainWindow.webContents.send('vault:state', { unlocked: isVaultUnlocked() });
}

setInterval(() => {
  if (vaultUnlockedUntil !== 0 && !isVaultUnlocked()) {
    vaultUnlockedUntil = 0;
    sendVaultState();
  }
}, 15000);

ipcMain.handle('vault:status', () => {
  return { hasPin: !!readCredentialsFile().pin, unlocked: isVaultUnlocked() };
});

ipcMain.handle('vault:setPin', (event, pin) => {
  if (!pin || pin.length < 4) return { error: 'invalid' };
  const data = readCredentialsFile();
  if (data.pin) return { error: 'exists' };
  const salt = crypto.randomBytes(16).toString('hex');
  data.pin = { salt, hash: hashPin(pin, salt) };
  writeCredentialsFile(data);
  touchVaultActivity();
  sendVaultState();
  return { ok: true };
});

ipcMain.handle('vault:unlock', (event, pin) => {
  const data = readCredentialsFile();
  if (!data.pin) return { error: 'no-pin' };
  const ok = hashPin(pin, data.pin.salt) === data.pin.hash;
  if (ok) {
    touchVaultActivity();
    sendVaultState();
  }
  return { ok };
});

ipcMain.handle('vault:lock', () => {
  vaultUnlockedUntil = 0;
  sendVaultState();
  return { ok: true };
});

ipcMain.handle('credentials:list', () => {
  if (!isVaultUnlocked()) return { locked: true };
  touchVaultActivity();
  return { entries: readCredentialsFile().entries.map(({ id, name }) => ({ id, name })) };
});

ipcMain.handle('credentials:add', (event, { name, password }) => {
  if (!isVaultUnlocked()) return { error: 'locked' };
  if (!name || !password) return { error: 'invalid' };
  if (!safeStorage.isEncryptionAvailable()) return { error: 'unavailable' };
  const encrypted = safeStorage.encryptString(password).toString('base64');
  const data = readCredentialsFile();
  const entry = { id: crypto.randomUUID(), name, encrypted };
  data.entries.push(entry);
  writeCredentialsFile(data);
  touchVaultActivity();
  return { id: entry.id, name: entry.name };
});

ipcMain.handle('credentials:delete', (event, id) => {
  if (!isVaultUnlocked()) return { error: 'locked' };
  const data = readCredentialsFile();
  data.entries = data.entries.filter((c) => c.id !== id);
  writeCredentialsFile(data);
  touchVaultActivity();
});

ipcMain.handle('credentials:type', (event, { id, tabId }) => {
  if (!isVaultUnlocked()) return { ok: false, error: 'locked' };
  const entry = readCredentialsFile().entries.find((c) => c.id === id);
  const proc = ptyProcesses.get(tabId);
  if (!entry || !proc) return { ok: false };
  let password = safeStorage.decryptString(Buffer.from(entry.encrypted, 'base64'));
  proc.write(password + '\r');
  password = null;
  touchVaultActivity();
  return { ok: true };
});

ipcMain.handle('app:reset', async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Delete Everything'],
    defaultId: 0,
    cancelId: 0,
    title: 'Reset all data',
    message: 'Delete all snippets, command history, saved passwords, and settings?',
    detail: 'This cannot be undone. Fetch Terminal will restart with a clean slate.',
  });
  if (response !== 1) return { cancelled: true };
  for (const file of [SNIPPETS_FILE(), HISTORY_FILE(), SETTINGS_FILE(), CREDENTIALS_FILE()]) {
    try { fs.unlinkSync(file); } catch (err) { /* already gone */ }
  }
  app.relaunch();
  app.exit(0);
});

app.on('window-all-closed', () => {
  for (const proc of ptyProcesses.values()) {
    try { proc.kill(); } catch (err) { /* already gone */ }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------- Window controls ----------

ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:maximize-toggle', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow && mainWindow.close());
ipcMain.handle('window:is-maximized', () => (mainWindow ? mainWindow.isMaximized() : false));

// ---------- PTY management ----------

function shellCommand() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe';
  return process.env.SHELL || '/bin/bash';
}

ipcMain.on('pty:spawn', (event, { tabId, cols, rows, cwd }) => {
  if (ptyProcesses.has(tabId)) return;
  const proc = pty.spawn(shellCommand(), [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: process.env,
  });

  ptyProcesses.set(tabId, proc);

  proc.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:data', { tabId, data });
    }
  });

  proc.onExit(({ exitCode }) => {
    ptyProcesses.delete(tabId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:exit', { tabId, exitCode });
    }
  });
});

ipcMain.on('pty:write', (event, { tabId, data }) => {
  const proc = ptyProcesses.get(tabId);
  if (proc) proc.write(data);
});

ipcMain.on('pty:resize', (event, { tabId, cols, rows }) => {
  const proc = ptyProcesses.get(tabId);
  if (proc && cols > 0 && rows > 0) {
    try { proc.resize(cols, rows); } catch (err) { /* ignore transient resize errors */ }
  }
});

ipcMain.on('pty:kill', (event, { tabId }) => {
  const proc = ptyProcesses.get(tabId);
  if (proc) {
    try { proc.kill(); } catch (err) { /* already gone */ }
    ptyProcesses.delete(tabId);
  }
});

// ---------- Snippets ----------

ipcMain.handle('snippets:load', () => readJson(SNIPPETS_FILE(), []));

ipcMain.handle('snippets:save', (event, snippets) => {
  writeJson(SNIPPETS_FILE(), snippets);
  return true;
});

function snippetsToMarkdown(snippets) {
  const lines = ['# Fetch Terminal Snippets', ''];
  for (const snippet of snippets) {
    if (snippet.name && snippet.name.trim()) {
      lines.push(`## ${snippet.name.trim()}`);
    }
    lines.push('```sh');
    lines.push(snippet.command);
    lines.push('```', '');
  }
  return lines.join('\n');
}

function markdownToSnippets(markdown) {
  const lines = markdown.split(/\r?\n/);
  const snippets = [];
  let pendingName = null;
  let inFence = false;
  let fenceLines = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,6}\s+(.*\S)\s*$/);
    const fenceMatch = line.match(/^```(\w*)\s*$/);

    if (!inFence && fenceMatch) {
      inFence = true;
      fenceLines = [];
      continue;
    }
    if (inFence && fenceMatch) {
      inFence = false;
      const command = fenceLines.join('\n').trim();
      if (command) {
        snippets.push({
          id: `${Date.now()}-${snippets.length}-${Math.floor(Math.random() * 1e6)}`,
          name: pendingName,
          command,
        });
      }
      pendingName = null;
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }
    if (headingMatch) {
      pendingName = headingMatch[1];
      continue;
    }
    if (line.trim() === '') continue;
    // A bare line outside of a fence and not a heading: ignore (e.g. the title).
  }

  return snippets;
}

ipcMain.handle('snippets:export', async (event, snippets) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Snippets',
    defaultPath: 'fetch-terminal-snippets.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  fs.writeFileSync(result.filePath, snippetsToMarkdown(snippets), 'utf8');
  return { ok: true, path: result.filePath };
});

ipcMain.handle('snippets:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Snippets',
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
  });
  if (result.canceled || !result.filePaths.length) return { ok: false };
  const markdown = fs.readFileSync(result.filePaths[0], 'utf8');
  return { ok: true, snippets: markdownToSnippets(markdown) };
});

// ---------- Command history ----------

ipcMain.handle('history:load', () => readJson(HISTORY_FILE(), []));

ipcMain.handle('history:add', (event, command) => {
  if (!command || !command.trim()) return readJson(HISTORY_FILE(), []);
  const history = readJson(HISTORY_FILE(), []);
  const trimmed = command.trim();
  // Skip consecutive duplicates so the list doesn't fill up with repeats.
  if (history.length && history[history.length - 1].command === trimmed) {
    return history;
  }
  history.push({ command: trimmed, timestamp: Date.now() });
  while (history.length > HISTORY_LIMIT) history.shift();
  writeJson(HISTORY_FILE(), history);
  return history;
});

ipcMain.handle('history:clear', () => {
  writeJson(HISTORY_FILE(), []);
  return [];
});
