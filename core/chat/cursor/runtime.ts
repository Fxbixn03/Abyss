/**
 * Cursor chat runtime — read-only history only.
 *
 * Live chat is not yet supported for Cursor because the editor does not expose
 * a structured external streaming API. `start()` throws a user-friendly error
 * so the Composer is implicitly disabled (the auth gate shows as
 * "authenticated" but there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listCursorSessions,
  readCursorSession,
  deleteCursorSession,
  readCursorMeta,
} from './parse'
import { listCursorSessionFiles } from './paths'
import { cursorAvailability } from './auth'

export const cursorChatRuntime: ChatRuntime = {
  agentId: 'cursor',

  listSessions: (env, opts) => listCursorSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readCursorSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteCursorSession(env, sessionId),

  usage: {
    listFiles: async (env) =>
      (await listCursorSessionFiles(env)).map((filePath) => ({ filePath })),
    readMeta: (ref) => readCursorMeta(ref),
  },

  availability: (env: OsEnv) => cursorAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Cursor handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => cursorAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not yet supported for Cursor. You can browse past sessions in read-only mode.',
    )
  },
}
