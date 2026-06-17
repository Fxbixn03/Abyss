/**
 * GitHub Copilot CLI chat runtime — read-only history only.
 *
 * Copilot CLI stores AI conversations at
 * `~/.copilot/conversations/<session-id>.json`. Live chat is not supported —
 * GitHub Copilot runs as an IDE extension and CLI tool with its own internal AI
 * integration and does not expose a structured external streaming API. `start()`
 * throws a user-friendly error so the Composer is implicitly disabled (the auth
 * gate shows as "authenticated" but there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listCopilotSessions,
  readCopilotSession,
  deleteCopilotSession,
  readCopilotMeta,
  listCopilotSessionFileRefs,
} from './parse'
import { copilotAvailability } from './auth'

export const copilotChatRuntime: ChatRuntime = {
  agentId: 'copilot',

  listSessions: (env, opts) => listCopilotSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readCopilotSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteCopilotSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listCopilotSessionFileRefs(env),
    readMeta: (ref) => readCopilotMeta(ref),
  },

  availability: (env: OsEnv) => copilotAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Copilot handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => copilotAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for GitHub Copilot CLI. You can browse past sessions in read-only mode.',
    )
  },
}
