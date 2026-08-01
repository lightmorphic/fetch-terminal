const { ipcRenderer, shell } = require('electron');
const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');
const { SearchAddon } = require('@xterm/addon-search');
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
function currentTerminalTheme() {
  const base = isDarkMode() ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME;
  const hue = typeof currentAccentHue === 'number' ? currentAccentHue : DEFAULT_ACCENT_HUE;
  return {
    ...base,
    cursor: isDarkMode() ? hsl(hue, 85, 78) : hsl(hue, 55, 42),
    selectionBackground: isDarkMode() ? hsla(hue, 85, 78, 0.28) : hsla(hue, 55, 42, 0.2),
  };
}

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let history = [];
let snippets = [];
let sidebarPinned = false;
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

function createTab() {
  const id = genId('tab');
  const pane = document.createElement('div');
  pane.className = 'terminal-pane';

  const ghost = document.createElement('div');
  ghost.className = 'autocomplete-ghost';
  pane.appendChild(ghost);

  document.getElementById('terminals').appendChild(pane);

  const term = new Terminal({
    fontFamily: "'Roboto Mono', 'DejaVu Sans Mono', monospace",
    fontSize: 14,
    lineHeight: 1.15,
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 8000,
    theme: currentTerminalTheme(),
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new SearchAddon());
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
    el.title = tab.title;

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
    editBtn.title = 'Edit snippet';
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

// ---------- Sidebar collapse / pin ----------

function setSidebarCollapsed(collapsed) {
  sidebarCollapsed = collapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
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
  document.getElementById('pin-btn').classList.toggle('active', sidebarPinned);
  if (sidebarPinned && sidebarCollapsed) setSidebarCollapsed(false);
}

// ---------- Theme (follows the desktop theme by default) ----------

function updateThemeToggleIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  btn.innerHTML = icon(isDarkMode() ? 'moon' : 'sun');
  btn.title = isDarkMode() ? 'Switch to light theme' : 'Switch to dark theme';
}

function applyThemeToAllTerminals() {
  const theme = currentTerminalTheme();
  for (const tab of tabs) tab.term.options.theme = theme;
}

async function toggleTheme() {
  await ipcRenderer.invoke('theme:set', isDarkMode() ? 'light' : 'dark');
}

THEME_MEDIA.addEventListener('change', () => {
  updateThemeToggleIcon();
  applyAccent(currentAccentHue);
});

// ---------- Accent color (10 Material Design hues) ----------

const ACCENT_COLORS = [
  { name: 'Purple', hue: 262 },
  { name: 'Indigo', hue: 231 },
  { name: 'Blue', hue: 217 },
  { name: 'Cyan', hue: 190 },
  { name: 'Teal', hue: 174 },
  { name: 'Green', hue: 142 },
  { name: 'Amber', hue: 45 },
  { name: 'Orange', hue: 27 },
  { name: 'Red', hue: 355 },
  { name: 'Pink', hue: 330 },
];
const DEFAULT_ACCENT_HUE = 262;
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
    btn.title = accent.name;
    if (isSelected) btn.innerHTML = icon('check');
    btn.addEventListener('click', () => selectAccent(accent.hue));
    container.appendChild(btn);
  }
}

async function selectAccent(hue) {
  applyAccent(hue);
  await ipcRenderer.invoke('accent:set', hue);
  closeAccentPopover();
}

function openAccentPopover() {
  document.getElementById('accent-popover').classList.remove('hidden');
}
function closeAccentPopover() {
  document.getElementById('accent-popover').classList.add('hidden');
}
function toggleAccentPopover() {
  const popover = document.getElementById('accent-popover');
  if (popover.classList.contains('hidden')) openAccentPopover();
  else closeAccentPopover();
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
  updateThemeToggleIcon();
  document.getElementById('sidebar-toggle').classList.add('active');
  document.getElementById('app-brand-version').textContent = `v${APP_VERSION}`;

  document.getElementById('new-tab-btn').addEventListener('click', () => createTab());
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('pin-btn').addEventListener('click', togglePin);
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
  document.getElementById('accent-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAccentPopover();
  });
  document.getElementById('accent-popover').querySelector('.popover-scrim').addEventListener('click', closeAccentPopover);

  document.getElementById('snippet-search').addEventListener('input', (e) => renderSnippetList(e.target.value));
  document.getElementById('add-snippet-btn').addEventListener('click', () => openSnippetModal(null));
  document.getElementById('export-btn').addEventListener('click', exportSnippets);
  document.getElementById('import-btn').addEventListener('click', importSnippets);

  document.getElementById('snippet-cancel-btn').addEventListener('click', closeSnippetModal);
  document.getElementById('snippet-save-btn').addEventListener('click', saveSnippetFromModal);
  document.getElementById('snippet-delete-btn').addEventListener('click', deleteSnippetFromModal);
  document.getElementById('snippet-modal').querySelector('.modal-scrim').addEventListener('click', closeSnippetModal);

  document.getElementById('history-search').addEventListener('input', (e) => renderHistoryList(e.target.value));
  document.getElementById('history-modal').querySelector('.modal-scrim').addEventListener('click', closeHistoryModal);

  document.getElementById('btn-min').addEventListener('click', () => ipcRenderer.send('window:minimize'));
  document.getElementById('btn-max').addEventListener('click', () => ipcRenderer.send('window:maximize-toggle'));
  document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('window:close'));

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
      } else if (!document.getElementById('accent-popover').classList.contains('hidden')) {
        closeAccentPopover();
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
  wireStaticControls();
  await Promise.all([loadSnippets(), loadHistory(), loadAccent()]);
  createTab();
}

bootstrap();
