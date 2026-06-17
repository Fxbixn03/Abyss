/**
 * Windsurf availability check (read-only history; no live-chat auth needed).
 *
 * Windsurf stores sessions at `~/.codeium/windsurf/conversations/`. For
 * history browsing we only need the conversations directory to exist — no
 * OAuth token or API key is required by Abyss. `authenticated` is always set
 * to `true` when the conversations directory is present so the Chats page
 * skips the LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { windsurfSessionsDir } from './paths'

export async function windsurfAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const conversationsDir = windsurfSessionsDir(env)
  const exists = await pathExists(conversationsDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Windsurf conversations directory was not found. Install Windsurf and open it once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Windsurf (read-only history)',
    readOnly: true,
  }
}
