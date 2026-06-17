/**
 * Windsurf chat runtime — read-only history only.
 *
 * Windsurf (Codeium) stores conversations at
 * `~/.codeium/windsurf/conversations/<uuid>.json`. Live chat is not supported
 * — Windsurf runs inside VS Code / its own editor and does not expose a
 * structured external streaming API. `start()` throws a user-friendly error so
 * the Composer is implicitly disabled (the auth gate shows as "authenticated"
 * but there is no live-session capability).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listWindsurfSessions,
  readWindsurfSession,
  deleteWindsurfSession,
  readWindsurfMeta,
  listWindsurfSessionFileRefs,
} from './parse'
import { windsurfAvailability } from './auth'

export const windsurfChatRuntime: ChatRuntime = {
  agentId: 'windsurf',

  listSessions: (env, opts) => listWindsurfSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readWindsurfSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteWindsurfSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listWindsurfSessionFileRefs(env),
    readMeta: (ref) => readWindsurfMeta(ref),
  },

  availability: (env: OsEnv) => windsurfAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Windsurf handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => windsurfAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not supported for Windsurf. You can browse past sessions in read-only mode.',
    )
  },
}
