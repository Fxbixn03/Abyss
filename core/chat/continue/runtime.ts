/**
 * Continue chat runtime — read-only history only.
 *
 * Continue stores AI conversations at `~/.continue/history/<session-id>.json`.
 * Live chat is not supported — Continue runs as a VS Code / JetBrains extension
 * with its own internal AI integration and does not expose a structured external
 * streaming API. `start()` throws a user-friendly error so the Composer is
 * implicitly disabled (the auth gate shows as "authenticated" but there is no
 * live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listContinueSessions,
  readContinueSession,
  deleteContinueSession,
  readContinueMeta,
  listContinueSessionFileRefs,
} from './parse'
import { continueAvailability } from './auth'

export const continueChatRuntime: ChatRuntime = {
  agentId: 'continue',

  listSessions: (env, opts) => listContinueSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readContinueSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteContinueSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listContinueSessionFileRefs(env),
    readMeta: (ref) => readContinueMeta(ref),
  },

  availability: (env: OsEnv) => continueAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Continue handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => continueAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Continue. You can browse past sessions in read-only mode.',
    )
  },
}
