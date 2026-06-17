/**
 * Copilot CLI availability check (read-only history; no live-chat auth needed).
 *
 * Copilot CLI stores conversations at `~/.copilot/conversations/`. For history
 * browsing we only need the root `~/.copilot` directory to exist — no OAuth
 * token or API key is required by Abyss. `authenticated` is always set to
 * `true` when the directory is present so the Chats page skips the LoginGate
 * and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import path from 'node:path'

export async function copilotAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const copilotDir = path.join(env.home, '.copilot')
  const exists = await pathExists(copilotDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The ~/.copilot directory was not found. Install GitHub Copilot CLI and start a conversation to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'GitHub Copilot CLI (read-only history)',
    readOnly: true,
  }
}
