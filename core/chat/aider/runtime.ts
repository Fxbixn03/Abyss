/**
 * Aider chat runtime — read-only history only.
 *
 * Aider writes every conversation to `~/.aider.chat.history.md`, a single
 * Markdown file that holds all sessions. Live chat is not supported — Aider
 * runs interactively in the terminal and does not expose a structured streaming
 * interface. `start()` throws a user-friendly error so the Composer is
 * implicitly disabled (the auth gate shows as "authenticated" but there is no
 * live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listAiderSessions,
  readAiderSession,
  deleteAiderSession,
  readAiderMeta,
  listAiderSessionFileRefs,
} from './parse'
import { aiderAvailability } from './auth'

export const aiderChatRuntime: ChatRuntime = {
  agentId: 'aider',

  listSessions: (env, opts) => listAiderSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readAiderSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteAiderSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listAiderSessionFileRefs(env),
    readMeta: (ref) => readAiderMeta(ref),
  },

  availability: (env: OsEnv) => aiderAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Aider CLI handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => aiderAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Aider. You can browse past sessions in read-only mode.',
    )
  },
}
