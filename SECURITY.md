# Security Policy

## Supported versions

Only the **latest release** receives security fixes. If you are running an older
version, please upgrade before reporting a vulnerability.

| Version | Supported |
| --- | --- |
| Latest (`1.64.x`) | Yes |
| Older releases | No |

## Reporting a vulnerability

**Please do not file public GitHub issues for security vulnerabilities.**

Use GitHub's built-in
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
for this repository. This keeps details confidential until a fix is ready and
allows coordinated disclosure.

What to include in your report:

- A clear description of the vulnerability and its potential impact.
- Steps to reproduce (or a proof-of-concept if applicable).
- The Abyss version and your operating system.

We will acknowledge the report within a few business days and aim to provide a
fix or mitigation timeline as quickly as the severity warrants.

## Security design of Abyss

Abyss is a **local desktop application**. It has no backend server and makes no
outbound network requests on your behalf (auto-update checks aside). The threat
model is therefore primarily about protecting the integrity of the agent config
files it reads and writes.

Key measures built into the architecture:

- **Typed IPC only.** The renderer (Chromium) and the main process (Node.js)
  communicate exclusively through a single typed bridge
  (`window.abyss.invoke`). Raw `ipcRenderer` calls and untyped channels are
  forbidden by design and enforced at compile time via `IpcChannel` / `IpcMap`.
- **No Node in the renderer.** The renderer's TypeScript configuration does not
  expose Node.js globals (`fs`, `path`, `os`, …). All disk access happens in
  the main process (via `core/`) and is surfaced to the renderer only through
  the typed IPC bridge.
- **Content Security Policy.** Abyss sets a strict CSP in the Electron main
  process to mitigate XSS and script-injection risks.
- **Atomic, non-destructive writes.** Config files are written via a temp-file +
  rename pattern. Shared files (e.g. `~/.claude.json`) preserve every key that
  Abyss did not explicitly modify, preventing accidental data loss.

## Scope

In scope for security reports:

- Privilege escalation or sandbox escapes via the IPC bridge.
- Remote code execution or arbitrary file write triggered by malicious config
  content.
- Content Security Policy bypasses.
- Supply-chain issues in direct dependencies.

Out of scope:

- Vulnerabilities in the AI agents themselves (Claude Code, Codex, Gemini CLI,
  …) — report those to the respective vendors.
- Issues that require the attacker to already have write access to the user's
  home directory (Abyss's entire threat surface is within that boundary).
