# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/fosscharlie/fetch-terminal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fosscharlie/fetch-terminal/releases/tag/v0.1.0
