/**
 * Goose availability check (read-only history; no live-chat auth needed).
 *
 * Goose stores sessions at `~/.config/goose/sessions/` (Linux/macOS) or
 * `%APPDATA%\goose\sessions\` (Windows). For history browsing we only need the
 * sessions directory to exist — no API key or auth token is required by Abyss.
 * `authenticated` is always set to `true` when the sessions directory is present
 * so the Chats page skips the LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { gooseSessionsDir } from './paths'

export async function gooseAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const sessionsDir = gooseSessionsDir(env)
  const exists = await pathExists(sessionsDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Goose sessions directory was not found. Install Goose and run a session once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Goose (read-only history)',
    readOnly: true,
  }
}
