const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pty = require('node-pty');
const { autoUpdater } = require('electron-updater');

const USER_DATA = () => app.getPath('userData');
const SNIPPETS_FILE = () => path.join(USER_DATA(), 'snippets.json');
const HISTORY_FILE = () => path.join(USER_DATA(), 'history.json');
const SETTINGS_FILE = () => path.join(USER_DATA(), 'settings.json');
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

app.whenReady().then(() => {
  restoreThemeSource();
  createWindow();
  mainWindow.once('ready-to-show', runUpdateCheck);
});

ipcMain.handle('theme:set', (event, source) => {
  if (source !== 'light' && source !== 'dark' && source !== 'system') return;
  nativeTheme.themeSource = source;
  writeJson(SETTINGS_FILE(), { ...readJson(SETTINGS_FILE(), {}), themeSource: source });
});

ipcMain.handle('accent:get', () => readJson(SETTINGS_FILE(), {}).accentHue);

ipcMain.handle('accent:set', (event, hue) => {
  if (typeof hue !== 'number' || Number.isNaN(hue)) return;
  writeJson(SETTINGS_FILE(), { ...readJson(SETTINGS_FILE(), {}), accentHue: hue });
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
