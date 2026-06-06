/**
 * Ephemeral-login bookkeeping. When the user logs in WITHOUT "save credentials",
 * Abyss must log the CLI back out on quit — but only for logins Abyss itself
 * performed this run. A session the user already had (e.g. from their terminal)
 * is never registered here, so it is never logged out. See [[abyss-chat-feature]].
 */

import type { OsEnv } from '@/shared/types/agent'
import { getChatRuntime } from './registry'

const ephemeral = new Map<string, OsEnv>()

export function markEphemeralLogin(agentId: string, env: OsEnv): void {
  ephemeral.set(agentId, env)
}

export function clearEphemeralLogin(agentId: string): void {
  ephemeral.delete(agentId)
}

/** Log out every ephemeral session. Called on app quit. Never throws. */
export async function runEphemeralLogouts(): Promise<void> {
  const entries = [...ephemeral.entries()]
  ephemeral.clear()
  await Promise.all(
    entries.map(async ([agentId, env]) => {
      try {
        await getChatRuntime(agentId).logout(env)
      } catch {
        // best-effort cleanup
      }
    }),
  )
}
