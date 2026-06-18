/**
 * Devin CLI chat runtime — read-only history only.
 *
 * Devin stores conversation sessions at:
 *   `~/.devin/sessions/<session-id>.json`
 *
 * Live chat is not supported — Devin CLI does not expose a structured external
 * streaming API that Abyss can drive.
 * `start()` throws a user-friendly error so the Composer is implicitly disabled
 * (the auth gate shows as "authenticated" but there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listDevinSessions,
  readDevinSession,
  deleteDevinSession,
  readDevinMeta,
  listDevinSessionFileRefs,
} from './parse'
import { devinAvailability } from './auth'

export const devinChatRuntime: ChatRuntime = {
  agentId: 'devin',

  listSessions: (env, opts) => listDevinSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readDevinSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteDevinSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listDevinSessionFileRefs(env),
    readMeta: (ref) => readDevinMeta(ref),
  },

  availability: (env: OsEnv) => devinAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Devin handles its own
  // authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => devinAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat not supported for Devin. You can browse past sessions in read-only mode.',
    )
  },
}
