/**
 * Gemini CLI availability check (read-only history; no live-chat auth needed).
 *
 * Gemini CLI stores sessions at `~/.gemini/sessions/`. For history browsing we
 * only need that directory to exist — no OAuth token or API key is required by
 * Abyss. `authenticated` is always set to `true` when the sessions directory is
 * present so the Chats page skips the LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { geminiHomeDir } from './paths'

export async function geminiAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const geminiDir = geminiHomeDir(env)
  const exists = await pathExists(geminiDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The `~/.gemini` directory was not found. Install and run Gemini CLI once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Gemini CLI (read-only history)',
    readOnly: true,
  }
}
