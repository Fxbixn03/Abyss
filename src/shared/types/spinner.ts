/**
 * Claude Code spinner customization. Two real `settings.json` keys drive the
 * action verbs and tips shown while Claude works:
 *   - `spinnerVerbs`: { mode: 'append' | 'replace', verbs: string[] }
 *   - `spinnerTipsOverride`: { tips: string[], excludeDefault?: boolean }
 * Abyss reads/writes them in place, preserving every other setting. See
 * https://code.claude.com/docs/en/settings
 */

export type SpinnerVerbsMode = 'append' | 'replace'

export interface SpinnerConfig {
  /** A `spinnerVerbs` key is present in settings.json. */
  verbsConfigured: boolean
  /** `append` adds to the built-ins; `replace` shows only these. */
  verbsMode: SpinnerVerbsMode
  /** Custom action verbs, in display order. */
  verbs: string[]
  /** A `spinnerTipsOverride` key is present in settings.json. */
  tipsConfigured: boolean
  /** Custom spinner tips. */
  tips: string[]
  /** Show only the custom tips instead of merging with the built-ins. */
  tipsExcludeDefault: boolean
}

export const DEFAULT_SPINNER: SpinnerConfig = {
  verbsConfigured: false,
  verbsMode: 'append',
  verbs: [],
  tipsConfigured: false,
  tips: [],
  tipsExcludeDefault: false,
}
