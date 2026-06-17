/**
 * Amp (Sourcegraph) chat runtime — read-only history only.
 *
 * Amp stores AI conversations at `~/.amp/conversations/<session-id>.json`.
 * Live chat is not supported — Amp runs as its own IDE extension and CLI tool
 * and does not expose a structured external streaming API that Abyss can drive.
 * `start()` throws a user-friendly error so the Composer is implicitly disabled
 * (the auth gate shows as "authenticated" but there is no live-session
 * capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listAmpSessions,
  readAmpSession,
  deleteAmpSession,
  readAmpMeta,
  listAmpSessionFileRefs,
} from './parse'
import { ampAvailability } from './auth'

export const ampChatRuntime: ChatRuntime = {
  agentId: 'amp',

  listSessions: (env, opts) => listAmpSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readAmpSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteAmpSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listAmpSessionFileRefs(env),
    readMeta: (ref) => readAmpMeta(ref),
  },

  availability: (env: OsEnv) => ampAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Amp handles its own
  // authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => ampAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Amp. You can browse past sessions in read-only mode.',
    )
  },
}
