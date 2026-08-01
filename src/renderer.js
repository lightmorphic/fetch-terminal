const { ipcRenderer, shell, clipboard } = require('electron');
const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');
const { WebLinksAddon } = require('@xterm/addon-web-links');
const { icon } = require('./icons');
const { version: APP_VERSION } = require('../package.json');

const DARK_TERMINAL_THEME = {
  background: '#0b0b10',
  foreground: '#ecebf5',
  cursor: '#8b7cff',
  cursorAccent: '#0b0b10',
  selectionBackground: 'rgba(139, 124, 255, 0.28)',
  black: '#201e31',
  red: '#f2b8b5',
  green: '#b7dda8',
  yellow: '#f0debe',
  blue: '#8fb8ff',
  magenta: '#c792ea',
  cyan: '#34e7d3',
  white: '#ecebf5',
  brightBlack: '#57546a',
  brightRed: '#ffb4ab',
  brightGreen: '#c9f0bb',
  brightYellow: '#ffe8c7',
  brightBlue: '#b9d4ff',
  brightMagenta: '#e0c2ff',
  brightCyan: '#7ff5e6',
  brightWhite: '#ffffff',
};

const LIGHT_TERMINAL_THEME = {
  background: '#fafafc',
  foreground: '#18171f',
  cursor: '#6a5aef',
  cursorAccent: '#fafafc',
  selectionBackground: 'rgba(106, 90, 239, 0.2)',
  black: '#e5e4ec',
  red: '#b3261e',
  green: '#2e6b3e',
  yellow: '#8a6a00',
  blue: '#2457c5',
  magenta: '#7a3ea1',
  cyan: '#0aa899',
  white: '#18171f',
  brightBlack: '#8f8da0',
  brightRed: '#d3372f',
  brightGreen: '#3e8a52',
  brightYellow: '#a6822a',
  brightBlue: '#3f6fe0',
  brightMagenta: '#9457c2',
  brightCyan: '#0ec2b0',
  brightWhite: '#000000',
};

const THEME_MEDIA = window.matchMedia('(prefers-color-scheme: dark)');
function isDarkMode() {
  return THEME_MEDIA.matches;
}
// Most Linux distros' default shell prompt (`user@host`) is colored via the
// ANSI "green"/"bright green" slot, so we tint that slot with the accent hue
// too — the prompt then visually matches the rest of the app's accent color.
function currentTerminalTheme() {
  const base = isDarkMode() ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME;
  const hue = typeof currentAccentHue === 'number' ? currentAccentHue : DEFAULT_ACCENT_HUE;
  return {
    ...base,
    cursor: isDarkMode() ? hsl(hue, 85, 78) : hsl(hue, 55, 42),
    selectionBackground: isDarkMode() ? hsla(hue, 85, 78, 0.28) : hsla(hue, 55, 42, 0.2),
    green: isDarkMode() ? hsl(hue, 70, 72) : hsl(hue, 60, 38),
    brightGreen: isDarkMode() ? hsl(hue, 75, 80) : hsl(hue, 65, 46),
  };
}

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let history = [];
let snippets = [];
let sidebarPinned = true;
let sidebarCollapsed = false;
let editingSnippetId = null;
let toastTimer = null;

// ---------- Helpers ----------

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCellSize(term) {
  try {
    const dims = term._core._renderService.dimensions.css.cell;
    if (dims && dims.width && dims.height) return { width: dims.width, height: dims.height };
  } catch (err) {
    /* fall through to the estimate below */
  }
  const fontSize = (term.options && term.options.fontSize) || 14;
  return { width: fontSize * 0.6, height: fontSize * 1.2 };
}

function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('visible'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.classList.add('hidden'), 220);
  }, 2600);
}

function looksLikeSsh(command) {
  return /^\s*ssh\b/i.test(command);
}

// ---------- Tabs & terminals ----------

// A terminal selection is usually historical output that's already been
// processed by the shell — there's no way to "delete" that after the
// fact. But if the selected text is exactly what's sitting at the end of
// the current, not-yet-submitted input line (which we already track for
// autocomplete), it really can be removed: back it out with backspaces.
// Anything else — historical output, mid-line text, multi-line selections
// — falls back to copy-only, rather than risk sending backspaces
// somewhere they don't belong.
function removeFromInputLine(tab, text) {
  if (!text || !tab.inputBuffer.endsWith(text)) return;
  ipcRenderer.send('pty:write', { tabId: tab.id, data: '\x7f'.repeat(text.length) });
  tab.inputBuffer = tab.inputBuffer.slice(0, -text.length);
  refreshSuggestion(tab);
}

function copySelection(tab) {
  const term = tab.term;
  if (!term.hasSelection()) return;
  clipboard.writeText(term.getSelection());
  term.clearSelection();
}

function cutSelection(tab) {
  const term = tab.term;
  if (!term.hasSelection()) return;
  const selected = term.getSelection();
  clipboard.writeText(selected);
  term.clearSelection();
  removeFromInputLine(tab, selected);
}

function pasteIntoTerminal(tab) {
  const text = clipboard.readText();
  if (!text) return;
  const outgoing = processUserInput(tab, text);
  if (outgoing) ipcRenderer.send('pty:write', { tabId: tab.id, data: outgoing });
}

const MAX_TABS = 4;

function createTab() {
  if (tabs.length >= MAX_TABS) {
    showToast(`Maximum of ${MAX_TABS} tabs open at once`);
    return null;
  }
  const id = genId('tab');
  const pane = document.createElement('div');
  pane.className = 'terminal-pane';

  const ghost = document.createElement('div');
  ghost.className = 'autocomplete-ghost';
  pane.appendChild(ghost);

  document.getElementById('terminals').appendChild(pane);

  const term = new Terminal({
    fontFamily: "'Geist Mono', 'Roboto Mono', 'DejaVu Sans Mono', monospace",
    fontSize: 14,
    lineHeight: 1.15,
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 8000,
    theme: currentTerminalTheme(),
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon((_event, uri) => shell.openExternal(uri)));

  term.open(pane);
  fitAddon.fit();

  const tab = {
    id,
    term,
    fitAddon,
    pane,
    ghostEl: ghost,
    inputBuffer: '',
    suggestion: null,
    title: 'Shell',
  };
  tabs.push(tab);

  term.onData((data) => {
    if (!sidebarPinned && !sidebarCollapsed) setSidebarCollapsed(true);
    const outgoing = processUserInput(tab, data);
    if (outgoing) ipcRenderer.send('pty:write', { tabId: tab.id, data: outgoing });
  });
  term.onCursorMove(() => renderGhost(tab));
  term.onResize(({ cols, rows }) => ipcRenderer.send('pty:resize', { tabId: tab.id, cols, rows }));
  term.onTitleChange((title) => {
    if (title) {
      tab.title = title;
      renderTabs();
    }
  });

  // Ctrl+Shift+C copies, Ctrl+Shift+V pastes — plain Ctrl+C/Ctrl+V/Ctrl+X
  // are left completely alone, so they keep their normal terminal meaning
  // (interrupt, etc.) exactly as before.
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown' || event.altKey || !event.shiftKey) return true;
    if (!(event.ctrlKey || event.metaKey)) return true;
    const key = event.key.toLowerCase();

    // Returning false only stops xterm's own key handling — it does not
    // stop the browser's native paste action from also firing on the same
    // keypress (xterm's hidden textarea has its own native 'paste' listener),
    // which was pasting everything twice. preventDefault() stops that too.
    if (key === 'c') {
      event.preventDefault();
      copySelection(tab);
      return false;
    }
    if (key === 'x') {
      event.preventDefault();
      cutSelection(tab);
      return false;
    }
    if (key === 'v') {
      event.preventDefault();
      pasteIntoTerminal(tab);
      return false;
    }
    return true;
  });

  // xterm clears its own selection on mousedown (any button, including
  // right-click) before our own listeners ever see it — by the time
  // 'contextmenu' fires, term.hasSelection() is already false, so Copy/Cut
  // silently did nothing no matter what was selected. A capture-phase
  // listener on the pane runs before xterm's own bubble-phase handler on
  // its inner element, so it can snapshot the selection first.
  let rightClickSelection = '';
  pane.addEventListener('mousedown', (event) => {
    if (event.button === 2) rightClickSelection = term.hasSelection() ? term.getSelection() : '';
  }, true);

  pane.addEventListener('contextmenu', async (event) => {
    event.preventDefault();
    const action = await ipcRenderer.invoke('terminal:context-menu', { hasSelection: !!rightClickSelection });
    if (action === 'copy' || action === 'cut') {
      if (rightClickSelection) {
        clipboard.writeText(rightClickSelection);
        if (action === 'cut') removeFromInputLine(tab, rightClickSelection);
      }
      term.clearSelection();
    } else if (action === 'paste') pasteIntoTerminal(tab);
  });

  ipcRenderer.send('pty:spawn', { tabId: id, cols: term.cols, rows: term.rows });

  setActiveTab(id);
  renderTabs();
  return tab;
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const [tab] = tabs.splice(idx, 1);
  ipcRenderer.send('pty:kill', { tabId: id });
  tab.term.dispose();
  tab.pane.remove();

  if (tabs.length === 0) {
    createTab();
    return;
  }
  if (activeTabId === id) {
    const next = tabs[idx] || tabs[idx - 1];
    setActiveTab(next.id);
  }
  renderTabs();
}

function setActiveTab(id) {
  activeTabId = id;
  for (const tab of tabs) {
    const isActive = tab.id === id;
    tab.pane.classList.toggle('active', isActive);
    if (isActive) {
      requestAnimationFrame(() => {
        tab.fitAddon.fit();
        tab.term.focus();
      });
    }
  }
  renderTabs();
}

function cycleTab(direction) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  const next = (idx + direction + tabs.length) % tabs.length;
  setActiveTab(tabs[next].id);
}

function renderTabs() {
  const container = document.getElementById('tabs');
  container.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    el.dataset.tooltip = tab.title;

    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title;

    const closeEl = document.createElement('span');
    closeEl.className = 'tab-close';
    closeEl.innerHTML = icon('close');
    closeEl.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });

    el.append(titleEl, closeEl);
    el.addEventListener('click', () => setActiveTab(tab.id));
    container.appendChild(el);
  }
  updateNewTabButtonState();
}

function updateNewTabButtonState() {
  const btn = document.getElementById('new-tab-btn');
  const atLimit = tabs.length >= MAX_TABS;
  btn.disabled = atLimit;
  btn.dataset.tooltip = atLimit ? `Maximum of ${MAX_TABS} tabs open` : 'New tab (Ctrl+Shift+T)';
}

function activeTab() {
  return tabs.find((t) => t.id === activeTabId) || null;
}

// ---------- Command capture & autocomplete ----------

function findHistorySuggestion(prefix) {
  for (let i = history.length - 1; i >= 0; i--) {
    const command = history[i].command;
    if (command.length > prefix.length && command.startsWith(prefix)) return command;
  }
  return null;
}

function refreshSuggestion(tab) {
  tab.suggestion = tab.inputBuffer ? findHistorySuggestion(tab.inputBuffer) : null;
  renderGhost(tab);
}

function clearSuggestion(tab) {
  tab.suggestion = null;
  renderGhost(tab);
}

function renderGhost(tab) {
  const el = tab.ghostEl;
  const remainder = tab.suggestion ? tab.suggestion.slice(tab.inputBuffer.length) : '';
  if (!remainder) {
    el.style.display = 'none';
    return;
  }
  el.textContent = remainder;
  const cell = getCellSize(tab.term);
  const cursorX = tab.term.buffer.active.cursorX;
  const cursorY = tab.term.buffer.active.cursorY;
  el.style.left = `${cursorX * cell.width}px`;
  el.style.top = `${cursorY * cell.height}px`;
  el.style.display = 'block';
}

function commitLine(tab) {
  const command = tab.inputBuffer.trim();
  tab.inputBuffer = '';
  clearSuggestion(tab);
  if (command) {
    ipcRenderer.invoke('history:add', command).then((updated) => {
      history = updated;
    });
  }
}

// Returns the data that should actually be written to the pty, having
// interpreted it against our best-effort model of the current input line.
function processUserInput(tab, data) {
  if (data === '\r' || data === '\n') {
    commitLine(tab);
    return data;
  }
  if (data === '\x7f' || data === '\b') {
    tab.inputBuffer = tab.inputBuffer.slice(0, -1);
    refreshSuggestion(tab);
    return data;
  }
  if (data === '\x03') {
    tab.inputBuffer = '';
    clearSuggestion(tab);
    return data;
  }
  if (data === '\t') {
    if (tab.suggestion) {
      const remainder = tab.suggestion.slice(tab.inputBuffer.length);
      tab.inputBuffer = tab.suggestion;
      clearSuggestion(tab);
      return remainder;
    }
    return data;
  }
  if (data.charCodeAt(0) === 27) {
    // Right arrow accepts the suggestion (like a shell's inline autosuggest);
    // any other escape sequence is cursor movement we don't try to model.
    if ((data === '\x1b[C' || data === '\x1bOC') && tab.suggestion) {
      const remainder = tab.suggestion.slice(tab.inputBuffer.length);
      tab.inputBuffer = tab.suggestion;
      clearSuggestion(tab);
      return remainder;
    }
    clearSuggestion(tab);
    return data;
  }
  if (/[\x00-\x08\x0b-\x1f]/.test(data)) {
    // Other control sequences (Ctrl+A/E/K/W, etc.) move or edit the line in
    // ways we don't track; drop the suggestion rather than show something wrong.
    clearSuggestion(tab);
    return data;
  }
  tab.inputBuffer += data;
  refreshSuggestion(tab);
  return data;
}

// ---------- Snippets sidebar ----------

async function loadSnippets() {
  snippets = await ipcRenderer.invoke('snippets:load');
  renderSnippetList(document.getElementById('snippet-search').value);
}

async function persistSnippets() {
  await ipcRenderer.invoke('snippets:save', snippets);
}

function renderSnippetList(filter) {
  const listEl = document.getElementById('snippet-list');
  listEl.innerHTML = '';

  if (!snippets.length) {
    listEl.innerHTML = '<div class="empty-state">No snippets yet.<br>Click "+ New snippet" to save your first shell command.</div>';
    return;
  }

  const q = (filter || '').trim().toLowerCase();
  const filtered = !q
    ? snippets
    : snippets.filter((s) => (s.name && s.name.toLowerCase().includes(q)) || s.command.toLowerCase().includes(q));

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state">No snippets match your search.</div>';
    return;
  }

  for (const snippet of filtered) {
    const item = document.createElement('div');
    item.className = 'snippet-item' + (snippet.name ? '' : ' unnamed');

    const isRemote = looksLikeSsh(snippet.command);
    const iconEl = document.createElement('div');
    iconEl.className = 'snippet-icon' + (isRemote ? ' remote' : '');
    iconEl.textContent = isRemote ? '→' : '$';

    const text = document.createElement('div');
    text.className = 'snippet-text';
    if (snippet.name) {
      const nameEl = document.createElement('div');
      nameEl.className = 'snippet-name';
      nameEl.textContent = snippet.name;
      text.appendChild(nameEl);
    }
    const cmdEl = document.createElement('div');
    cmdEl.className = 'snippet-command';
    cmdEl.textContent = snippet.command;
    text.appendChild(cmdEl);

    const editBtn = document.createElement('button');
    editBtn.className = 'snippet-edit-btn';
    editBtn.innerHTML = icon('edit');
    editBtn.dataset.tooltip = 'Edit snippet';
    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openSnippetModal(snippet);
    });

    item.append(iconEl, text, editBtn);
    item.addEventListener('click', () => runSnippet(snippet));
    listEl.appendChild(item);
  }
}

function runSnippet(snippet) {
  const tab = activeTab();
  if (!tab) return;
  ipcRenderer.send('pty:write', { tabId: tab.id, data: snippet.command + '\r' });
  if (!sidebarPinned) setSidebarCollapsed(true);
}

function openSnippetModal(snippet) {
  editingSnippetId = snippet ? snippet.id : null;
  document.getElementById('snippet-modal-title').textContent = snippet ? 'Edit snippet' : 'New snippet';
  document.getElementById('snippet-name-input').value = snippet && snippet.name ? snippet.name : '';
  document.getElementById('snippet-command-input').value = snippet ? snippet.command : '';
  document.getElementById('snippet-delete-btn').classList.toggle('hidden', !snippet);
  document.getElementById('snippet-modal').classList.remove('hidden');
  document.getElementById('snippet-command-input').focus();
}

function closeSnippetModal() {
  document.getElementById('snippet-modal').classList.add('hidden');
  editingSnippetId = null;
}

async function saveSnippetFromModal() {
  const name = document.getElementById('snippet-name-input').value.trim();
  const command = document.getElementById('snippet-command-input').value.trim();
  if (!command) {
    showToast('A command is required');
    return;
  }
  if (editingSnippetId) {
    const existing = snippets.find((s) => s.id === editingSnippetId);
    if (existing) {
      existing.name = name || null;
      existing.command = command;
    }
  } else {
    snippets.push({ id: genId('snippet'), name: name || null, command });
  }
  await persistSnippets();
  closeSnippetModal();
  renderSnippetList(document.getElementById('snippet-search').value);
}

async function deleteSnippetFromModal() {
  if (!editingSnippetId) return;
  snippets = snippets.filter((s) => s.id !== editingSnippetId);
  await persistSnippets();
  closeSnippetModal();
  renderSnippetList(document.getElementById('snippet-search').value);
}

async function exportSnippets() {
  if (!snippets.length) {
    showToast('No snippets to export yet');
    return;
  }
  const result = await ipcRenderer.invoke('snippets:export', snippets);
  if (result.ok) showToast(`Exported to ${result.path}`);
}

async function importSnippets() {
  const result = await ipcRenderer.invoke('snippets:import');
  if (!result.ok) return;
  const incoming = result.snippets || [];
  let added = 0;
  for (const s of incoming) {
    const isDuplicate = snippets.some((existing) => existing.command === s.command && existing.name === s.name);
    if (!isDuplicate) {
      snippets.push(s);
      added += 1;
    }
  }
  await persistSnippets();
  renderSnippetList(document.getElementById('snippet-search').value);
  showToast(added ? `Imported ${added} snippet${added === 1 ? '' : 's'}` : 'No new snippets found in that file');
}

// ---------- Passwords (encrypted, write-only, PIN-gated credentials) ----------
//
// Encryption at rest only protects the file on disk — it does nothing to
// stop someone who's simply sitting at this already-unlocked computer from
// clicking "type into terminal". A separate vault PIN gates every
// credentials:* call in the main process, and auto-locks after a few
// minutes idle, so walking away from the machine matters again.

let vaultHasPin = false;
let vaultUnlocked = false;

async function refreshVaultStatus() {
  const status = await ipcRenderer.invoke('vault:status');
  vaultHasPin = !!(status && status.hasPin);
  vaultUnlocked = !!(status && status.unlocked);
  renderCredentialSection();
}

function renderCredentialSection() {
  const body = document.getElementById('credential-body');
  const lockBtn = document.getElementById('vault-lock-btn');
  lockBtn.classList.toggle('hidden', !vaultUnlocked);
  body.innerHTML = '';

  if (!vaultHasPin) {
    body.innerHTML = `
      <p class="modal-note">Set a PIN to protect saved passwords from anyone
        else who uses this computer. It's separate from any system password
        and never leaves this device.</p>
      <input id="vault-pin-input" class="vault-pin-input" type="password" placeholder="Choose a PIN (4+ characters)" autocomplete="off" />
      <button id="vault-pin-submit" class="text-btn small neutral">Set PIN</button>
    `;
    wireVaultPinInput(setupVaultPin);
    return;
  }

  if (!vaultUnlocked) {
    body.innerHTML = `
      <input id="vault-pin-input" class="vault-pin-input" type="password" placeholder="Enter PIN to unlock" autocomplete="off" />
      <button id="vault-pin-submit" class="text-btn small neutral">Unlock</button>
    `;
    wireVaultPinInput(unlockVault);
    return;
  }

  body.innerHTML = `
    <div id="credential-list"></div>
    <button id="add-credential-btn" class="text-btn small neutral" data-icon-inline="plus">Add password</button>
  `;
  applyIcons();
  document.getElementById('add-credential-btn').addEventListener('click', () => openCredentialModal());
  loadCredentials();
}

function wireVaultPinInput(onSubmit) {
  const input = document.getElementById('vault-pin-input');
  document.getElementById('vault-pin-submit').addEventListener('click', onSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSubmit();
  });
  input.focus();
}

async function setupVaultPin() {
  const input = document.getElementById('vault-pin-input');
  const pin = input.value;
  if (!pin || pin.length < 4) {
    showToast('PIN must be at least 4 characters');
    return;
  }
  const result = await ipcRenderer.invoke('vault:setPin', pin);
  if (!result || result.error) {
    showToast('Could not set that PIN');
    return;
  }
  await refreshVaultStatus();
}

async function unlockVault() {
  const input = document.getElementById('vault-pin-input');
  const pin = input.value;
  const result = await ipcRenderer.invoke('vault:unlock', pin);
  if (!result || !result.ok) {
    showToast('Wrong PIN');
    input.value = '';
    input.focus();
    return;
  }
  await refreshVaultStatus();
}

async function lockVaultNow() {
  await ipcRenderer.invoke('vault:lock');
  await refreshVaultStatus();
}

async function loadCredentials() {
  const result = await ipcRenderer.invoke('credentials:list');
  if (!result || result.locked) {
    await refreshVaultStatus();
    return;
  }
  renderCredentialList(result.entries || []);
}

function renderCredentialList(list) {
  const container = document.getElementById('credential-list');
  container.innerHTML = '';
  for (const cred of list) {
    const row = document.createElement('div');
    row.className = 'credential-row';
    row.addEventListener('click', () => typeCredential(cred.id));

    const name = document.createElement('span');
    name.className = 'credential-name';
    name.textContent = cred.name;

    const editBtn = document.createElement('button');
    editBtn.className = 'snippet-edit-btn';
    editBtn.innerHTML = icon('edit');
    editBtn.dataset.tooltip = 'Edit password';
    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openCredentialModal(cred);
    });

    row.append(name, editBtn);
    container.appendChild(row);
  }
}

async function typeCredential(id) {
  const tab = activeTab();
  if (!tab) {
    showToast('Open a terminal tab first');
    return;
  }
  const result = await ipcRenderer.invoke('credentials:type', { id, tabId: tab.id });
  if (!result || !result.ok) {
    if (result && result.error === 'locked') {
      showToast('Vault locked — enter your PIN again');
      await refreshVaultStatus();
      return;
    }
    showToast('Could not type that password');
  }
  tab.term.focus();
}

async function deleteCredential(id) {
  await ipcRenderer.invoke('credentials:delete', id);
  await loadCredentials();
}

let editingCredentialId = null;
let credentialDeleteConfirmTimer = null;

function resetCredentialDeleteButton() {
  clearTimeout(credentialDeleteConfirmTimer);
  const btn = document.getElementById('credential-delete-btn');
  btn.classList.remove('armed');
  btn.textContent = 'Delete';
}

function openCredentialModal(cred) {
  editingCredentialId = cred ? cred.id : null;
  document.getElementById('credential-modal-title').textContent = cred ? 'Edit password' : 'New password';
  document.getElementById('credential-name-input').value = cred ? cred.name : '';
  const passwordInput = document.getElementById('credential-password-input');
  passwordInput.value = '';
  passwordInput.placeholder = cred ? 'Leave blank to keep the current password' : '';
  document.getElementById('credential-delete-btn').classList.toggle('hidden', !cred);
  resetCredentialDeleteButton();
  document.getElementById('credential-modal').classList.remove('hidden');
  document.getElementById('credential-name-input').focus();
}
function closeCredentialModal() {
  document.getElementById('credential-modal').classList.add('hidden');
  editingCredentialId = null;
}

async function saveCredentialFromModal() {
  const name = document.getElementById('credential-name-input').value.trim();
  const password = document.getElementById('credential-password-input').value;
  if (!name) {
    showToast('A name is required');
    return;
  }
  if (!editingCredentialId && !password) {
    showToast('A password is required');
    return;
  }

  const result = editingCredentialId
    ? await ipcRenderer.invoke('credentials:update', { id: editingCredentialId, name, password })
    : await ipcRenderer.invoke('credentials:add', { name, password });

  document.getElementById('credential-password-input').value = '';
  if (!result || result.error === 'unavailable') {
    showToast("Secure storage isn't available on this system");
    return;
  }
  if (result.error === 'locked') {
    showToast('Vault locked — enter your PIN again');
    closeCredentialModal();
    await refreshVaultStatus();
    return;
  }
  if (result.error) {
    showToast('Could not save that password');
    return;
  }
  closeCredentialModal();
  await loadCredentials();
}

async function handleCredentialDeleteClick() {
  const btn = document.getElementById('credential-delete-btn');
  if (!btn.classList.contains('armed')) {
    btn.classList.add('armed');
    btn.textContent = 'Confirm?';
    clearTimeout(credentialDeleteConfirmTimer);
    credentialDeleteConfirmTimer = setTimeout(resetCredentialDeleteButton, 4000);
    return;
  }
  const id = editingCredentialId;
  resetCredentialDeleteButton();
  closeCredentialModal();
  if (id) await deleteCredential(id);
}

let resetConfirmTimer = null;

function disarmReset() {
  clearTimeout(resetConfirmTimer);
  resetConfirmTimer = null;
  const btn = document.getElementById('reset-data-btn');
  btn.textContent = 'Reset';
  btn.classList.remove('armed');
}

async function handleResetClick() {
  const btn = document.getElementById('reset-data-btn');
  if (!btn.classList.contains('armed')) {
    btn.textContent = 'Confirm?';
    btn.classList.add('armed');
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = setTimeout(disarmReset, 4000);
    return;
  }
  disarmReset();
  await ipcRenderer.invoke('app:reset');
  // On success the main process wipes everything and relaunches; nothing
  // left to do here.
}

// ---------- Sidebar collapse / pin ----------

function setSidebarCollapsed(collapsed) {
  sidebarCollapsed = collapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
  document.getElementById('sidebar-topbar').classList.toggle('collapsed', collapsed);
  document.getElementById('sidebar-toggle').classList.toggle('active', !collapsed);
  setTimeout(() => {
    const tab = activeTab();
    if (tab) tab.fitAddon.fit();
  }, 240);
}

function toggleSidebar() {
  setSidebarCollapsed(!sidebarCollapsed);
}

function togglePin() {
  sidebarPinned = !sidebarPinned;
  updatePinButton();
  if (sidebarPinned && sidebarCollapsed) setSidebarCollapsed(false);
}

function updatePinButton() {
  const btn = document.getElementById('pin-btn');
  btn.classList.toggle('active', sidebarPinned);
  btn.innerHTML = icon(sidebarPinned ? 'lock' : 'unlock');
  btn.dataset.tooltip = sidebarPinned ? 'Unlock (allow the sidebar to auto-collapse)' : 'Lock the sidebar open';
}

// ---------- Theme (follows the desktop theme by default) ----------

let currentThemeMode = 'system';

function updateAppearanceIcon() {
  const btn = document.getElementById('appearance-btn');
  btn.innerHTML = icon(isDarkMode() ? 'moon' : 'sun');
}

function renderThemeModeButtons() {
  document.querySelectorAll('.theme-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === currentThemeMode);
  });
}

function applyThemeToAllTerminals() {
  const theme = currentTerminalTheme();
  for (const tab of tabs) tab.term.options.theme = theme;
}

async function setThemeMode(mode) {
  currentThemeMode = mode;
  renderThemeModeButtons();
  await ipcRenderer.invoke('theme:set', mode);
}

async function loadThemeMode() {
  const mode = await ipcRenderer.invoke('theme:get');
  currentThemeMode = mode === 'light' || mode === 'dark' ? mode : 'system';
  renderThemeModeButtons();
}

THEME_MEDIA.addEventListener('change', () => {
  updateAppearanceIcon();
  applyAccent(currentAccentHue);
});

// ---------- Accent color (10 Material Design hues, spread for max contrast
// in both light and dark schemes) ----------

const ACCENT_COLORS = [
  { name: 'Red', hue: 355 },
  { name: 'Orange', hue: 27 },
  { name: 'Amber', hue: 45 },
  { name: 'Green', hue: 142 },
  { name: 'Teal', hue: 174 },
  { name: 'Cyan', hue: 190 },
  { name: 'Blue', hue: 217 },
  { name: 'Indigo', hue: 231 },
  { name: 'Purple', hue: 291 },
  { name: 'Pink', hue: 330 },
];
const DEFAULT_ACCENT_HUE = 217;
let currentAccentHue = DEFAULT_ACCENT_HUE;

function hsl(h, s, l) {
  return `hsl(${h} ${s}% ${l}%)`;
}
function hsla(h, s, l, a) {
  return `hsl(${h} ${s}% ${l}% / ${a})`;
}

// Approximates Material Design 3's HCT tonal palettes with plain HSL math:
// a light, low-contrast tone for dark-scheme roles, a deeper saturated tone
// for light-scheme roles, and a hue offset for the tertiary accent.
function applyAccent(hue) {
  currentAccentHue = hue;
  const tertiaryHue = (hue + 60) % 360;
  const root = document.documentElement.style;
  if (isDarkMode()) {
    root.setProperty('--md-primary', hsl(hue, 85, 78));
    root.setProperty('--md-primary-on', hsl(hue, 45, 18));
    root.setProperty('--md-primary-container', hsl(hue, 40, 26));
    root.setProperty('--md-on-primary-container', hsl(hue, 80, 90));
    root.setProperty('--md-secondary', hsl(hue, 15, 78));
    root.setProperty('--md-secondary-container', hsl(hue, 20, 28));
    root.setProperty('--md-on-secondary-container', hsl(hue, 25, 90));
    root.setProperty('--md-tertiary', hsl(tertiaryHue, 70, 78));
    root.setProperty('--md-tertiary-container', hsl(tertiaryHue, 45, 26));
    root.setProperty('--md-on-tertiary-container', hsl(tertiaryHue, 70, 88));
  } else {
    root.setProperty('--md-primary', hsl(hue, 55, 42));
    root.setProperty('--md-primary-on', '#ffffff');
    root.setProperty('--md-primary-container', hsl(hue, 60, 92));
    root.setProperty('--md-on-primary-container', hsl(hue, 55, 26));
    root.setProperty('--md-secondary', hsl(hue, 10, 40));
    root.setProperty('--md-secondary-container', hsl(hue, 15, 90));
    root.setProperty('--md-on-secondary-container', hsl(hue, 15, 26));
    root.setProperty('--md-tertiary', hsl(tertiaryHue, 45, 38));
    root.setProperty('--md-tertiary-container', hsl(tertiaryHue, 55, 90));
    root.setProperty('--md-on-tertiary-container', hsl(tertiaryHue, 45, 26));
  }
  applyThemeToAllTerminals();
  renderAccentSwatches();
}

function renderAccentSwatches() {
  const container = document.getElementById('accent-swatches');
  if (!container) return;
  container.innerHTML = '';
  for (const accent of ACCENT_COLORS) {
    const isSelected = accent.hue === currentAccentHue;
    const btn = document.createElement('button');
    btn.className = 'accent-swatch' + (isSelected ? ' selected' : '');
    btn.style.background = hsl(accent.hue, 65, 55);
    btn.dataset.tooltip = accent.name;
    if (isSelected) btn.innerHTML = icon('check');
    btn.addEventListener('click', () => selectAccent(accent.hue));
    container.appendChild(btn);
  }
}

async function selectAccent(hue) {
  applyAccent(hue);
  await ipcRenderer.invoke('accent:set', hue);
  closeAppearancePopover();
}

function openAppearancePopover() {
  document.getElementById('appearance-popover').classList.remove('hidden');
}
function closeAppearancePopover() {
  document.getElementById('appearance-popover').classList.add('hidden');
}
function toggleAppearancePopover() {
  const popover = document.getElementById('appearance-popover');
  if (popover.classList.contains('hidden')) openAppearancePopover();
  else closeAppearancePopover();
}

async function loadAccent() {
  const hue = await ipcRenderer.invoke('accent:get');
  applyAccent(typeof hue === 'number' ? hue : DEFAULT_ACCENT_HUE);
}

// ---------- Command history modal ----------

async function loadHistory() {
  history = await ipcRenderer.invoke('history:load');
}

function openHistoryModal() {
  const modal = document.getElementById('history-modal');
  modal.classList.remove('hidden');
  const search = document.getElementById('history-search');
  search.value = '';
  renderHistoryList('');
  search.focus();
}

function closeHistoryModal() {
  document.getElementById('history-modal').classList.add('hidden');
}

function renderHistoryList(filter) {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '';
  const q = (filter || '').trim().toLowerCase();
  const items = history
    .slice()
    .reverse()
    .filter((h) => !q || h.command.toLowerCase().includes(q));

  if (!items.length) {
    listEl.innerHTML = '<div class="empty-state">No matching commands.</div>';
    return;
  }

  for (const entry of items.slice(0, 300)) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.textContent = entry.command;
    el.addEventListener('click', () => {
      insertCommand(entry.command);
      closeHistoryModal();
    });
    listEl.appendChild(el);
  }
}

function insertCommand(command) {
  const tab = activeTab();
  if (!tab) return;
  // Clear whatever's on the current input line, then type the command without
  // pressing Enter, so the user can review or edit it before running it.
  ipcRenderer.send('pty:write', { tabId: tab.id, data: '\x15' + command });
  tab.inputBuffer = command;
  clearSuggestion(tab);
  tab.term.focus();
}

// ---------- Updates ----------

let latestUpdateVersion = null;

function setUpdateButton({ label, action, disabled = false }) {
  const btn = document.getElementById('update-btn');
  btn.classList.remove('hidden');
  btn.disabled = disabled;
  btn.dataset.action = action || '';
  btn.innerHTML = `<span class="btn-icon">${icon('update')}</span><span>${label}</span>`;
}

function setUpdateDot(cls, tooltip) {
  const dot = document.getElementById('update-dot');
  dot.className = `update-dot ${cls}`;
  dot.dataset.tooltip = tooltip;
}

function applyUpdateState(payload) {
  const btn = document.getElementById('update-btn');
  switch (payload.state) {
    case 'checking':
      setUpdateDot('checking', 'Checking for updates…');
      break;
    case 'available':
      latestUpdateVersion = payload.version;
      setUpdateButton({ label: `Update to v${payload.version}`, action: 'download' });
      setUpdateDot('available', `Update available: v${payload.version} (click to re-check)`);
      break;
    case 'downloading': {
      const pct = Math.round(payload.percent || 0);
      setUpdateButton({ label: `Downloading… ${pct}%`, action: 'downloading', disabled: true });
      break;
    }
    case 'downloaded':
      setUpdateButton({ label: 'Restart & install update', action: 'install' });
      setUpdateDot('available', `Update ready to install: v${payload.version}`);
      break;
    case 'error': {
      if (btn.dataset.action === 'downloading') {
        showToast('Update failed to download');
      }
      btn.classList.add('hidden');
      const detail = payload.message ? `: ${payload.message}` : '';
      setUpdateDot('error', `Update check failed${detail} (click to retry)`);
      break;
    }
    case 'not-available':
      btn.classList.add('hidden');
      setUpdateDot('up-to-date', `You're on the latest version, v${APP_VERSION} (click to re-check)`);
      break;
    default:
      btn.classList.add('hidden');
      break;
  }
}

async function handleUpdateButtonClick() {
  const btn = document.getElementById('update-btn');
  const action = btn.dataset.action;
  if (action === 'download') {
    setUpdateButton({ label: `Downloading… 0%`, action: 'downloading', disabled: true });
    await ipcRenderer.invoke('update:download');
  } else if (action === 'install') {
    await ipcRenderer.invoke('update:install');
  }
}

// ---------- Tooltips (rendered at the document level, positioned via JS,
// so they're never clipped by a scrolling/overflow:hidden ancestor like
// the snippet or password lists) ----------

function initGlobalTooltip() {
  const tip = document.createElement('div');
  tip.id = 'global-tooltip';
  document.body.appendChild(tip);
  let currentEl = null;

  function reposition(el) {
    const rect = el.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = rect.top - tipRect.height - 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    if (top < 4) top = rect.bottom + 8;
    top = Math.min(top, window.innerHeight - tipRect.height - 4);
    left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function show(el) {
    if (!el.dataset.tooltip) return;
    currentEl = el;
    tip.textContent = el.dataset.tooltip;
    tip.classList.add('visible');
    reposition(el);
  }
  function hide(el) {
    if (el && el !== currentEl) return;
    currentEl = null;
    tip.classList.remove('visible');
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (el) show(el);
  });
  document.addEventListener('mouseout', (e) => hide(e.target.closest('[data-tooltip]')));
  // Tooltip text can change while still hovered (e.g. the update dot
  // mid-check) — cheap to just re-sync on every mousemove rather than
  // wire a change listener onto every possible tooltip source.
  document.addEventListener('mousemove', () => {
    if (currentEl && currentEl.dataset.tooltip !== tip.textContent) {
      tip.textContent = currentEl.dataset.tooltip;
      reposition(currentEl);
    }
  });
}

// ---------- Wiring ----------

function applyIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
  document.querySelectorAll('[data-icon-inline]').forEach((el) => {
    const label = el.textContent.trim();
    el.innerHTML = `<span class="btn-icon">${icon(el.dataset.iconInline)}</span><span>${label}</span>`;
  });
}

function wireStaticControls() {
  applyIcons();
  updateAppearanceIcon();
  updatePinButton();
  document.getElementById('sidebar-toggle').classList.add('active');
  document.getElementById('app-brand-version').textContent = `v${APP_VERSION}`;

  document.getElementById('new-tab-btn').addEventListener('click', () => createTab());
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('pin-btn').addEventListener('click', togglePin);
  document.getElementById('appearance-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAppearancePopover();
  });
  document.getElementById('appearance-popover').querySelector('.popover-scrim').addEventListener('click', closeAppearancePopover);
  document.querySelectorAll('.theme-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setThemeMode(btn.dataset.mode));
  });

  document.getElementById('snippet-search').addEventListener('input', (e) => renderSnippetList(e.target.value));
  document.getElementById('add-snippet-btn').addEventListener('click', () => openSnippetModal(null));
  document.getElementById('export-btn').addEventListener('click', exportSnippets);
  document.getElementById('import-btn').addEventListener('click', importSnippets);

  document.getElementById('snippet-cancel-btn').addEventListener('click', closeSnippetModal);
  document.getElementById('snippet-save-btn').addEventListener('click', saveSnippetFromModal);
  document.getElementById('snippet-delete-btn').addEventListener('click', deleteSnippetFromModal);
  document.getElementById('snippet-modal').querySelector('.modal-scrim').addEventListener('click', closeSnippetModal);

  document.getElementById('vault-lock-btn').addEventListener('click', lockVaultNow);
  document.getElementById('credential-cancel-btn').addEventListener('click', closeCredentialModal);
  document.getElementById('credential-save-btn').addEventListener('click', saveCredentialFromModal);
  document.getElementById('credential-delete-btn').addEventListener('click', handleCredentialDeleteClick);
  document.getElementById('credential-modal').querySelector('.modal-scrim').addEventListener('click', closeCredentialModal);
  ipcRenderer.on('vault:state', (_event, payload) => {
    vaultUnlocked = !!(payload && payload.unlocked);
    renderCredentialSection();
  });

  document.getElementById('reset-data-btn').addEventListener('click', handleResetClick);

  document.getElementById('history-search').addEventListener('input', (e) => renderHistoryList(e.target.value));
  document.getElementById('history-modal').querySelector('.modal-scrim').addEventListener('click', closeHistoryModal);

  document.getElementById('btn-min').addEventListener('click', () => ipcRenderer.send('window:minimize'));
  document.getElementById('btn-max').addEventListener('click', () => ipcRenderer.send('window:maximize-toggle'));
  document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('window:close'));

  document.getElementById('update-btn').addEventListener('click', handleUpdateButtonClick);
  document.getElementById('update-dot').addEventListener('click', () => ipcRenderer.invoke('update:check'));
  ipcRenderer.on('update:state', (_event, payload) => applyUpdateState(payload));
  ipcRenderer.on('window:state', (_event, { maximized }) => {
    document.body.classList.toggle('maximized', maximized);
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (mod && e.shiftKey && key === 't') {
      e.preventDefault(); e.stopPropagation();
      createTab();
      return;
    }
    if (mod && e.shiftKey && key === 'w') {
      e.preventDefault(); e.stopPropagation();
      if (activeTabId) closeTab(activeTabId);
      return;
    }
    if (mod && e.shiftKey && (key === 'h' || key === 'f')) {
      e.preventDefault(); e.stopPropagation();
      openHistoryModal();
      return;
    }
    if (mod && e.shiftKey && key === 'b') {
      e.preventDefault(); e.stopPropagation();
      toggleSidebar();
      return;
    }
    if (mod && key === 'tab') {
      e.preventDefault(); e.stopPropagation();
      cycleTab(e.shiftKey ? -1 : 1);
      return;
    }
    if (key === 'escape') {
      if (!document.getElementById('history-modal').classList.contains('hidden')) {
        closeHistoryModal();
        e.preventDefault();
      } else if (!document.getElementById('snippet-modal').classList.contains('hidden')) {
        closeSnippetModal();
        e.preventDefault();
      } else if (!document.getElementById('appearance-popover').classList.contains('hidden')) {
        closeAppearancePopover();
        e.preventDefault();
      }
    }
  }, true);

  ipcRenderer.on('pty:data', (_event, { tabId, data }) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) tab.term.write(data);
  });

  ipcRenderer.on('pty:exit', (_event, { tabId }) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) tab.term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
  });

  const resizeObserver = new ResizeObserver(() => {
    const tab = activeTab();
    if (tab) tab.fitAddon.fit();
  });
  resizeObserver.observe(document.getElementById('terminals'));
}

async function bootstrap() {
  initGlobalTooltip();
  wireStaticControls();
  await Promise.all([loadSnippets(), loadHistory(), loadAccent(), loadThemeMode(), refreshVaultStatus()]);
  createTab();
  // Geist Mono loads from disk almost instantly, but xterm measures cell
  // size from whatever font is active at the time — re-fit once it's
  // actually ready so terminal columns don't end up a few pixels off.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      for (const tab of tabs) tab.fitAddon.fit();
    });
  }
}

bootstrap();
