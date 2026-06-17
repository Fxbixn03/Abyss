/**
 * Warp terminal AI chat runtime — read-only history only.
 *
 * Warp 2025+ stores AI conversations at
 * `~/.warp/warp-ai/sessions/<session-id>.jsonl`. Live chat is not supported
 * — Warp runs as a terminal application with its own internal AI integration
 * and does not expose a structured external streaming API. `start()` throws a
 * user-friendly error so the Composer is implicitly disabled (the auth gate
 * shows as "authenticated" but there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listWarpSessions,
  readWarpSession,
  deleteWarpSession,
  readWarpMeta,
  listWarpSessionFileRefs,
} from './parse'
import { warpAvailability } from './auth'

export const warpChatRuntime: ChatRuntime = {
  agentId: 'warp',

  listSessions: (env, opts) => listWarpSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readWarpSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteWarpSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listWarpSessionFileRefs(env),
    readMeta: (ref) => readWarpMeta(ref),
  },

  availability: (env: OsEnv) => warpAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Warp handles its own
  // authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => warpAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Warp. You can browse past sessions in read-only mode.',
    )
  },
}
