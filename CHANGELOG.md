# Changelog

All notable changes to Abyss will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note:** Abyss was developed iteratively with frequent releases. Detailed
> history for earlier versions lives in the Git log (`git log --oneline`). This
> file tracks changes from the current release forward.

---

## [Unreleased]

_Nothing yet._

---

## [1.64.35] - 2026-06-14

### Added

- Unified visual configuration UI for multiple AI coding agents (Claude Code,
  OpenAI Codex, Gemini CLI, Cursor, GitHub Copilot CLI, Windsurf, Continue,
  Aider, Cline).
- Per-agent themed UI with light/dark palettes; theme switches apply with no
  reload.
- Typed IPC bridge (`IpcChannel` / `IpcMap`) between the Electron main process
  and the renderer — the only communication channel, enforced at compile time.
- `core/` shared config-IO layer (agent-path detection, atomic writes, MCP,
  hooks, permissions, model & env) reused by both the GUI and the `abyss` CLI.
- `abyss` CLI (`detect` / `export` / `apply`) sharing the exact same engine as
  the app.
- Cmd/Ctrl+K command palette for navigating to any agent, page or theme.
- No-code Theme Builder with live preview.
- Diff preview before any config file is written; atomic saves that never leave
  a half-written config.
- GitHub Releases auto-update support.

[Unreleased]: https://github.com/Fxbixn03/Abyss/compare/v1.64.35...HEAD
[1.64.35]: https://github.com/Fxbixn03/Abyss/releases/tag/v1.64.35
