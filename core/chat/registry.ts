/**
 * Central registry of chat runtimes — the single place that knows which agents
 * support the Chats feature. Adding an agent is one `register(...)` line.
 */

import type { ChatRuntime } from './runtime'
import { claudeChatRuntime } from './claude/runtime'
import { codexChatRuntime } from './codex/runtime'

const runtimes = new Map<string, ChatRuntime>()

function register(runtime: ChatRuntime): void {
  runtimes.set(runtime.agentId, runtime)
}

export function getChatRuntime(agentId: string): ChatRuntime {
  const runtime = runtimes.get(agentId)
  if (!runtime)
    throw new Error(`No chat runtime registered for agent: ${agentId}`)
  return runtime
}

export function hasChatRuntime(agentId: string): boolean {
  return runtimes.has(agentId)
}

export function listChatRuntimeIds(): string[] {
  return [...runtimes.keys()]
}

// --- Built-in chat runtimes (v1) -------------------------------------------
register(claudeChatRuntime)
register(codexChatRuntime)
