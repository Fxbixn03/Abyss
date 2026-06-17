/**
 * Goose chat runtime — read-only history only.
 *
 * Goose (Block) stores sessions as JSONL files at
 * `~/.config/goose/sessions/<session-id>.jsonl`. Live chat is not supported —
 * Goose does not expose a structured streaming interface to external processes.
 * `start()` throws a user-friendly error so the Composer is implicitly disabled
 * (the auth gate shows as "authenticated" but there is no live-session
 * capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listGooseSessions,
  readGooseSession,
  deleteGooseSession,
  readGooseMeta,
} from './parse'
import { listGooseSessionFiles } from './paths'
import { gooseAvailability } from './auth'

export const gooseChatRuntime: ChatRuntime = {
  agentId: 'goose',

  listSessions: (env, opts) => listGooseSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readGooseSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteGooseSession(env, sessionId),

  usage: {
    listFiles: async (env) =>
      (await listGooseSessionFiles(env)).map((filePath) => ({ filePath })),
    readMeta: (ref) => readGooseMeta(ref),
  },

  availability: (env: OsEnv) => gooseAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Goose handles its own
  // authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => gooseAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Goose. You can browse past sessions in read-only mode.',
    )
  },
}
