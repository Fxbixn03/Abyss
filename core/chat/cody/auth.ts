/**
 * Sourcegraph Cody CLI availability check (read-only history; no live-chat auth needed).
 *
 * Cody stores conversations at `~/.sourcegraph/cody/conversations/` (Linux/macOS) or
 * `%APPDATA%\Sourcegraph\Cody\conversations\` (Windows). For history browsing we only
 * need the Cody config directory to exist — no API key or auth token is required by
 * Abyss. `authenticated` is always set to `true` when the directory is present so the
 * Chats page skips the LoginGate and shows the session list.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { codyConfigDir } from './paths'

export async function codyAvailability(env: OsEnv): Promise<ChatAvailability> {
  const configDir = codyConfigDir(env)
  const exists = await pathExists(configDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Cody config directory was not found. Install and run Sourcegraph Cody once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Sourcegraph Cody (read-only history)',
    readOnly: true,
  }
}
