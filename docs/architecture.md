# Architecture & extensibility

This is the high-level map. For the full architecture reference and the
non-negotiable contributor rules, see [CLAUDE.md](../CLAUDE.md); for the
day-to-day contribution workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## How it fits together

Abyss is built feature-first, with a strict typed boundary between the renderer
and the OS:

- The **renderer** (React 19 + TS) never touches `fs`/`path`/`os`; all disk work
  goes through a single typed IPC bridge.
- **Core** (`core/`) holds the framework-agnostic config IO and is reused by both
  the Electron main process and the CLI.
- **Theming** runs entirely on CSS variables, so themes switch with no reload and
  components never hard-code colors.

```text
core/        Node-only config IO (reused by main + CLI)
electron/    Main process: window, security, typed IPC handlers
cli/         The `abyss` CLI
src/
  shared/    Types, typed IPC client, agent definitions, UI primitives
  features/  Feature-first: agents, config, mcp, hooks, themes, settings, …
  app/       Shell: router, layout (sidebar + top bar + status bar), Cmd+K
```

## Extending Abyss

**Add an agent** in three small steps:

1. Add an `AgentDefinition` (id, paths, config files) to
   `src/shared/agents/defs.ts`.
2. Create one adapter in `src/features/agents/adapters/<id>.adapter.ts` and
   register it.
3. Add a theme preset in `src/features/themes/presets/`.

The switcher, sidebar, command palette, detection (app + CLI) and theming all
pick it up automatically. (Gemini ships as the worked example.)

**Add an IPC channel or theme** using the step-by-step recipes in
[CLAUDE.md](../CLAUDE.md).

## Development

```bash
pnpm dev          # Vite + Electron, hot reload
pnpm build        # type-check → bundle → package
pnpm build:dir    # unpacked build (faster, no installer)
pnpm typecheck    # both TS projects
pnpm lint         # ESLint (zero warnings)
pnpm format       # Prettier
pnpm cli -- ...   # run the abyss CLI in dev
```

## Brand assets

The logo and theme GIFs are reproducible:

```bash
python3 scripts/gen-logo-gif.py     # -> assets/abyss-logo.gif
python3 scripts/gen-themes-gif.py   # -> assets/abyss-themes.gif
```

(Requires `rsvg-convert` and ImageMagick.)

## Recording demo GIFs

Short screen recordings of real usage make the best feature demos. Record with
[`wf-recorder`](https://github.com/ammen99/wf-recorder) + `gifski` (Wayland) or
[Peek](https://github.com/phw/peek), drop the file in `assets/`, then reference
it from the README.

| File | What to show |
| --- | --- |
| `assets/demo-switch.gif` | Toggle Claude ↔ Codex; the whole UI re-themes |
| `assets/demo-mcp.gif` | Open MCP Servers → your real servers appear → add one |
| `assets/demo-instructions.gif` | Edit `CLAUDE.md`, hit Save, review the diff dialog |
| `assets/demo-theme-builder.gif` | Build a theme with the color pickers + live preview |

<details>
<summary>Record a GIF on Wayland (example)</summary>

```bash
wf-recorder -g "$(slurp)" -f /tmp/demo.mp4        # select a region, ⌃C to stop
ffmpeg -i /tmp/demo.mp4 -vf "fps=18,scale=820:-1" -f yuv4mpegpipe - \
  | gifski -o assets/demo-switch.gif -
```

</details>
