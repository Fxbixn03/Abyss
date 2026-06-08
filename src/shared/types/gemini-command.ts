/**
 * Gemini CLI custom slash commands. Each is a single TOML file under
 * `<base>/commands/`, optionally grouped in subfolders — `commands/git/commit.toml`
 * becomes the `/git:commit` command. The list view needs only a summary; the
 * editor works on the raw TOML text (see `core/gemini-commands` and
 * `features/gemini-commands/lib/toml`).
 */

export interface GeminiCommandSummary {
  /**
   * Path under `commands/` without the `.toml` extension, POSIX-joined
   * (e.g. `git/commit`). Maps to the `/git:commit` slash command.
   */
  id: string
  /** TOML `name`, falling back to the id with `/` replaced by `:`. */
  name: string
  /** TOML `description`. */
  description: string
  /** Absolute path of the underlying `.toml` file. */
  path: string
}
