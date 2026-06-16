/**
 * Cline chat runtime — read-only history only.
 *
 * Cline is a VS Code extension that stores each task's conversation at
 * `~/Documents/Cline/tasks/<task-id>/api_conversation_history.json`. Live chat
 * is not supported — Cline runs inside VS Code and does not expose a structured
 * streaming interface. `start()` throws a user-friendly error so the Composer
 * is implicitly disabled (the auth gate shows as "authenticated" but there is no
 * live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listClineSessions,
  readClineSession,
  deleteClineSession,
  readClineMeta,
  listClineSessionFileRefs,
} from './parse'
import { clineAvailability } from './auth'

export const clineChatRuntime: ChatRuntime = {
  agentId: 'cline',

  listSessions: (env, opts) => listClineSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readClineSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteClineSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listClineSessionFileRefs(env),
    readMeta: (ref) => readClineMeta(ref),
  },

  availability: (env: OsEnv) => clineAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Cline handles its own
  // authentication via VS Code settings and Abyss never stores any credentials.
  login: async (env: OsEnv) => clineAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Cline. You can browse past task sessions in read-only mode.',
    )
  },
}
