# Architecture

This document is a readable overview of how Abyss is structured. For the full
contributor rules and step-by-step recipes ("How to add an agent", "How to add
an IPC channel", …) see [CLAUDE.md](CLAUDE.md). For installation and usage see
[README.md](README.md).

---

## High-level overview

Abyss is an **Electron** desktop app. It runs two separate JS environments that
can never share memory directly:

| Process | Runs | Responsibilities |
| --- | --- | --- |
| **Main** | Node.js | Window lifecycle, security (CSP), IPC handlers, disk IO via `core/` |
| **Renderer** | Chromium | React UI — no Node globals, no direct FS access |

The two processes communicate through a single, typed bridge — see [IPC](#ipc)
below.

---

## Directory layout

```
core/                     Node-only config IO (fs/os/path).
                          Reused by the main process AND the abyss CLI.
electron/
  main.ts                 Window creation, security policy, lifecycle, IPC wiring.
  preload.ts              Exposes ONLY window.abyss.invoke (typed) to the renderer.
  ipc/*.ipc.ts            Handler groups, one file per domain (fs / agent / config / …).
cli/index.ts              `abyss` CLI (detect / export / apply) — reuses core/.
src/
  shared/
    types/                Pure TS types: agent, theme, ipc, config.
                          No Node, no React — safe to import from either side.
    agents/defs.ts        Framework-agnostic agent definitions (ids, paths, files).
    ipc/ipc.client.ts     Typed renderer wrappers over window.abyss.invoke.
    components/ui/        shadcn/ui component copies — do not edit by hand.
  features/<name>/        One directory per feature (agents, config, mcp, hooks,
                          themes, settings, activity, …). Each is self-contained:
                          adapters / components / hooks / store / pages.
  app/                    Shell: React Router, layout (sidebar + top bar +
                          status bar), Cmd+K command palette.
```

---

## IPC — the only bridge

```
Renderer (React)
   │
   │  ipc.someCall(payload)          ← src/shared/ipc/ipc.client.ts
   │  window.abyss.invoke(channel, payload)
   ▼
Preload script (contextBridge)       ← electron/preload.ts
   │
   │  ipcRenderer.invoke(channel, payload)
   ▼
Main process handler                 ← electron/ipc/*.ipc.ts
   │  handle(IpcChannel.X, async (payload) => { … })
   ▼
core/                                ← shared Node-only logic
```

Every channel is declared in the `IpcChannel` enum
(`src/shared/types/ipc.ts`) with a matching `{ request; response }` entry in
`IpcMap`. The TypeScript compiler enforces that payload and return types match
end-to-end — raw `ipcRenderer` calls and untyped channels are forbidden.

---

## Agent adapter pattern

Each supported agent is a small **adapter** (one file) built on a shared
`AgentDefinition` (id, display names, icon, capabilities, config-file paths).
A central **registry** is the only place that knows which adapters exist.

Adding a new agent is four steps: definition → adapter → register → theme
preset. The switcher, sidebar, command palette, theming, config editor and
`abyss detect` all pick it up automatically. See [CLAUDE.md](CLAUDE.md) for the
recipe.

---

## Config IO (`core/`)

`core/` is the single source of truth for reading and writing agent config on
disk. It is imported by both the Electron main process (via IPC handlers) and
the `abyss` CLI, so any logic added there is available to both.

Key modules:

| Module | Purpose |
| --- | --- |
| `agent-paths` | Auto-detect where each agent stores its config |
| `config-io` | Read / write instruction files (atomic temp + rename) |
| `claude-settings` | Permissions, model, env — shared `~/.claude.json` handling |
| `mcp` | MCP server config read/write |
| `bundle` | Export / apply config bundles |
| `settings-store` | Abyss's own persisted settings |

Writes are **atomic** (write to a temp file then rename) and
**non-destructive** (unknown keys in shared files like `~/.claude.json` are
preserved).

---

## Theming

Every color in the UI is a CSS custom property (semantic token:
`--color-background`, `--color-primary`, …). Components reference these through
Tailwind utility classes (`bg-background`, `text-primary`, `border-border`, …)
generated via `@theme inline` in `src/index.css`. Hard-coded hex values are
forbidden.

At runtime, `useThemeApplier` writes a chosen `ThemeConfig`'s `light` or
`dark` palette onto the document root. Theme switches are instantaneous — no
reload needed.

Built-in theme presets live under `src/features/themes/presets/`. Adding a new
theme is a single `ThemeConfig` file plus one line in `presets/index.ts`.

---

## Tech stack summary

| Layer | Choice |
| --- | --- |
| Desktop shell | Electron 42 |
| UI framework | React 19 + TypeScript (strict) |
| Build | Vite 8 + `vite-plugin-electron` |
| UI components | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS v4 (CSS-first, `@theme inline`) |
| State | Zustand (with `persist` where appropriate) |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| IPC | Single typed `invoke` bridge (`IpcChannel` / `IpcMap`) |
| Packaging | electron-builder (AppImage / NSIS + portable) |
| Package mgr | pnpm |

---

For the full contributor rules, invariants, and step-by-step recipes, read
[CLAUDE.md](CLAUDE.md).
