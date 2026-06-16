/**
 * Gemini CLI chat runtime — read-only history only.
 *
 * Live chat is not yet supported for Gemini because the CLI does not expose a
 * structured streaming JSON mode. `start()` throws a user-friendly error so the
 * Composer is implicitly disabled (the auth gate shows as "authenticated" but
 * there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import { listGeminiSessions, readGeminiSession, deleteGeminiSession, readGeminiMeta } from './parse'
import { listGeminiSessionFiles } from './paths'
import { geminiAvailability } from './auth'

export const geminiChatRuntime: ChatRuntime = {
  agentId: 'gemini',

  listSessions: (env, opts) => listGeminiSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readGeminiSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteGeminiSession(env, sessionId),

  usage: {
    listFiles: async (env) =>
      (await listGeminiSessionFiles(env)).map((filePath) => ({ filePath })),
    readMeta: (ref) => readGeminiMeta(ref),
  },

  availability: (env: OsEnv) => geminiAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Gemini CLI handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => geminiAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not yet supported for Gemini CLI. You can browse past sessions in read-only mode.',
    )
  },
}
