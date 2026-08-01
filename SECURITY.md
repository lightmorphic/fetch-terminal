# Security Policy

## Supported Versions

Fetch Terminal is a young project without long-term support branches. Only
the most recently released version receives security fixes.

| Version   | Supported |
| --------- | --------- |
| Latest release | ✅ |
| Older releases | ❌ |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private reporting feature: go to the
[Security tab](https://github.com/fosscharlie/fetch-terminal/security) of
this repository and click **"Report a vulnerability"**. Include:

- A description of the issue and its potential impact
- Steps to reproduce (a minimal snippet, command, or config is ideal)
- The affected version/commit

You should get an acknowledgement within a few days. Once a fix is ready,
it will ship in a new release and the advisory will be credited to you
unless you ask to stay anonymous.

## Scope notes

Fetch Terminal runs your shell locally via `node-pty` inside an Electron
window that only ever loads its own bundled, local UI — it never loads
remote or third-party web content, and the renderer runs with Node
integration enabled on that basis (see "Node integration" below for why
that's an accepted tradeoff rather than an oversight). Snippets, command
history, and settings are stored only in your local user-data directory
and are never transmitted anywhere.

Because clicking a snippet runs its command immediately in your active
terminal, treat every snippet (your own or imported from someone else) with
the same care you'd give a command you're about to type yourself — this
includes SSH one-liners, which can connect to and execute commands on a
remote host.

### Password vault threat model

Saved passwords are encrypted at rest via Electron's `safeStorage` (backed
by your OS's own keyring/Secret Service), and the underlying value is never
sent back to the renderer once saved — only used (typed into the active
terminal) or deleted, never displayed. That encryption is what actually
protects the ciphertext on disk; the separate vault PIN is a UI-level gate
on top of it, specifically against someone else at your already-unlocked
computer clicking through the app, and it auto-locks after 5 minutes idle.
It is not a substitute for full-disk encryption or locking your session —
anyone who can already run code as your OS user account has the same
access to the keyring your session does, PIN or not.

The PIN itself is scrypt-hashed (never stored or compared in plaintext),
checked with a constant-time comparison, and locked out for 30 seconds
after 5 wrong attempts in a row — not a cryptographic barrier against a
determined local attacker (see above), but enough to make casual or
scripted guessing pointless.

### Node integration

The renderer runs with `nodeIntegration: true` and `contextIsolation: false`
— full Node.js access from the same process that renders the UI. That's
normally a real risk in Electron apps, because it means any content able to
run script in that renderer effectively has full access to your machine.
It's an acceptable tradeoff here specifically because the renderer never
loads anything except this app's own bundled `index.html`: no remote pages,
no `<iframe>`, no `window.open` into arbitrary content, no `webview`. Every
navigation attempt and every `window.open` call is intercepted and only
ever handed to your OS's default browser (`shell.openExternal`), and only
if it's a plain `http:`/`https:` URL — arbitrary schemes are dropped, since
`shell.openExternal` on an unusual scheme has a real history as an
OS-level code-execution vector in its own right, not just "opens a
browser." That scheme check matters because a terminal's output isn't
fully trusted input: an SSH session or a `curl`'d page can print a
URL-shaped string, the built-in link detection will offer to open it, and
that string came from wherever you're connected to, not from this app.

### File permissions

Every file this app writes to your local user-data directory (snippets,
history, settings, the encrypted password vault) is created `chmod 600` —
readable and writable only by your own user account, even on a shared
multi-user machine.

### Content-Security-Policy

`src/index.html` sets a CSP with `default-src 'self'` and `script-src
'self'` — no inline scripts, no remote script or style origins, nothing
fetched from a CDN. (`style-src` keeps `'unsafe-inline'` because xterm.js
injects its own `<style>` elements internally; there's no way around that
without patching the library.) The only network access the app ever makes
at all is an update check against GitHub Releases (see the README).

### Supply chain

Dependencies are kept on current major versions and checked with `npm
audit` before every release — Electron and electron-builder in particular
receive frequent security advisories, so this project doesn't sit on old
majors for compatibility's sake. The GitHub Actions release workflow
(`.github/workflows/release.yml`) that builds and publishes each AppImage
never substitutes any externally-influenced value (workflow inputs, prior
step outputs) directly into a shell `run:` block — everything goes through
`env:` first, which is the standard fix for GitHub Actions' script-injection
class of bug, where `${{ }}` template substitution happens as plain text
before the shell ever runs.
