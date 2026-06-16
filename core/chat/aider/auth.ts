/**
 * Aider availability check (read-only history; no live-chat auth needed).
 *
 * Aider writes conversations to `~/.aider.chat.history.md`. For history
 * browsing we only need that file to exist — no API key or auth token is
 * required by Abyss. `authenticated` is always set to `true` when the history
 * file is present so the Chats page skips the LoginGate and shows sessions.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { aiderHistoryFile } from './paths'

export async function aiderAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const historyPath = aiderHistoryFile(env)
  const exists = await pathExists(historyPath)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The `~/.aider.chat.history.md` file was not found. Install Aider and run a conversation once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Aider (read-only history)',
    readOnly: true,
  }
}
