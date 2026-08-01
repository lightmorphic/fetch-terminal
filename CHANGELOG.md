# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/fosscharlie/fetch-terminal/compare/0.10.0...HEAD
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
