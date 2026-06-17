/**
 * Amp (Sourcegraph) availability check (read-only history; no live-chat auth needed).
 *
 * Amp stores conversations at `~/.amp/conversations/`. For history browsing we
 * only need the root `~/.amp` directory to exist — no API key or auth token is
 * required by Abyss. `authenticated` is always set to `true` when the directory
 * is present so the Chats page skips the LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { ampHomeDir } from './paths'

export async function ampAvailability(env: OsEnv): Promise<ChatAvailability> {
  const ampDir = ampHomeDir(env)
  const exists = await pathExists(ampDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The ~/.amp directory was not found. Install and run Amp CLI once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Amp (read-only history)',
    readOnly: true,
  }
}
