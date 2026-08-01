# Fetch Terminal

A lightweight, open source terminal emulator for the Linux desktop, built with
Electron. It doesn't depend on GTK or Qt, so it looks and behaves the same
regardless of which desktop environment it runs under — its own custom,
Material Design 3 interface is drawn entirely in local HTML/CSS/SVG. Nothing
in the UI is ever fetched over the network: no CDN fonts, no icon fonts, no
remote assets of any kind.

## Features

- Tabs running your default shell (`$SHELL`, falling back to `/bin/bash`)
- Custom, frameless Material Design 3 interface with a violet-to-teal accent,
  a hand-drawn local icon set, and light/dark themes
- Light/Dark/Auto theme selector (Auto follows your desktop's setting), plus
  10 accent colors, in one appearance popover
- Automatic update checks against GitHub Releases (startup + every 30
  minutes), with a status dot you can click any time to check on demand
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

## Installing on Linux

Fetch Terminal targets any Linux desktop, not any one distribution. There's
no hosted download yet, so you build an AppImage from source once, then run
it like any other AppImage.

```sh
git clone https://github.com/fosscharlie/fetch-terminal.git
cd fetch-terminal
npm install
npm run dist
```

`node-pty` is a native module, so the first `npm install` needs a working
native build toolchain — on Debian/Ubuntu-based distros:

```sh
sudo apt install -y build-essential python3
```

(On other distributions, install your distro's equivalent of `gcc`/`make`
and `python3`.)

`npm run dist` builds `Fetch-Terminal-<version>.AppImage` and automatically
moves it into your `~/Downloads` folder. Then just:

```sh
chmod +x ~/Downloads/Fetch-Terminal-*.AppImage
~/Downloads/Fetch-Terminal-*.AppImage
```

Most desktop environments let you add an AppImage to your application menu
directly (e.g. via an "AppImage Launcher"-style integration tool), or you can
just keep launching it from `~/Downloads`.

## Development

```sh
npm install
npm start
```

## Packaging

```sh
npm run dist
```

Builds an AppImage only (configured in the `build` section of `package.json`
via `electron-builder`) and moves it to `~/Downloads` via the
`afterAllArtifactBuild` hook in `scripts/move-to-downloads.js`.

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

## Theming

Click the sun/moon button in the titlebar to open the appearance popover.
It has two parts:

- **Theme** — three buttons: Light, Dark, and Auto. Auto follows your
  desktop's light/dark preference automatically (Electron keeps this in
  sync with the OS); Light/Dark force that regardless of the desktop
  setting. Your choice is remembered across restarts.
- **Accent color** — 10 Material Design hues (Red, Orange, Amber, Green,
  Teal, Cyan, Blue, Indigo, Purple, Pink), chosen to stay clearly distinct
  from each other in both light and dark mode. The whole app re-themes
  instantly — buttons, the active tab indicator, icons, and the terminal's
  cursor/selection color — and your choice is remembered across restarts.

Every icon in the app is a local, hand-drawn inline SVG; none are loaded
from a font or a CDN.

## Updates

Fetch Terminal checks GitHub Releases for a newer version automatically:
once at startup, and then again every 30 minutes while it keeps running.
This only applies to a packaged AppImage install — running from source via
`npm start` always reports "up to date" since the check is skipped in dev.

A small status dot sits next to the version number in the sidebar footer:

| Dot color | Meaning |
| --------- | ------- |
| Green     | You're on the latest version |
| Red       | An update is available (or already downloaded and ready to install) |
| Gray      | Currently checking, or the last check failed (e.g. no network) |

Hovering the dot shows exactly what state it's in. **You don't have to wait
for the next scheduled check** — clicking the dot at any time triggers an
immediate re-check, overriding the 30-minute interval.

When an update is found, an "Update to v_X.Y.Z_" button appears underneath
the version. Clicking it downloads the new AppImage in the background; once
finished, the button changes to "Restart & install update" — clicking that
quits the app, replaces the running AppImage with the new one, and restarts
it automatically. Nothing downloads or installs without you clicking
through both of those steps yourself.

## Data storage

Snippets, command history, and your theme preference are stored as JSON in
Electron's per-user data directory (typically `~/.config/Fetch Terminal/`) —
nothing is sent anywhere.
