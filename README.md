# Fetch Terminal

A lightweight, open source terminal emulator for the Linux desktop, built with
Electron. It doesn't depend on GTK or Qt, so it looks and behaves the same
regardless of which desktop environment it runs under — its own custom,
Material Design 3 interface is drawn entirely in local HTML/CSS/SVG, using
[Geist](https://vercel.com/font) (bundled directly in the app, SIL Open Font
License). Nothing in the UI is ever fetched over the network: no CDN fonts,
no icon fonts, no remote assets of any kind. The only network access the app
ever makes at all is checking GitHub for a new release (see "Updates" below)
— nothing else talks to the internet.

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
  - Locked open by default; unlock it to let it auto-collapse the
    moment you type into the terminal or run a snippet instead
  - Export/import snippets as a Markdown file for backup and sharing
- No accounts, no built-in SSH connection manager beyond what snippets provide
- PIN-protected password vault — save a password once, encrypted, and click
  a button to type it into the active terminal whenever a prompt asks for
  it; it can never be viewed or exported again through the app
- A "Reset all data" button that wipes every snippet, history entry, saved
  password, and setting on demand
- `Ctrl+Shift+C`/`Ctrl+Shift+V` to copy/paste in the terminal, plus a
  right-click context menu with the same two — plain `Ctrl+C` and
  `Ctrl+V` are left completely alone, so they keep their normal shell
  meaning (interrupt, etc.)
- Click anywhere on the current input line to move your cursor there and
  start typing mid-line, just like in a normal text field

## Keyboard shortcuts

| Shortcut           | Action                       |
| ------------------ | ---------------------------- |
| `Ctrl+Shift+T`      | New tab (up to 4 at once — the "+" button disables past that) |
| `Ctrl+Shift+W`      | Close active tab             |
| `Ctrl+Shift+F`      | Search command history       |
| `Ctrl+Shift+B`      | Toggle the snippets sidebar  |
| `Ctrl+Tab` / `+Shift` | Cycle to next/previous tab |
| `Tab` / `→`         | Accept an autocomplete suggestion |
| `Ctrl+Shift+C`      | Copy the terminal selection    |
| `Ctrl+Shift+V`      | Paste the clipboard into the terminal |
| `Esc`               | Close an open dialog          |

Right-click inside a terminal for a Copy/Paste context menu instead, if you
prefer that to the shortcuts.

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

The window itself has softly rounded corners and a subtle outline/shadow,
so it reads clearly against any desktop background instead of blending
into it — this needs your desktop to be running a compositing window
manager (the default on GNOME, KDE, Cinnamon, and XFCE-with-compositing);
without one it just falls back to square corners rather than breaking
anything. Corners square off automatically while the window is maximized.

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

## Password vault

The "Passwords" section at the bottom of the sidebar lets you save a
password once and click its row (just like clicking a snippet) to type it
into the active terminal whenever something prompts for it (`sudo`, an SSH
login, anything) — no retyping, and it automatically presses Enter for you.

This is deliberately **write-only**: once saved, a password can never be
viewed, copied, or exported again through the app. There's no "reveal"
option — the pencil icon on each row only lets you rename it or overwrite
it with a new password (leave the password field blank to keep the current
one), never see the existing value.

Deleting lives inside that same edit view rather than on the row itself,
and like "Reset all data," requires a second click on "Confirm?" (it
un-arms itself after a few seconds if you don't follow through), so it
isn't something you could trigger by accident.

Two independent layers of protection:

1. **Encrypted at rest.** Passwords are encrypted using your OS's own
   secure keyring (via Electron's `safeStorage`, backed by the Secret
   Service API / GNOME Keyring / KWallet), not a homemade cipher. This
   requires a keyring service to be running — if none is available,
   saving a password will fail with a clear message rather than silently
   storing it in plain text.
2. **A separate vault PIN.** Encryption at rest only protects the file on
   disk — it does nothing to stop someone who's simply sitting at your
   already-unlocked computer from clicking a button. So a PIN (separate
   from any system password, never sent anywhere) gates every use of the
   vault: adding, deleting, and typing a password all require it to be
   unlocked first. The vault **auto-locks after 5 minutes of not being
   used**, so walking away from the machine matters again — you'll need
   the PIN once more to do anything with it.

There's no way to recover a forgotten vault PIN short of using "Reset all
data" (below), which deletes the saved passwords along with everything
else.

## Resetting / removing all data

An AppImage has no uninstall step — deleting the file just removes the
binary; it doesn't (and can't) run any cleanup, since nothing is executing
anymore to do that cleanup. Anything the app saved to disk stays there
until removed by hand.

To clear everything from inside the app, click the small **Reset** button
next to Import/Export at the bottom of the sidebar, then click the
**Confirm?** button that appears in its place (it reverts back to "Reset"
on its own after a few seconds if you don't). That deletes all snippets,
command history, saved passwords, and settings, then restarts with a clean
slate.

To remove it all manually instead (e.g. after deleting the AppImage
itself), delete the whole per-user data directory:

```sh
rm -rf ~/.config/Fetch\ Terminal/
```

## Data storage

Snippets, command history, your theme/appearance preferences, and the
encrypted password vault are stored as JSON in Electron's per-user data
directory (typically `~/.config/Fetch Terminal/`) — nothing is ever sent
anywhere. See "Resetting / removing all data" above for how to clear it.
