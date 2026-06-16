# Core modules

[`core/`](../core) is the single source of truth for reading and writing agent
config. It is pure Node (uses `fs`/`os`/`path`) and is imported by both the
Electron main process and the `abyss` CLI, so every function here is available
to the GUI and the terminal at once. This page summarises each module's purpose
and its public surface (inputs/outputs, not implementation detail).

See also: [Architecture overview](Architecture.md) ·
[Agent lifecycle](Agent-Lifecycle.md) · [docs index](README.md).

## Detection & paths

- **`agent-paths.ts`** — find where each agent keeps its config. Exports
  `detectAgentPaths`, `detectAllAgentPaths`, `effectiveBasePath` (override →
  detected → first candidate).
- **`agent-detect.ts`** — decide whether an agent is installed/usable on this
  machine (CLI presence, version).
- **`path-scope.ts`** — guard rails: `isInsideRoot`-style checks so reads and
  writes can't escape the allowed directories.
- **`os-env.ts`** — resolve the OS environment (home dir, platform paths) used
  when expanding agent locations.

## Instruction & settings IO

- **`config-io.ts`** — read/write the markdown instruction files (CLAUDE.md,
  AGENTS.md, …). Exports `validateContent`, `readAgentConfigFile`,
  `writeAgentConfigFile`.
- **`claude-settings.ts`** — permissions + model + env for Claude-style agents:
  `readPermissions`/`writePermissions`, `readModelEnv`/`writeModelEnv`.
- **`codex-settings.ts`** — the equivalent for Codex's TOML config.
- **`raw-settings.ts`** — read/write the agent's `settings.json` verbatim for
  the raw-settings editor.
- **`settings-store.ts`** — Abyss's **own** persisted settings (`SettingsStore`
  class with `read`/`update`), kept under userData and validated against the
  Zod schema field-by-field.
- **`frontmatter.ts`** / **`json-file.ts`** — small parsers used across the
  above (YAML frontmatter, lenient JSON read/write).

## MCP, hooks, subagents, commands

- **`mcp.ts`**, **`mcp-codex.ts`**, **`mcp-server.ts`**, **`mcp-health.ts`** —
  read/write MCP server lists per agent format and probe a server's health.
- **`hooks.ts`** / **`hooks-flat.ts`** / **`disabled-hooks.ts`** — lifecycle
  hook entries and the enabled/disabled bookkeeping.
- **`codex-subagents.ts`**, **`gemini-commands.ts`** — format-specific readers
  for subagents and slash commands.
- **`skill-import.ts`** — import a skill folder into an agent's config.

## Safety net, bundles & sync

- **`snapshots.ts`** — a universal undo: `recordSnapshot` is hooked into every
  atomic write, plus `listSnapshots`, `readSnapshot`, `restoreSnapshot`,
  `deleteSnapshot`, and `configureSnapshots` to point it at a root.
- **`backup.ts`** — periodic full-config backups: `createBackup`,
  `listBackups`, `backupStatus`, `runScheduledBackup` (honours the configured
  interval) and `defaultBackupDir`.
- **`bundle.ts`** / **`bundle-redact.ts`** — `exportBundle` / `applyBundle` for
  portable config export/apply, with secret redaction.
- **`profiles.ts`** — named config sets: `saveProfile`, `listProfiles`,
  `readProfile`, `deleteProfile`, `renameProfile`.
- **`sync.ts`** — compare and copy a single surface (instructions / mcp /
  permissions / hooks) between two agents.
- **`zip.ts`**, **`tmp-path.ts`** — archive helpers and unique temp paths used
  by the above.

## Inspection & analysis

- **`doctor.ts`** — `runDoctor` health scan + `applyDoctorFix`; flags risky
  allows and placeholder env values.
- **`validation.ts`** — `runValidation` lint of the whole agent setup.
- **`relations.ts`** — `buildRelationGraph` / `detectEdges` for the Relations
  map.
- **`workspace-scan.ts`** — scan repositories for per-project agent config.
- **`global-search.ts`** — cross-config search.
- **`collections.ts`**, **`plugins.ts`**, **`statusline.ts`**, **`spinner.ts`**
  — feature-specific config IO for those surfaces.
- **`sandbox.ts`** — `runSandboxCommand` executes a one-off shell command for
  the Sandbox page.
- **`config-error.ts`** — typed errors (parse/permission/disk) the renderer
  maps to friendly banners.

## How it's wired in

The main process calls these from `electron/ipc/*.ipc.ts` handlers; the CLI
calls them directly from `cli/index.ts`. Adding config logic in one place
surfaces it in both — see the [Architecture overview](Architecture.md).
