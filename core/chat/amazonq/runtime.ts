/**
 * Amazon Q Developer CLI chat runtime — read-only history only.
 *
 * Amazon Q Developer CLI stores each conversation as a JSON file under
 * `~/.aws/amazonq/conversations/<uuid>.json`. Live chat is not supported —
 * Amazon Q runs as its own CLI and does not expose a structured streaming
 * interface that Abyss can drive. `start()` throws a user-friendly error so
 * the Composer is implicitly disabled (the auth gate shows as "authenticated"
 * but `availability.readOnly` is `true`, hiding the Composer in ChatsPage).
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import {
  listAmazonqSessions,
  readAmazonqSession,
  deleteAmazonqSession,
  readAmazonqMeta,
  listAmazonqSessionFileRefs,
} from './parse'
import { amazonqAvailability } from './auth'

export const amazonqChatRuntime: ChatRuntime = {
  agentId: 'amazonq',

  listSessions: (env, opts) => listAmazonqSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readAmazonqSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteAmazonqSession(env, sessionId),

  usage: {
    listFiles: (env: OsEnv) => listAmazonqSessionFileRefs(env),
    readMeta: (ref) => readAmazonqMeta(ref),
  },

  availability: (env: OsEnv) => amazonqAvailability(env),

  // Login / logout are no-ops for a read-only runtime — Amazon Q handles its
  // own authentication independently and Abyss never stores any credentials.
  login: async (env: OsEnv) => amazonqAvailability(env),
  logout: async (_env: OsEnv) => {
    /* no-op */
  },

  start: async (_ctx: StartContext): Promise<LiveSession> => {
    throw new Error(
      'Live chat is not yet supported for Amazon Q Developer. You can browse past conversations in read-only mode.',
    )
  },
}
