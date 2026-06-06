/**
 * Owns the set of live chat sessions for the running app. Maps an opaque
 * `liveId` to a {@link LiveSession}, routes send/interrupt/permission to it, and
 * tears everything down (plus ephemeral logouts) on quit.
 */

import { randomUUID } from 'node:crypto'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatPermissionDecision,
  ChatStartOptions,
  ChatStreamEnvelope,
} from '@/shared/types/chat'
import type { LiveSession } from './runtime'
import { getChatRuntime } from './registry'
import { runEphemeralLogouts } from './auth'

const sessions = new Map<string, LiveSession>()

function get(liveId: string): LiveSession {
  const session = sessions.get(liveId)
  if (!session) throw new Error(`No live chat session: ${liveId}`)
  return session
}

export async function startChat(
  env: OsEnv,
  options: ChatStartOptions,
  emit: (envelope: ChatStreamEnvelope) => void,
): Promise<string> {
  const runtime = getChatRuntime(options.agentId)
  const liveId = randomUUID()
  const session = await runtime.start({
    env,
    options,
    emit: (event) => emit({ liveId, event }),
  })
  sessions.set(liveId, session)
  return liveId
}

export function sendChat(liveId: string, text: string): Promise<void> {
  return get(liveId).send(text)
}

export function respondPermission(
  liveId: string,
  requestId: string,
  decision: ChatPermissionDecision,
): Promise<void> {
  return get(liveId).respondPermission(requestId, decision)
}

export function interruptChat(liveId: string): Promise<void> {
  return get(liveId).interrupt()
}

export async function stopChat(liveId: string): Promise<void> {
  const session = sessions.get(liveId)
  if (!session) return
  sessions.delete(liveId)
  await session.dispose()
}

/** Kill every live process and run ephemeral logouts. Called on app quit. */
export async function disposeAllChats(): Promise<void> {
  const all = [...sessions.values()]
  sessions.clear()
  await Promise.all(all.map((s) => s.dispose().catch(() => undefined)))
  await runEphemeralLogouts()
}
