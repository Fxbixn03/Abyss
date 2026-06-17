/**
 * Plandex CLI chat runtime — read-only history only.
 *
 * Plandex is a plan-based AI coding CLI that stores each plan's conversation
 * at `~/.plandex/plans/<plan-id>/conversation.jsonl`. Live chat is not
 * supported — Plandex runs as its own CLI and does not expose a structured
 * streaming interface that Abyss can drive. `start()` throws a user-friendly
 * error so the Composer is implicitly disabled (the auth gate shows as
 * "authenticated" but there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listPlandexSessions,
  readPlandexSession,
  deletePlandexSession,
  readPlandexMeta,
  listPlandexSessionFileRefs,
} from './parse'
import { plandexAvailability } from './auth'

export const plandexChatRuntime: ChatRuntime = {
  agentId: 'plandex',

  listSessions: (env, opts) => listPlandexSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readPlandexSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deletePlandexSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listPlandexSessionFileRefs(env),
    readMeta: (ref) => readPlandexMeta(ref),
  },

  availability: (env: OsEnv) => plandexAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Plandex handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => plandexAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not yet supported for Plandex. You can browse past plan sessions in read-only mode.',
    )
  },
}
