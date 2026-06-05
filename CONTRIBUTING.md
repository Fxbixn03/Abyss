# Contributing to Abyss

Thanks for taking the time to contribute! Abyss is a cross-platform Electron app
that gives every AI coding agent on your machine one themed configuration UI.
This guide covers how to get set up, the invariants you must keep intact, and how
to get a change merged.

> The deep architecture reference lives in [CLAUDE.md](CLAUDE.md). This document
> is the lighter, day-to-day workflow guide. Read both before a larger change.

---

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Getting set up](#getting-set-up)
- [Project layout](#project-layout)
- [Development workflow](#development-workflow)
- [The non-negotiable rules](#the-non-negotiable-rules)
- [Common recipes](#common-recipes)
- [Coding style](#coding-style)
- [Commits](#commits)
- [Opening a pull request](#opening-a-pull-request)
- [Reporting bugs & requesting features](#reporting-bugs--requesting-features)

---

## Code of conduct

Be kind and constructive. Assume good intent, keep discussion focused on the
code, and help reviewers help you. Harassment of any kind is not welcome.

---

## Ways to contribute

- **Fix a bug** or improve an existing surface (Instructions, MCP, Hooks, …).
- **Add an agent.** This is intentionally tiny; Gemini ships as the worked
  example. See [Add an agent](#add-an-agent).
- **Add a theme.** Drop a preset. No code required for users; one file for
  contributors.
- **Improve docs:** README, CLAUDE.md, inline comments, or this guide.
- **File a good issue.** A clear repro is a real contribution.

If you're planning a larger change, please open an issue first so we can agree on
the approach before you write code.

---

## Getting set up

You need **Node 20+** (CI runs Node 22) and **pnpm**.

```bash
git clone https://github.com/Fxbixn03/Abyss.git
cd Abyss
pnpm install

pnpm dev          # Vite + Electron with hot reload
```

> Build-script approvals (electron / esbuild) are pinned in
> `pnpm-workspace.yaml` under `allowBuilds`. If pnpm asks to approve a build
> script for a new dependency, add it there rather than approving ad hoc.

Run the CLI in dev with:

```bash
pnpm cli -- detect
```

---

## Project layout

```text
core/        Node-only config IO (fs/os/path). Reused by main + CLI.
electron/    Main process: window, security (CSP), lifecycle, typed IPC handlers.
cli/         The `abyss` CLI (detect / export / apply) — reuses core/.
src/
  shared/    Pure types, typed IPC client, agent definitions, UI primitives.
  features/  Feature-first: agents, config, mcp, hooks, themes, settings, …
  app/       Shell: router, layout (sidebar + top bar + status bar), Cmd+K.
```

Each feature is self-contained under `src/features/<name>/`
(adapters / components / hooks / store / pages). Cross-feature helpers live in
`src/shared/`.

---

## Development workflow

```bash
pnpm dev          # run the app (hot reload)
pnpm build:dir    # unpacked build — faster, no installer
pnpm build        # full: type-check → bundle → build CLI → package installer/AppImage
pnpm typecheck    # tsc for both the app and node TS projects
pnpm lint         # ESLint — zero warnings allowed
pnpm format       # Prettier
```

**Before you push, run the same three checks CI runs:**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

CI ([`.github/workflows/build.yml`](.github/workflows/build.yml)) runs lint,
type-check and a full package build on **Ubuntu and Windows**. A PR must be green
on both to merge.

---

## The non-negotiable rules

These are the invariants that keep Abyss safe and maintainable. A PR that breaks
one will be asked to change before review continues.

1. **Typed IPC only.** Every main↔renderer call goes through `IpcChannel` +
   `IpcMap`, and the renderer uses the `ipc.*` wrappers from
   `src/shared/ipc/ipc.client.ts`. Never touch raw `ipcRenderer`; never add an
   untyped channel.
2. **No Node in the renderer.** `fs`, `path`, `os` and friends live in `core/`
   and run in the main process. Do disk work in `core/` and surface it through an
   IPC handler. The renderer's tsconfig won't even type-check Node globals.
3. **Feature-first.** Keep each feature self-contained under
   `src/features/<name>/`. Shared helpers go in `src/shared/`.
4. **Adapter pattern for agents.** Agents implement `AgentAdapter`; the registry
   is the only place that knows which agents exist.
5. **CSS-variable theming.** Use semantic tokens (`bg-background`,
   `text-primary`, `border-border`, …), never hard-coded hex. Theme values
   are CSS custom properties applied at runtime, mapped into Tailwind via
   `@theme inline` in `src/index.css`. Themes must switch with no reload.
6. **TypeScript strict.** No `any`, no `@ts-ignore`. `pnpm lint` must pass with
   zero warnings.
7. **Safe disk writes.** Config IO stays atomic (temp file + rename) and
   non-destructive. Edits to big shared files like `~/.claude.json` must
   preserve every other key and unknown fields.

---

## Common recipes

These mirror the step-by-step guides in [CLAUDE.md](CLAUDE.md); read there for
the full detail.

### Add an agent

1. Add (or confirm) an `AgentDefinition` in `src/shared/agents/defs.ts` and add
   its id to `ACTIVE_AGENT_IDS`.
2. Create one adapter in `src/features/agents/adapters/<id>.adapter.ts` and
   register it in `src/features/agents/registry/agent.registry.ts`.
3. Add a theme preset under `src/features/themes/presets/<id>.theme.ts` and
   include it in `presets/index.ts`.

The switcher, sidebar, command palette, detection (app + CLI) and theming all
pick it up automatically.

### Add an IPC channel

1. Add the channel to the `IpcChannel` enum (`src/shared/types/ipc.ts`).
2. Add its `{ request; response }` entry to `IpcMap`.
3. Implement it in the matching `electron/ipc/*.ipc.ts` group with the typed
   `handle(IpcChannel.X, …)` helper.
4. Add a wrapper to `ipc` in `src/shared/ipc/ipc.client.ts`.

The compiler enforces that request/response shapes line up end to end.

### Add a theme

1. Drop a `ThemeConfig` (with `light` + `dark` palettes, `agentId` or `'*'` for
   a global theme) into a `*.theme.ts` file under
   `src/features/themes/presets/`.
2. Include it in `BUILTIN_THEMES` in `presets/index.ts`.

It appears automatically in the ThemePicker and the command palette.

---

## Coding style

- Formatting is handled by **Prettier**: no semicolons, single quotes, trailing
  commas, 80-column width, 2-space indent. Run `pnpm format` before committing.
- Path aliases: `@/*` → `src/*`, `@core/*` → `core/*` (node + CLI only).
- UI primitives in `src/shared/components/ui/` are shadcn/ui copies; do not
  edit them by hand. Wrap or compose instead.
- Match the surrounding code's naming and comment density. Prefer small, focused
  modules over large ones.

---

## Commits

- Write clear, imperative commit subjects (e.g. `Add Gemini adapter`,
  `Fix MCP toggle persistence`), matching the existing history.
- Keep each commit logically self-contained; it's fine to squash noise before
  opening the PR.
- Reference issues where relevant (`Fixes #123`).

---

## Opening a pull request

1. **Branch** off `main` (`git checkout -b feature/short-description`).
2. Make your change and keep [the rules](#the-non-negotiable-rules) intact.
3. Run `pnpm lint && pnpm typecheck && pnpm build` locally, and make sure it's
   all green.
4. Push and open a PR against `main`. In the description:
   - Explain **what** changed and **why**.
   - Note any UI changes with a screenshot or short GIF (see the recording tips
     in the README).
   - Link the issue it closes.
5. Make sure CI is green on both Ubuntu and Windows.

Smaller, focused PRs review faster than large ones. If a change is big, split it.

---

## Reporting bugs & requesting features

Open an issue at
[github.com/Fxbixn03/Abyss/issues](https://github.com/Fxbixn03/Abyss/issues).

For a **bug**, please include:

- What you expected vs. what happened.
- Steps to reproduce (and which agent / surface).
- Your OS, Abyss version, and any relevant console output.
- If config-related, the file involved (redact anything sensitive; never paste
  tokens or credentials).

For a **feature request**, describe the problem you're trying to solve, not just
the solution. That helps us find the right fit for Abyss's architecture.

---

Thanks again for contributing!

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
