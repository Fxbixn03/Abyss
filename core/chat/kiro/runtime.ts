/**
 * Kiro (AWS) chat runtime — read-only history only.
 *
 * Kiro stores AI sessions at `~/.kiro/sessions/<session-id>.json`.
 * Live chat is not supported — Kiro runs as its own IDE extension and does not
 * expose a structured external streaming API that Abyss can drive.
 * `start()` throws a user-friendly error so the Composer is implicitly disabled
 * (the auth gate shows as "authenticated" but there is no live-session
 * capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listKiroSessions,
  readKiroSession,
  deleteKiroSession,
  readKiroMeta,
  listKiroSessionFileRefs,
} from './parse'
import { kiroAvailability } from './auth'

export const kiroChatRuntime: ChatRuntime = {
  agentId: 'kiro',

  listSessions: (env, opts) => listKiroSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readKiroSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteKiroSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listKiroSessionFileRefs(env),
    readMeta: (ref) => readKiroMeta(ref),
  },

  availability: (env: OsEnv) => kiroAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Kiro handles its own
  // authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => kiroAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Kiro. You can browse past sessions in read-only mode.',
    )
  },
}
