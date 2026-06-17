/**
 * Roo Code availability check (read-only history; no live-chat auth needed).
 *
 * Roo Code stores task conversations at `~/.roo/tasks/` (Linux/macOS) or
 * `%APPDATA%\roo\tasks\` (Windows). For history browsing we only need that
 * directory to exist — no API key or auth token is required by Abyss.
 * `authenticated` is always set to `true` when the tasks directory is present
 * so the Chats page skips the LoginGate and shows sessions.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { pathExists } from '../../json-file'
import { rooTasksDir } from './paths'

export async function rooAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const tasksDir = rooTasksDir(env)
  const exists = await pathExists(tasksDir)
  if (!exists) {
    return {
      installed: false,
      authenticated: false,
      reason:
        'The Roo Code tasks directory was not found. Install the Roo Code VS Code extension and run a task once to create it.',
    }
  }
  return {
    installed: true,
    authenticated: true,
    account: 'Roo Code (read-only history)',
    readOnly: true,
  }
}
