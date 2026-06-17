/**
 * Sourcegraph Cody CLI chat runtime — read-only history only.
 *
 * Cody stores AI conversations at:
 *   Linux/macOS: `~/.sourcegraph/cody/conversations/<session-id>.json`
 *   Windows:     `%APPDATA%\Sourcegraph\Cody\conversations\<session-id>.json`
 *
 * Live chat is not supported — Cody runs as its own IDE extension and does not
 * expose a structured external streaming API that Abyss can drive.
 * `start()` throws a user-friendly error so the Composer is implicitly disabled
 * (the auth gate shows as "authenticated" but there is no live-session
 * capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listCodySessions,
  readCodySession,
  deleteCodySession,
  readCodyMeta,
  listCodySessionFileRefs,
} from './parse'
import { codyAvailability } from './auth'

export const codyChatRuntime: ChatRuntime = {
  agentId: 'cody',

  listSessions: (env, opts) => listCodySessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readCodySession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteCodySession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listCodySessionFileRefs(env),
    readMeta: (ref) => readCodyMeta(ref),
  },

  availability: (env: OsEnv) => codyAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Cody handles its own
  // authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => codyAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Sourcegraph Cody. You can browse past conversations in read-only mode.',
    )
  },
}
