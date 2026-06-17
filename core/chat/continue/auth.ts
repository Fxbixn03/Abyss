/**
 * Continue availability check (read-only history; no live-chat auth needed).
 *
 * Continue stores AI sessions at `~/.continue/history/`. For history browsing
 * we only need the history directory to exist — no OAuth token or API key is
 * required by Abyss. `authenticated` is always set to `true` when the history
 * directory is present so the Chats page skips the LoginGate and shows the
 * session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { continueSessionsDir } from './paths'

export async function continueAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const historyDir = continueSessionsDir(env)
  const exists = await pathExists(historyDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Continue history directory was not found. Install Continue and start a conversation to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Continue (read-only history)',
    readOnly: true,
  }
}
