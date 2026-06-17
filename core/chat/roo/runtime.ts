/**
 * Roo Code chat runtime — read-only history only.
 *
 * Roo Code is a Cline fork that stores each task's conversation at
 * `~/.roo/tasks/<task-id>/api_conversation_history.json`. Live chat is not
 * supported — Roo Code runs inside VS Code and does not expose a structured
 * streaming interface. `start()` throws a user-friendly error so the Composer
 * is implicitly disabled (the auth gate shows as "authenticated" but there is
 * no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listRooSessions,
  readRooSession,
  deleteRooSession,
  readRooMeta,
  listRooSessionFileRefs,
} from './parse'
import { rooAvailability } from './auth'

export const rooChatRuntime: ChatRuntime = {
  agentId: 'roo',

  listSessions: (env, opts) => listRooSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readRooSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteRooSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listRooSessionFileRefs(env),
    readMeta: (ref) => readRooMeta(ref),
  },

  availability: (env: OsEnv) => rooAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Roo Code handles its
  // own authentication via VS Code settings and Abyss never stores any
  // credentials.
  login: async (env: OsEnv) => rooAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Roo Code. You can browse past task sessions in read-only mode.',
    )
  },
}
