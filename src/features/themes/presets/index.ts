import type { ThemeConfig } from '@/shared/types/theme'
import { claudeThemes } from './claude.theme'
import { codexThemes } from './codex.theme'
import { geminiThemes } from './gemini.theme'
import { abyssThemes } from './abyss.theme'

/**
 * All built-in themes. To add a theme, drop a preset into a *.theme.ts file and
 * include it here — it becomes available automatically in the ThemePicker.
 */
export const BUILTIN_THEMES: ThemeConfig[] = [
  ...claudeThemes,
  ...codexThemes,
  ...geminiThemes,
  ...abyssThemes,
]
