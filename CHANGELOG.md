# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-08-01

### Added

- `Ctrl+Click` (or `Cmd+Click`) on a snippet types it into the terminal
  without pressing Enter, instead of running it immediately — useful for
  a snippet that's really a prefix (`sudo apt install `) meant to be
  finished by hand. A plain click still runs it right away as before.

## [1.0.0] - 2026-08-01

First stable release. No functional changes from 0.20.2 — this marks
the app as feature-complete and hardened for general use: tabs, snippets,
searchable history, an encrypted/PIN-gated password vault, theming,
self-updating, and self-registering desktop integration, all audited for
security and dependency freshness ahead of this release (see 0.19.0's
notes for the audit details). From here on, version numbers follow
[Semantic Versioning](https://semver.org/) against the 1.0 baseline.

## [0.20.2] - 2026-08-01

### Changed

- The window's own icon (set via `BrowserWindow`'s `icon` option, what
  most Linux taskbars/panels actually read for a running window) now
  reads from the same `~/.local/share` copy that desktop integration
  manages — verified world-readable and correct — instead of the copy
  bundled inside the packaged app's own asar archive, whose path
  resolution has already caused one round of this exact bug. Falls back
  to the bundled copy in dev mode or before desktop integration has run.

## [0.20.1] - 2026-08-01

### Fixed

- The icon and `.desktop` file the app self-registers (0.20.0) could end
  up owner-only (`0600`), unreadable to anything but this app's own
  process, because `fs.copyFileSync`'s resulting permissions follow the
  process's own umask rather than the source file's. Neither file has
  anything sensitive in it — both are now explicitly `chmod 644` after
  being written, regardless of umask.

## [0.20.0] - 2026-08-01

### Added

- The app now registers itself as a proper desktop application (a
  `.desktop` file in `~/.local/share/applications`, plus the icon in the
  standard icon-theme location) the first time it's run as a plain
  AppImage, with no separate integration tool required. Without this
  there's no launcher for a panel/taskbar to actually pin — pinning
  always works by remembering a `.desktop` entry, not a running process,
  so a plain double-clicked AppImage had nothing to attach a pin to.
  Re-registers on every launch to stay in sync (this doesn't affect an
  existing pin, since that's the desktop environment's own state, keyed
  off the file's name, which never changes), and keeps working across
  auto-updates since electron-updater replaces the AppImage file in
  place rather than under a new name.

## [0.19.2] - 2026-08-01

### Fixed

- The 0.19.1 icon fix had no effect in the actual packaged AppImage:
  `build/icons` was never listed in `package.json`'s `build.files`, so it
  never got bundled into the app at all — the `BrowserWindow`'s `icon`
  option was pointing at a path that simply doesn't exist once packaged,
  and silently fell back to the default logo. Added `build/icons/**/*`
  to `files` so the icon actually ships with the app.

## [0.19.1] - 2026-08-01

### Fixed

- The window never set an explicit `icon`, so on window managers whose
  taskbar/panel/alt-tab switcher doesn't read the icon out of the
  AppImage's desktop file, it fell back to Electron's own default logo
  instead of Fetch Terminal's icon. Pointed the `BrowserWindow` at the
  same source icon used for the packaged build's icon set.

## [0.19.0] - 2026-08-01

A pre-1.0 security and code-quality pass: dependency audit, hardening, and
dead-code cleanup, ahead of the first stable release.

### Security

- Bumped Electron `33.4.11` → `43.2.0` and electron-builder `25.x` → `26.15.3`,
  closing every advisory `npm audit` flagged (13 total, one critical) —
  the app was several Electron majors behind, each carrying its own set
  of fixed CVEs (use-after-frees, an ASAR integrity bypass, a command-line
  switch injection issue, and more).
- Restricted `shell.openExternal` to `http:`/`https:` URLs only, both for
  in-app navigation attempts and the terminal's own link detection.
  Terminal output isn't fully trusted input (it can come from an SSH
  session or `curl`'d text), and `shell.openExternal` on an arbitrary
  scheme has a real history as an OS-level code-execution vector, not
  just "opens a browser."
- Added a 5-attempt lockout (30 seconds) on the vault PIN, on top of the
  existing scrypt hashing and constant-time comparison — makes scripted
  PIN guessing pointless rather than merely slow.
- All local data files (snippets, history, settings, the credential
  vault) are now `chmod 600`, not just the credential vault file.
- Fixed a latent stored-XSS-shaped bug: the update button and generic
  icon+label buttons built their markup via `innerHTML` string
  interpolation, including the update version string — which ultimately
  comes from GitHub release metadata, external data. Content-Security-Policy
  already blocked inline-script execution here, but the pattern itself
  was wrong; rebuilt both via `textContent`-based DOM construction so
  there's nothing to inject in the first place.
- Fixed a script-injection pattern in the release GitHub Actions workflow:
  workflow-dispatch input and step outputs were substituted directly into
  shell `run:` blocks via `${{ }}`, the standard vector for smuggling
  shell metacharacters into a CI job that holds `GITHUB_TOKEN`. Every
  such value now passes through `env:` first.

### Removed

- Two unused SVG icons (`key`, `restore`) that were never referenced
  anywhere.
- Dead window-maximize-state plumbing (`window:state` IPC broadcast, the
  `.maximized` body class, and the unused `window:is-maximized` handler)
  left over from the rounded-corners attempt — the CSS rule that read
  that class no longer exists.

## [0.18.0] - 2026-08-01

### Changed

- Reverted rounded window corners back to a plain square window. Real
  per-pixel window transparency on Linux only works if a compositing
  window manager is actually running, and across the range of desktops
  this app targets — Mint's Cinnamon/Xfce/MATE spins among them — that's
  often off or unavailable. Without it, the window comes back fully
  opaque and square regardless of any CSS, so the rounded outline just
  drew over a still-square backdrop rather than clipping it: worse than
  square, since now it looked broken. `transparent: true` and the two
  Linux command-line switches added while chasing this are removed; the
  window is back to the exact plain, solid-background approach used
  before this was attempted, which works identically on every desktop.

## [0.17.0] - 2026-08-01

### Fixed

- Rounded corners were still square underneath: `enable-transparent-visuals`
  gives the window an alpha channel, but on Linux, Chromium's
  GPU-accelerated compositing path doesn't actually deliver that alpha to
  the window server — only its software/CPU compositing path does.
  Without disabling GPU compositing, the CSS border-radius outline drew
  correctly while the window surface underneath it stayed fully opaque
  and square. Added `app.disableHardwareAcceleration()` alongside the
  existing switch (Linux only).

## [0.16.0] - 2026-08-01

### Removed

- Cut (`Ctrl+Shift+X` and the right-click "Cut" entry). In practice a
  terminal is a real, live shell session, not an editable text buffer —
  even with correct cursor/selection math, "cutting" from the middle of
  a line means editing text that a real running line editor (readline,
  zsh's zle, etc.) already owns, and every extra layer of assumptions
  about shell/line-editor behavior is another way to get it subtly
  wrong. Copy and Paste remain exactly as they were.

### Fixed

- Rounded corners still showed a hard square edge behind the rounded
  outline: `html` and `body` shared the exact same opaque background
  color. `body` is what actually clips to the border-radius — `html`
  is the full, uncropped, perfectly square window rect underneath it,
  so it painted straight through the four corner slivers that `body`'s
  radius cuts away. Made `html` transparent and left the real background
  only on `body`, so those slivers now show whatever's behind the window
  instead of a flat color.

## [0.15.0] - 2026-08-01

### Fixed

- Mid-line cut still didn't work in 0.14.0: xterm.js's own TypeScript
  declarations claim `getSelectionPosition()` returns 1-based
  coordinates, but the actual implementation returns them already
  0-based. The extra `-1` conversion silently made the row comparison
  fail every time, so cut never actually removed anything, anywhere on
  the line — verified end-to-end against a real shell and fixed.

### Added

- Click anywhere on the current input line to move the cursor there
  (like clicking to place your cursor in any normal text field), instead
  of only being able to type at the end of the line. Works by sending
  exactly enough Left/Right arrow keypresses to walk the shell's own
  line editor to the clicked column.

## [0.14.0] - 2026-08-01

### Fixed

- Rounded corners still showed black squares poking out past the rounded
  outline: `transparent: true` alone isn't enough on Linux/GTK — without
  an explicit alpha `backgroundColor` on the `BrowserWindow`, the native
  surface paints opaque black anywhere the page's own CSS doesn't
  explicitly cover, including the four corners clipped off by
  `border-radius`. Added `backgroundColor: '#00000000'`.
- Cut could previously only remove text from the very end of the current
  input line (an exact-suffix check against the app's own best-effort
  input tracking). Rewrote it to read xterm's real selection and cursor
  positions directly: it now cuts anywhere on the current input line, not
  just the end, by moving the cursor to the selection, backspacing away
  exactly that span, and returning the cursor to its correct logical
  position afterward. Selections on any other row (already-run output)
  still fall back to copy-only, since that can't be safely un-printed.

## [0.13.0] - 2026-08-01

### Fixed

- Rounded window corners weren't appearing at all on Linux: Electron's
  `transparent: true` needs the `--enable-transparent-visuals` Chromium
  switch on Linux, or the window surface never gets an alpha channel and
  renders fully opaque/square regardless of any CSS. Added the switch.
- Right-click Copy/Cut silently did nothing on a selected terminal string:
  xterm.js clears its own selection on `mousedown` (any button) before the
  app's `contextmenu` listener ever runs. Fixed by snapshotting the
  selection in a capture-phase `mousedown` listener, which runs first.
- `Ctrl+Shift+X` / right-click Cut now actually cuts instead of just
  copying: if the selected text is still sitting unsubmitted at the end of
  the current input line, it's removed from the terminal (via backspaces)
  after being copied. Historical output, mid-line text, and multi-line
  selections still fall back to copy-only, since there's no safe way to
  "un-print" text the shell has already processed.

### Changed

- Rounder corners throughout: bumped the `--radius-sm/md/lg` design
  tokens and the window's own corner radius for a more pronounced rounded
  look, per feedback that the previous radius was too subtle to notice.

## [0.12.0] - 2026-08-01

A full security and code-quality pass: audited every IPC handler, the
password vault, clipboard handling, and the Content-Security-Policy;
removed everything that wasn't earning its place.

### Fixed

- Copy/paste double-fired: returning `false` from xterm's key handler
  only stops xterm's own handling, not the browser's native paste
  action on the same keypress (xterm's hidden textarea has its own
  native paste listener) — `Ctrl+Shift+V` was pasting the clipboard
  twice. Now calls `preventDefault()` explicitly.
- Vault PIN comparison used `===` on hash strings instead of a
  constant-time comparison — switched to `crypto.timingSafeEqual`.

### Added

- `Ctrl+Shift+X` (Cut) and a Cut entry in the terminal's right-click
  menu, alongside Copy/Paste. Behaves the same as Copy, since a
  terminal selection is historical output rather than editable text
  with something to actually remove.
- Password vault file (`credentials.json`) is now `chmod 600` after
  every write — defense in depth restricting it to the owning user
  even on a shared multi-user machine, on top of the existing
  encryption and PIN gate.

### Changed

- Tightened the Content-Security-Policy: removed `unsafe-inline` from
  `script-src` (nothing in the app uses inline scripts, so this was
  pure unused attack surface) and split it from `style-src`, which
  still needs it because xterm.js injects its own `<style>` elements
  internally.
- Removed `@xterm/addon-search` — it was loaded into every terminal
  but never actually used (command history search is a separate,
  custom modal, not xterm's own search) — along with a chunk of
  genuinely dead CSS left over from an earlier autocomplete-UI
  iteration.

## [0.11.2] - 2026-08-01

### Fixed

- Unlocking the sidebar only made it auto-collapse after running a
  snippet — typing directly into the terminal didn't trigger it at
  all, so an unlocked sidebar could sit open indefinitely. It now
  collapses the moment you type anything into the terminal too, same
  as running a snippet already did.

## [0.11.1] - 2026-08-01

### Fixed

- Tooltips could get silently clipped by the sidebar's scrolling
  panels — any tooltip nested inside an `overflow: hidden`/`auto`
  container gets cut off the moment it needs to extend past that
  container's edge or top, which a CSS-only tooltip can't avoid.
  Tooltips are now rendered at the document level and positioned in
  JS, so they're never clipped regardless of which panel they're
  triggered from, and flip below instead of above when there isn't
  room.

### Added

- Capped tabs at 4 open at once — a 5th tab was starting to get
  visually cut off by the titlebar's brand/logo area. The "+" new-tab
  button disables itself (with an explanatory tooltip) once the limit
  is reached.

- Rounded window corners with a subtle shadow, using window
  transparency (needs a compositing desktop; falls back to square
  corners otherwise, without breaking anything). Corners square off
  automatically while maximized.

### Changed

- Titlebar split into two side-by-side regions instead of one bar the
  tabs seemed to float over the sidebar's top: a left column (the same
  width as the sidebar panel) holding the toggle/search/lock, flush
  with the top of the window, and a right region where the tab strip
  begins. The toggle button stays reachable outside the collapsible
  part even when the sidebar is hidden.

## [0.10.1] - 2026-08-01

### Fixed

- Snippet list picked up the same `overflow-x` bug already fixed for the
  password list (`overflow-y: auto` alone silently promotes the other
  axis to `auto` too) — the always-present edit-button tooltip now
  triggers it, so it needed the same explicit `overflow-x: hidden`.
- Snippet row's edit pencil sat noticeably farther from the panel edge
  than the password row's — tightened its right-side padding to match.

## [0.10.0] - 2026-08-01

### Added

- Geist (SIL Open Font License) bundled directly in the app as the UI and
  monospace font, replacing Roboto/Roboto Mono. Loaded from local files
  only — no CDN, no Google Fonts, no network dependency of any kind
  beyond checking GitHub for updates.
- Right-click context menu in the terminal (Copy/Paste).
- A subtle 1px outline around the whole app window, using the same
  outline color as the sidebar/titlebar dividers — with `frame: false`
  there's no OS-drawn window border, so without this the app edge was
  invisible against a similarly dark desktop.

### Changed

- Copy/paste shortcuts moved to `Ctrl+Shift+C`/`Ctrl+Shift+V`. Plain
  `Ctrl+C`, `Ctrl+V`, and `Ctrl+X` are untouched now and always keep
  their normal terminal meaning (interrupt, etc.) — the previous
  behavior (`Ctrl+C` copying when there was a selection) is reverted.
- Tooltips app-wide redesigned: removed the accent-colored border
  from the last pass and converted every remaining native
  browser tooltip to the same style, so the whole app is now
  consistent — a small translucent panel with a subtle outline,
  rather than a solid highlight-colored box.
- Password rows: click the row itself to type the password into the
  active terminal (same interaction as clicking a snippet), instead of
  a separate "type" button. The pencil icon (same style as the snippet
  editor) opens an edit view to rename it or set a new password
  (existing password still can't be viewed — only replaced). Delete
  moved into that edit view, keeping its two-click confirmation.
- Snippet command text now matches the name's font size instead of
  being smaller; the name stays bold, the command stays regular weight.

## [0.9.2] - 2026-08-01

### Fixed

- The snippet edit (pencil) icon was `display: none` until a
  pixel-perfect hover, which removed it from layout entirely — it's
  now always present at low opacity (full opacity on hover) so it
  always reserves its own space and the command text can never render
  where it sits.
- The password list's horizontal scrollbar: `#credential-list` had
  `overflow-y: auto` with no explicit `overflow-x`, and CSS silently
  promotes a `visible` axis to `auto` when the other axis isn't
  `visible` — set `overflow-x: hidden` explicitly.

### Changed

- The password row's "type into terminal" (key) button now has a
  filled colored background at rest instead of a bare icon, so it
  reads clearly as a button.

## [0.9.1] - 2026-08-01

### Changed

- Password vault row buttons now have clear hover tooltips explaining
  what each does (the key icon names which password it types; the X
  says "Delete").
- Deleting a saved password now requires a second click on "Click
  again to delete" (auto-reverting after a few seconds), matching the
  "Reset all data" confirmation pattern, instead of deleting
  immediately on the first click.

## [0.9.0] - 2026-08-01

### Added

- `Ctrl+C` copies the terminal's selection instead of sending an
  interrupt signal, but only when there's actually a selection — with
  nothing selected it still interrupts a running command as usual.
  `Ctrl+V` always pastes.

### Changed

- Sidebar is locked open by default now, instead of auto-collapsing
  after running a snippet unless you'd pinned it.
- "+ New snippet" moved above the Passwords section instead of being
  grouped with Import/Export/branding in the footer.
- Import, Export, and Reset are now one row of small buttons instead
  of Reset standing alone as a larger, more prominent one.
- Reset no longer pops a native confirmation dialog — clicking it
  turns it into a "Confirm?" button that has to be clicked again
  (auto-reverting after a few seconds), so it stays a deliberate,
  low-visibility action instead of something you'd trigger by accident
  or use often.
- Tooltips (the update status dot, and now the Light/Dark/Auto theme
  buttons too) restyled away from a flat, solid-accent-color box into a
  darker panel with a subtle accent-colored left border — reads as a
  proper tooltip instead of a colored block.

## [0.8.1] - 2026-08-01

### Fixed

- The update status dot's error tooltip always showed a generic "Update
  check failed" with no detail, even though the actual reason (network
  error, rate limit, etc.) was already available — it just wasn't
  passed through to the tooltip. Now shown inline so a failed check is
  actually diagnosable from the UI instead of a dead end.

## [0.8.0] - 2026-08-01

### Added

- PIN-protected password vault: save a password once (encrypted via the
  OS keyring through Electron's `safeStorage`) and click a button to
  type it into the active terminal whenever a prompt asks for it.
  Write-only by design — a saved password can never be viewed or
  exported again, only used or deleted. A separate vault PIN (distinct
  from encryption at rest, which alone doesn't stop someone else using
  an already-unlocked computer) gates every use of the vault and
  auto-locks after 5 minutes idle.
- "Reset all data" button in the sidebar footer, for clearing every
  snippet, history entry, saved password, and setting on demand — since
  an AppImage has no uninstall hook to do this automatically when the
  file is deleted.

### Fixed

- The sidebar's search box could overflow past the panel's right edge
  and push the lock icon out past the visible border, because it was
  missing `min-width: 0` on a flex child — a classic flexbox bug where
  an item won't shrink below its content's natural width. No amount of
  padding could have fixed the symptom without this.

## [0.7.1] - 2026-08-01

### Changed

- Replaced the OS-native tooltip on the update status dot with a
  modern rounded one styled in the current accent color.
- Sidebar header spacing adjusted again: the lock icon was sitting
  flush against the very edge of the panel with no breathing room —
  it now has a small inset instead, with the search box still filling
  the rest of the width up to it.

## [0.7.0] - 2026-08-01

### Changed

- Merged the separate theme toggle and accent color buttons into one
  "Appearance" popover in the titlebar. It now has an explicit
  Light/Dark/Auto theme selector (Auto follows the desktop's setting —
  previously only reachable as an unlabeled default, with no way back
  to it once you'd toggled light/dark) above the accent color swatches.
- Reduced the accent color palette from 15 back down to 10 hues (Red,
  Orange, Amber, Green, Teal, Cyan, Blue, Indigo, Purple, Pink),
  dropping the ones added later that were too close to a neighbor to
  tell apart at a glance.
- Documented the update system and the new appearance popover in the
  README.

## [0.6.4] - 2026-08-01

### Fixed

- Update downloads were failing: the release's `latest-linux.yml`
  pointed at a hyphenated filename, but GitHub renames uploaded
  assets with spaces in them by replacing the spaces with dots, so the
  two never matched. Build output is now named without spaces
  (`Fetch-Terminal-<version>.AppImage`) so the filenames agree.

### Added

- The app now re-checks for updates automatically every 30 minutes
  while running, in addition to the check at startup.

## [0.6.3] - 2026-08-01

### Changed

- Default accent color changed from Deep Purple to Blue for new
  installs (existing saved choices are unaffected).

## [0.6.2] - 2026-08-01

### Changed

- Sidebar header spacing tightened so the lock icon sits flush against
  the panel's edge, with the search box filling the rest of the width
  up to it.

## [0.6.1] - 2026-08-01

### Changed

- Sidebar search box goes back to filling the full width of the panel
  beside the lock icon, instead of a fixed short width.
- The "Fetch Terminal" name and version in the sidebar footer now link
  to the GitHub repository.

### Added

- A small status dot next to the version number always shows the
  update state: green for up to date, red for an update available (or
  downloaded and ready to install), gray while checking or if the last
  check failed. Hovering it shows the detail; clicking it re-checks for
  updates on demand.

## [0.6.0] - 2026-08-01

### Added

- Automatic update check against GitHub Releases on startup (packaged
  builds only), with an "Update to vX.Y.Z" button in the sidebar footer
  when a newer release is available. Clicking it downloads the update in
  the background, then switches to "Restart & install update" to swap in
  the new AppImage.

## [0.5.1] - 2026-08-01

### Changed

- Sidebar: replaced the pin icon with the standard lock/unlock icon,
  always shown in the accent color, and shortened the search box so it
  sits clearly beside it instead of crowding it out.
- The terminal's ANSI "green" slot (what most distros' default shell
  prompt uses for `user@host`) now follows the accent color too, so the
  prompt reads in the same hue as the rest of the app.
- Expanded the accent color picker from 10 to 15 Material Design colors
  (added Deep Orange, Yellow, Lime, Light Blue, and Deep Purple).
- Import/Export are now small, neutral-gray buttons instead of
  accent-filled ones, so "+ New snippet" reads as the one primary action.

## [0.5.0] - 2026-08-01

### Added

- Accent color picker: a palette button in the titlebar opens a popover
  with 10 Material Design colors (Purple, Indigo, Blue, Cyan, Teal, Green,
  Amber, Orange, Red, Pink). Picking one re-themes the whole app instantly
  — buttons, the active tab indicator, icons, and the terminal's cursor/
  selection color — with correctly-computed light and dark tonal variants
  for each hue. The choice is remembered across restarts.

## [0.4.1] - 2026-08-01

### Fixed

- Dropped the gradient/glow styling from 0.4.0 — gradients and colored
  glow shadows aren't part of Material Design's visual language, however
  modern they looked. Replaced with a genuine flat Material Design 3
  multi-key-color scheme: a violet primary, a muted violet-grey secondary,
  and a warm coral tertiary (used for the SSH snippet badge). Buttons, the
  active tab indicator, and the brand text are now solid colors; button
  hover/active states use M3's elevation-based feedback instead of a
  colored glow. Regenerated the app icon as a flat solid mark to match.

## [0.4.0] - 2026-08-01

### Changed

- Full redesign, still Material Design 3 underneath but with a modern
  violet-to-teal gradient accent replacing the flat single-color palette
  (chosen to stand out from typical flat dark-themed dev tools).
- Titlebar reworked: the sidebar hide/unhide toggle now lives in the tab
  row (with a clear pressed/active state) instead of floating over the
  terminal; the "Fetch Terminal" name moved to sit beside the minimize
  button, rendered in the accent gradient.
- The active tab is now clearly distinguished with a glowing gradient
  underline and a raised background, instead of a thin single-color line.
- Replaced every emoji/Unicode glyph in the UI with a small, consistent,
  hand-drawn local icon set (`src/icons.js`) in a minimal single-stroke
  style — no icon fonts, no CDN, nothing fetched over the network, ever.
- The sidebar pin button uses a proper pin icon (filled when pinned) next
  to the search box.
- Added "Fetch Terminal v<version>" under the Import/Export buttons.
- Added a light/dark theme toggle in the titlebar. The app follows the
  desktop's theme by default (via Electron's `nativeTheme`); the toggle
  forces light or dark and the choice is remembered across restarts. Both
  the UI and the terminal's ANSI color theme now have full light and dark
  variants.
- Regenerated the app icon with the new gradient mark.
- Packaging: dropped the `.deb` target — AppImage only, since the app now
  targets any Linux desktop, not just Debian/Ubuntu-based ones. Added an
  `afterAllArtifactBuild` hook (`scripts/move-to-downloads.js`) that moves
  the built AppImage into `~/Downloads` automatically.

## [0.3.0] - 2026-08-01

### Changed

- Rebuilt the theme on proper Material Design 3 dark-scheme tokens: `primary`
  (`#FBC711`)/`on-primary`, `primary-container`/`on-primary-container`,
  `outline`/`outline-variant`, and `error`/`error-container` roles, plus
  surface elevation levels 1-5 tinted with the primary color at M3's
  standard dark-theme overlay opacities (5/8/11/12/14%) instead of flat
  surface colors.
- Filled buttons (New snippet, Import, Export, Save) now use a solid
  `#FBC711` fill with dark text, matching Material's Filled Button style;
  destructive actions keep the distinct error/tonal treatment Material
  reserves for them.

## [0.2.0] - 2026-08-01

### Changed

- Reworked the color palette to a navy-and-gold theme (`#10141C` background,
  `#19212B` surfaces, `#FBC711` accent), replacing the original purple
  Material palette across the UI, the terminal's ANSI color theme, and the
  generated app icon.

## [0.1.0] - 2026-08-01

### Added

- Initial release of Fetch Terminal: a lightweight, standalone Electron
  terminal emulator for Linux desktop with no GTK or Qt dependency.
- Tabs running the user's default shell via `node-pty`.
- Custom, frameless Material-style UI drawn entirely in HTML/CSS, consistent
  across desktop environments.
- Scrollable, searchable command history (`Ctrl+Shift+F`).
- Inline autocomplete that suggests previously-typed commands as you type
  (accept with `Tab` or `→`).
- Collapsible sidebar of snippets — saved shell commands, including SSH
  one-liners, that run instantly in the active tab when clicked. Includes a
  live filter box, a pin/lock to keep the sidebar open, and Markdown
  export/import for backup and sharing.
- Packaging via `electron-builder`: AppImage and `.deb` targets, with a
  generated application icon.
- README, CHANGELOG, and SECURITY documentation.

[Unreleased]: https://github.com/fosscharlie/fetch-terminal/compare/0.12.0...HEAD
[0.12.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.11.2...0.12.0
[0.11.2]: https://github.com/fosscharlie/fetch-terminal/compare/0.11.1...0.11.2
[0.11.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.11.0...0.11.1
[0.11.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.10.1...0.11.0
[0.10.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.10.0...0.10.1
[0.10.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.9.2...0.10.0
[0.9.2]: https://github.com/fosscharlie/fetch-terminal/compare/0.9.1...0.9.2
[0.9.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.9.0...0.9.1
[0.9.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.8.1...0.9.0
[0.8.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.8.0...0.8.1
[0.8.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.7.1...0.8.0
[0.7.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.7.0...0.7.1
[0.7.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.6.4...0.7.0
[0.6.4]: https://github.com/fosscharlie/fetch-terminal/compare/0.6.3...0.6.4
[0.6.3]: https://github.com/fosscharlie/fetch-terminal/compare/0.6.2...0.6.3
[0.6.2]: https://github.com/fosscharlie/fetch-terminal/compare/0.6.1...0.6.2
[0.6.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.6.0...0.6.1
[0.6.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.5.1...0.6.0
[0.5.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.5.0...0.5.1
[0.5.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.4.1...0.5.0
[0.4.1]: https://github.com/fosscharlie/fetch-terminal/compare/0.4.0...0.4.1
[0.4.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/fosscharlie/fetch-terminal/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/fosscharlie/fetch-terminal/releases/tag/0.1.0
