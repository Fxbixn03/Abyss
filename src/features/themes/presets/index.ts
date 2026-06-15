import type { ThemeConfig } from '@/shared/types/theme'
import { claudeThemes } from './claude.theme'
import { codexThemes } from './codex.theme'
import { geminiThemes } from './gemini.theme'
import { cursorThemes } from './cursor.theme'
import { copilotThemes } from './copilot.theme'
import { windsurfThemes } from './windsurf.theme'
import { continueThemes } from './continue.theme'
import { aiderThemes } from './aider.theme'
import { clineThemes } from './cline.theme'
import { rooThemes } from './roo.theme'
import { ampThemes } from './amp.theme'
import { gooseThemes } from './goose.theme'
import { kiroThemes } from './kiro.theme'
import { amazonqThemes } from './amazonq.theme'
import { warpThemes } from './warp.theme'
import { plandexThemes } from './plandex.theme'
import { zedThemes } from './zed.theme'
import { abyssThemes } from './abyss.theme'

/**
 * All built-in themes. To add a theme, drop a preset into a *.theme.ts file and
 * include it here — it becomes available automatically in the ThemePicker.
 */
export const BUILTIN_THEMES: ThemeConfig[] = [
  ...claudeThemes,
  ...codexThemes,
  ...geminiThemes,
  ...cursorThemes,
  ...copilotThemes,
  ...windsurfThemes,
  ...continueThemes,
  ...aiderThemes,
  ...clineThemes,
  ...rooThemes,
  ...ampThemes,
  ...gooseThemes,
  ...kiroThemes,
  ...amazonqThemes,
  ...warpThemes,
  ...plandexThemes,
  ...zedThemes,
  ...abyssThemes,
]
