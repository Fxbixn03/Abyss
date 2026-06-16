/**
 * Cursor availability check (read-only history; no live-chat auth needed).
 *
 * Cursor stores sessions at `~/.cursor/logs/conversations/` (Linux) or
 * `~/Library/Application Support/Cursor/logs/conversations/` (macOS). For
 * history browsing we only need the Cursor home directory to exist — no OAuth
 * token or API key is required by Abyss. `authenticated` is always set to
 * `true` when the Cursor home is present so the Chats page skips the
 * LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { cursorHomeDir } from './paths'

export async function cursorAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const cursorDir = cursorHomeDir(env)
  const exists = await pathExists(cursorDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Cursor application directory was not found. Install Cursor and open it once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Cursor (read-only history)',
    readOnly: true,
  }
}
