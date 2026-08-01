# Fetch Terminal

A lightweight, open source terminal emulator for the Linux desktop, built with
Electron. It doesn't depend on GTK or Qt, so it looks and behaves the same
regardless of which desktop environment it runs under — its own custom,
Material-style interface is drawn entirely in HTML/CSS.

## Features

- Tabs running your default shell (`$SHELL`, falling back to `/bin/bash`)
- Custom, frameless Material-style UI (dark theme, consistent across DEs)
- Scrollable, searchable command history (`Ctrl+Shift+F`) shared across tabs
- Inline autocomplete that suggests previously-typed commands as you type
  (accept with `Tab` or `→`)
- Collapsible sidebar of snippets — saved shell commands (including SSH
  one-liners) that run instantly in the active tab when clicked
  - Live search box at the top of the sidebar filters as you type
  - Pin/lock the sidebar open, or let it auto-collapse after running a snippet
  - Export/import snippets as a Markdown file for backup and sharing
- No accounts, no built-in SSH connection manager beyond what snippets provide

## Keyboard shortcuts

| Shortcut           | Action                       |
| ------------------ | ---------------------------- |
| `Ctrl+Shift+T`      | New tab                      |
| `Ctrl+Shift+W`      | Close active tab             |
| `Ctrl+Shift+F`      | Search command history       |
| `Ctrl+Shift+B`      | Toggle the snippets sidebar  |
| `Ctrl+Tab` / `+Shift` | Cycle to next/previous tab |
| `Tab` / `→`         | Accept an autocomplete suggestion |
| `Esc`               | Close an open dialog          |

## Development

```sh
npm install
npm start
```

`node-pty` is a native module, so `npm install` needs a working native build
toolchain (`python3`, `make`, a C++ compiler) the first time it's installed.

## Packaging

```sh
npm run dist
```

Produces an AppImage and a `.deb` via `electron-builder`.

## Snippets file format

Snippets are exported as Markdown so they're easy to read, edit by hand, and
diff in version control:

```md
# Fetch Terminal Snippets

## Deploy prod
```sh
ssh deploy@example.com "cd /srv/app && ./deploy.sh"
```

```sh
ls -la
```
```

A snippet with a `##` heading above its code fence gets that heading as its
custom name; a bare code fence (no heading) is imported as an unnamed
snippet, which is displayed using its raw command text as the label.

## Data storage

Snippets and command history are stored as JSON in Electron's per-user data
directory (typically `~/.config/Fetch Terminal/`) — nothing is sent anywhere.
