# Abyss

Abyss is a cross-platform **Electron** desktop app (Windows + Linux) that is a
unified visual configuration UI for AI coding agents — Claude Code, OpenAI
Codex, Gemini CLI and more. It reads and writes the agents' real config files on
disk and presents them through one themed, agent-aware interface.

## Tech stack

| Layer          | Choice                                            |
| -------------- | ------------------------------------------------- |
| Desktop shell  | Electron 42                                       |
| UI framework   | React 18 + TypeScript (strict)                    |
| Build          | Vite 8 + `vite-plugin-electron`                   |
| UI components  | shadcn/ui (Radix primitives) in `shared/components/ui` |
| Styling        | Tailwind CSS v4 (CSS-first, `@theme inline`)      |
| State          | Zustand (with `persist` where it makes sense)     |
| Editor         | CodeMirror 6 (`@uiw/react-codemirror`)            |
| IPC            | Single typed `invoke` bridge (`IpcChannel`/`IpcMap`) |
| Packaging      | electron-builder (AppImage / NSIS + portable)     |
| Package mgr    | pnpm                                              |

## Commands

```bash
pnpm dev          # Vite + Electron in watch mode
pnpm build        # typecheck → vite build → build CLI → electron-builder
pnpm build:dir    # unpacked build (faster, no installer)
pnpm typecheck    # tsc for both app + node projects
pnpm lint         # ESLint (zero warnings allowed)
pnpm format       # Prettier
pnpm cli -- detect # run the abyss CLI in dev (tsx)
```

> Local dev note: pnpm lives at `~/.local/bin/pnpm`; node is v25 locally but CI
> pins **Node 20**. Build-script approvals (electron/esbuild) live in
> `pnpm-workspace.yaml` under `allowBuilds`.

## Architecture map

```
core/                     Node-only config IO (fs/os/path). Reused by main + CLI.
electron/
  main.ts                 Window, security (CSP), lifecycle, IPC wiring
  preload.ts              Exposes ONLY window.abyss.invoke (typed)
  ipc/*.ipc.ts            One handler group per domain (fs / agent / config)
cli/index.ts              `abyss` CLI (detect / export / apply) — reuses core/
src/
  shared/
    types/                Pure types: agent, theme, ipc, config (no Node, no React)
    agents/defs.ts        Framework-agnostic agent definitions (paths, files)
    ipc/ipc.client.ts     Typed renderer wrappers over window.abyss.invoke
    components/ui/         shadcn/ui copies — DO NOT edit by hand
  features/<feature>/      Feature-first: adapters / components / hooks / store / pages
  app/                     Shell: router, layout (sidebar + top bar + status bar), Cmd+K
```

## Architecture rules (do not violate)

1. **Typed IPC only.** Every main↔renderer call goes through `IpcChannel` +
   `IpcMap`. The renderer uses `ipc.*` from `shared/ipc/ipc.client.ts`. Never
   touch raw `ipcRenderer`, and never add an untyped channel.
2. **No Node in the renderer.** `fs`, `path`, `os` etc. live in `core/` and run
   in the main process. The renderer's tsconfig only exposes `vite/client`
   types, so Node globals won't even type-check there. Do disk work in `core/`
   and surface it via an IPC handler.
3. **Feature-first.** Each feature is self-contained under `src/features/<name>/`
   (adapters, components, hooks, store, pages). Cross-feature helpers go in
   `src/shared/`.
4. **Adapter pattern for agents.** Agents implement `AgentAdapter`; the registry
   is the only place that knows which agents exist.
5. **CSS-variable theming.** Components use semantic tokens (`bg-background`,
   `text-primary`, `border-border`, …) — **never hard-coded hex**. Colors are
   driven by CSS custom properties set at runtime by `useThemeApplier`, mapped
   into Tailwind via `@theme inline` in `src/index.css`. Theme switches apply
   with no reload.
6. **TypeScript strict.** No `any`, no `@ts-ignore`. `pnpm lint` must pass with
   zero warnings.

## How to add a new agent

Everything an agent needs is data + one tiny adapter. Example: enabling the
already-written Gemini adapter.

1. **Definition** — add/confirm an `AgentDefinition` in
   `src/shared/agents/defs.ts` (id, names, `defaultThemeId`, `iconName`,
   `capabilities`, `configFiles`, `resolvePaths`). Add its id to
   `ACTIVE_AGENT_IDS`.
2. **Adapter** — one file in `src/features/agents/adapters/<id>.adapter.ts`:
   ```ts
   export const fooAdapter = createAdapter(fooDefinition, {
     icon: 'box',
     validate: validateMarkdownInstructions,
     getSidebarSections: () => [/* optional extra nav */],
   })
   ```
3. **Register** — one line in
   `src/features/agents/registry/agent.registry.ts`:
   `agentRegistry.register(fooAdapter)`.
4. **Theme preset** — add `src/features/themes/presets/<id>.theme.ts` (a
   `ThemeConfig` with `light` + `dark`) and include it in `presets/index.ts`.

That's it — switcher, sidebar, theming, config editor, detection (main + CLI)
and command palette all pick it up automatically.

## How to add a new IPC channel

1. Add the channel to the `IpcChannel` enum (`src/shared/types/ipc.ts`).
2. Add its `{ request; response }` entry to `IpcMap`.
3. Implement it in the matching `electron/ipc/*.ipc.ts` group using the typed
   `handle(IpcChannel.X, …)` helper (it infers payload + return types).
4. Add a wrapper to `ipc` in `src/shared/ipc/ipc.client.ts`.

The compiler enforces that request/response shapes line up end to end.

## How to add a new theme

1. Drop a `ThemeConfig` (with `light` + `dark` palettes, `agentId` or `'*'` for
   a global theme) into a `*.theme.ts` file under
   `src/features/themes/presets/`.
2. Include it in `BUILTIN_THEMES` in `presets/index.ts`.

It appears automatically in the ThemePicker and the command palette.

## Config IO & the shared core

- `core/` is the single source of truth for reading/writing agent config:
  `agent-paths` (detection), `config-io` (instruction files), `claude-settings`
  (permissions + model + env), `mcp`, `settings-store` (Abyss's own settings),
  and `bundle` (export/apply).
- Both the Electron main process and the `abyss` CLI import `core/` — so any
  config logic added there is available to the GUI and the terminal at once.
- File targets per agent are centralized in `core/` and the agent definitions;
  adjust them there if an agent changes its on-disk format.

## Conventions

- Path aliases: `@/*` → `src/*`, `@core/*` → `core/*` (node + CLI only).
- Two tsconfig projects: `tsconfig.app.json` (renderer, browser libs) and
  `tsconfig.node.json` (electron + core + cli).
- Prettier: no semicolons, single quotes, trailing commas.
