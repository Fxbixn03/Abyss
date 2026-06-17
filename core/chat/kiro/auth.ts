/**
 * Kiro (AWS) availability check (read-only history; no live-chat auth needed).
 *
 * Kiro stores sessions at `~/.kiro/sessions/`. For history browsing we only
 * need the root `~/.kiro` directory to exist — no API key or auth token is
 * required by Abyss. `authenticated` is always set to `true` when the
 * directory is present so the Chats page skips the LoginGate and shows the
 * session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { kiroHomeDir } from './paths'

export async function kiroAvailability(env: OsEnv): Promise<ChatAvailability> {
  const kiroDir = kiroHomeDir(env)
  const exists = await pathExists(kiroDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The ~/.kiro directory was not found. Install and run Kiro once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Kiro (read-only history)',
    readOnly: true,
  }
}
