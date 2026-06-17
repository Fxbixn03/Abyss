/**
 * Plandex availability check (read-only history; no live-chat auth needed).
 *
 * Plandex stores plan conversations at `~/.plandex/plans/`. For history
 * browsing we only need the `~/.plandex` directory to exist — no API key or
 * auth token is required by Abyss. `authenticated` is always set to `true`
 * when the Plandex home directory is present so the Chats page skips the
 * LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { plandexHomeDir } from './paths'

export async function plandexAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const plandexDir = plandexHomeDir(env)
  const exists = await pathExists(plandexDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The `~/.plandex` directory was not found. Install and run Plandex CLI once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Plandex (read-only history)',
    readOnly: true,
  }
}
