/**
 * Amazon Q Developer availability check (read-only history; no live-chat auth
 * required). Amazon Q CLI stores conversations at
 * `~/.aws/amazonq/conversations/`. For history browsing, Abyss only needs that
 * directory to exist — no API key or auth token is stored by Abyss.
 *
 * `authenticated` is always set to `true` when the conversations directory (or
 * its parent `~/.aws/amazonq`) is present so the Chats page skips the
 * LoginGate and shows the session list directly.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import path from 'node:path'
import { pathExists } from '../../json-file'
import { amazonqSessionsDir } from './paths'

/** Parent directory — existence means Amazon Q CLI has been used at least once. */
function amazonqHomeDir(env: OsEnv): string {
  return path.join(env.home, '.aws', 'amazonq')
}

export async function amazonqAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  // Accept either the parent dir or the conversations dir being present.
  const homeExists = await pathExists(amazonqHomeDir(env))
  const convsExists = await pathExists(amazonqSessionsDir(env))

  if (!homeExists && !convsExists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The `~/.aws/amazonq` directory was not found. Install and run the Amazon Q Developer CLI once to create it.',
    }
  }

  return {
    installed: true,
    authenticated: true,
    account: 'Amazon Q Developer (read-only history)',
    readOnly: true,
  }
}
