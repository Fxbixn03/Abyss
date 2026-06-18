/**
 * Zed Editor availability check (read-only history; no live-chat auth needed).
 *
 * Zed stores AI Panel conversations at `~/.config/zed/conversations/` (Linux/macOS)
 * or `%APPDATA%\Zed\conversations\` (Windows). For history browsing we only need
 * the conversations directory to exist — no API key or auth token is required by
 * Abyss. `authenticated` is always set to `true` when the directory is present so
 * the Chats page skips the LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { zedSessionsDir } from './paths'

export async function zedAvailability(env: OsEnv): Promise<ChatAvailability> {
  const conversationsDir = zedSessionsDir(env)
  const exists = await pathExists(conversationsDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Zed conversations directory was not found. Open Zed and use the AI Panel to create a conversation first.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Zed (read-only history)',
    readOnly: true,
  }
}
