/**
 * OpenAI Codex custom subagents. Each is a single TOML file in `<base>/agents/`.
 * The list view needs only a summary; the editor works on the raw TOML text
 * (see `core/codex-subagents` and `features/subagents/lib/toml`).
 */

export interface CodexSubagentSummary {
  /** Filename without the `.toml` extension. */
  id: string
  /** TOML `name`, falling back to the id. */
  name: string
  /** TOML `description`. */
  description: string
  /** TOML `model`, if set. */
  model?: string
  /** TOML `sandbox_mode`, if set. */
  sandboxMode?: string
  /** Absolute path of the underlying `.toml` file. */
  path: string
}
