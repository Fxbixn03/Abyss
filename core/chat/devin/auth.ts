/**
 * Devin CLI availability check (read-only history; no live-chat auth needed).
 *
 * Devin stores conversation sessions at `~/.devin/sessions/`. For history
 * browsing we only need the sessions directory to exist — no API key or auth
 * token is required by Abyss. `authenticated` is always set to `true` when the
 * directory is present so the Chats page skips the LoginGate and shows the
 * session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { devinSessionsDir } from './paths'

export async function devinAvailability(env: OsEnv): Promise<ChatAvailability> {
  const sessionsDir = devinSessionsDir(env)
  const exists = await pathExists(sessionsDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Devin sessions directory was not found. Install and run Devin CLI once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Devin (read-only history)',
    readOnly: true,
  }
}
