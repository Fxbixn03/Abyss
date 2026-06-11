/**
 * Status line builder types. Claude Code runs a shell command as its bottom
 * status bar and feeds it session JSON on stdin (model, cwd, cost, context …).
 * Abyss generates a small, self-contained Node script from a list of segments
 * and points `settings.json` → `statusLine` at it. See:
 * https://code.claude.com/docs/en/statusline
 */

export type StatusLineSegmentId =
  | 'model'
  | 'dir'
  | 'projectDir'
  | 'gitBranch'
  | 'context'
  | 'cost'
  | 'lines'
  | 'outputStyle'
  | 'version'
  | 'session'

export interface StatusLineConfig {
  /** A `statusLine` command is present in the target `settings.json`. */
  configured: boolean
  /** The configured status line is the one Abyss generates (vs. hand-rolled). */
  managed: boolean
  /** Raw command string, surfaced only when a non-managed status line exists. */
  rawCommand?: string
  /** Enabled segments, in render order. */
  segments: StatusLineSegmentId[]
  /** Inserted between segments. */
  separator: string
  /** Written to `settings.json` as `statusLine.padding` (0 = flush left). */
  padding: number
  /** Show only the last path component for directory segments. */
  dirBasename: boolean
  /** Prefix each segment with its glyph. */
  icons: boolean
}

export const DEFAULT_STATUSLINE: StatusLineConfig = {
  configured: false,
  managed: false,
  segments: ['model', 'dir', 'gitBranch', 'context'],
  separator: '  ',
  padding: 0,
  dirBasename: true,
  icons: true,
}
