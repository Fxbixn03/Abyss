/**
 * Cline availability check (read-only history; no live-chat auth needed).
 *
 * Cline stores task conversations at `~/Documents/Cline/tasks/`. For history
 * browsing we only need that directory to exist — no API key or auth token is
 * required by Abyss. `authenticated` is always set to `true` when the tasks
 * directory is present so the Chats page skips the LoginGate and shows sessions.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { clineTasksDir } from './paths'

export async function clineAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const tasksDir = clineTasksDir(env)
  const exists = await pathExists(tasksDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The `~/Documents/Cline/tasks` directory was not found. Install the Cline VS Code extension and run a task once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Cline (read-only history)',
    readOnly: true,
  }
}
