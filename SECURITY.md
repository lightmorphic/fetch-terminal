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
integration enabled on that basis. Snippets and command history are stored
only in your local user-data directory and are never transmitted anywhere.

Because clicking a snippet runs its command immediately in your active
terminal, treat every snippet (your own or imported from someone else) with
the same care you'd give a command you're about to type yourself — this
includes SSH one-liners, which can connect to and execute commands on a
remote host.
