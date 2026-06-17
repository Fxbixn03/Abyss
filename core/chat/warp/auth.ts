/**
 * Warp availability check (read-only history; no live-chat auth needed).
 *
 * Warp stores AI sessions at `~/.warp/warp-ai/sessions/`. For history browsing
 * we only need the sessions directory to exist — no OAuth token or API key is
 * required by Abyss. `authenticated` is always set to `true` when the sessions
 * directory is present so the Chats page skips the LoginGate and shows the
 * session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { warpSessionsDir } from './paths'

export async function warpAvailability(env: OsEnv): Promise<ChatAvailability> {
  const sessionsDir = warpSessionsDir(env)
  const exists = await pathExists(sessionsDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Warp AI sessions directory was not found. Install Warp and use AI features once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Warp (read-only history)',
    readOnly: true,
  }
}
