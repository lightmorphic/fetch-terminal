# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/fosscharlie/fetch-terminal/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/fosscharlie/fetch-terminal/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/fosscharlie/fetch-terminal/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/fosscharlie/fetch-terminal/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fosscharlie/fetch-terminal/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/fosscharlie/fetch-terminal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/fosscharlie/fetch-terminal/releases/tag/v0.1.0
