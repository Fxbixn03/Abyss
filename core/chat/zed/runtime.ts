/**
 * Zed Editor chat runtime — read-only history only.
 *
 * Zed stores AI Panel conversations at:
 *   Linux/macOS: `~/.config/zed/conversations/<uuid>.jsonl`
 *   Windows:     `%APPDATA%\Zed\conversations\<uuid>.jsonl`
 *
 * Live chat is not supported — Zed is a standalone editor and does not expose
 * a structured external streaming API that Abyss can drive.
 * `start()` throws a user-friendly error so the Composer is implicitly disabled
 * (the auth gate shows as "authenticated" but there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listZedSessions,
  readZedSession,
  deleteZedSession,
  readZedMeta,
  listZedSessionFileRefs,
} from './parse'
import { zedAvailability } from './auth'

export const zedChatRuntime: ChatRuntime = {
  agentId: 'zed',

  listSessions: (env, opts) => listZedSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readZedSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteZedSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listZedSessionFileRefs(env),
    readMeta: (ref) => readZedMeta(ref),
  },

  availability: (env: OsEnv) => zedAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Zed handles its own
  // authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => zedAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Zed. You can browse past AI Panel conversations in read-only mode.',
    )
  },
}
