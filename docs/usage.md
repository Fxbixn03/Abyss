# Usage

Abyss edits the *real* config files your agents already use. This guide walks
through the main surfaces and shows exactly where each one reads and writes on
disk.

## Day-to-day

- **Switch agents.** Use the toggle in the top bar (or Cmd/Ctrl+K → "Switch
  to …"). The sidebar, status bar and theme re-skin instantly, and each surface
  is capability-gated so an agent only shows the sections it actually supports.
- **Edit instructions.** Open Instructions, edit, and save. With diff preview on
  (the default) you review the change against the on-disk file first.
- **Manage MCP servers.** The MCP Servers page lists your existing user-scoped
  servers (read from `~/.claude.json`). Add a stdio/http/sse server, edit env,
  or toggle one off, all without touching the rest of the file.
- **Subagents / commands / skills.** Pick Agents (or Commands / Skills), edit
  the prompt and frontmatter, or hit New to scaffold one. Full CRUD over your
  markdown collections (`agents/*.md`, `commands/*.md`,
  `skills/<name>/SKILL.md`).
- **Hooks.** The Hooks page groups your `settings.json` hooks by event
  (PreToolUse, PostToolUse, Stop, …); add a matcher and command in a couple of
  clicks.
- **Permissions, Model & Env.** Allow / ask / deny rule lists, the default
  model, and environment variables, each with its own editor.
- **Raw settings.** A direct JSON editor for `settings.json` /
  `settings.local.json` with validation, for anything without a dedicated UI.
- **Build a theme.** Open Settings → Theme Builder, tweak colors for light and
  dark, preview live, then save and use.

## Safe by design

- Diff preview before saving real files (toggleable).
- Atomic writes (temp file plus rename), so a crash can't leave a half-written
  config.
- Edits to big shared files like `~/.claude.json` preserve every other key
  (projects, account, caches) and unknown fields.

## Where Abyss reads & writes

Every one of these is a plain file on your own disk that any other tool can read:

| Surface | Location |
| --- | --- |
| Claude · Instructions | `~/.claude/CLAUDE.md` |
| Claude · Permissions / Model / Env / Hooks | `~/.claude/settings.json` |
| Claude · MCP servers (user scope) | `~/.claude.json` → `mcpServers` |
| Claude · Agents / Commands / Skills | `~/.claude/{agents,commands,skills}/…` |
| Claude · Raw settings | `~/.claude/settings.json`, `settings.local.json` |
| Codex · Instructions | `~/.codex/AGENTS.md` |
| Abyss · its own preferences | OS userData (`abyss-settings.json`) |

> The two `claude.ai` account connectors (Google Drive, etc.) are managed in your
> Claude account, not a local file, so Abyss shows a note instead of pretending
> to edit them.

## CLI

The same engine that powers the app is available in your terminal:

```bash
# Show where each agent keeps its config
$ pnpm cli -- detect
Claude Code (claude)
  ✓ /home/you/.claude
  · /home/you/.config/claude
OpenAI Codex (codex)
  · /home/you/.codex
  · /home/you/.config/codex

# Export a portable bundle of your config (instructions, MCP, permissions)
$ pnpm cli -- export --out abyss-bundle.json

# Preview what applying a bundle would change — without writing
$ pnpm cli -- apply abyss-bundle.json --dry-run
```

After packaging, the binary is exposed as `abyss` (`abyss detect`, …).
