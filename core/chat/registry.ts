/**
 * Central registry of chat runtimes — the single place that knows which agents
 * support the Chats feature. Adding an agent is one `register(...)` line.
 */

import type { ChatRuntime } from './runtime'
import { claudeChatRuntime } from './claude/runtime'
import { codexChatRuntime } from './codex/runtime'
import { geminiChatRuntime } from './gemini/runtime'
import { cursorChatRuntime } from './cursor/runtime'
import { aiderChatRuntime } from './aider/runtime'
import { clineChatRuntime } from './cline/runtime'
import { rooChatRuntime } from './roo/runtime'
import { gooseChatRuntime } from './goose/runtime'
import { plandexChatRuntime } from './plandex/runtime'
import { amazonqChatRuntime } from './amazonq/runtime'
import { windsurfChatRuntime } from './windsurf/runtime'
import { warpChatRuntime } from './warp/runtime'
import { continueChatRuntime } from './continue/runtime'
import { copilotChatRuntime } from './copilot/runtime'
import { ampChatRuntime } from './amp/runtime'
import { kiroChatRuntime } from './kiro/runtime'
import { codyChatRuntime } from './cody/runtime'
import { zedChatRuntime } from './zed/runtime'
import { devinChatRuntime } from './devin/runtime'

const runtimes = new Map<string, ChatRuntime>()

function register(runtime: ChatRuntime): void {
  runtimes.set(runtime.agentId, runtime)
}

/**
 * Register (or replace) a chat runtime. Exposed for test injection; production
 * code should only call this at module-init time through the built-in list below.
 */
export function registerChatRuntime(runtime: ChatRuntime): void {
  register(runtime)
}

/**
 * Remove a previously registered runtime. Exposed for test teardown so injected
 * test runtimes do not leak between test files.
 */
export function unregisterChatRuntime(agentId: string): void {
  runtimes.delete(agentId)
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
register(geminiChatRuntime)
register(cursorChatRuntime)
register(aiderChatRuntime)
register(clineChatRuntime)
register(rooChatRuntime)
register(gooseChatRuntime)
register(plandexChatRuntime)
register(amazonqChatRuntime)
register(windsurfChatRuntime)
register(warpChatRuntime)
register(continueChatRuntime)
register(copilotChatRuntime)
register(ampChatRuntime)
register(kiroChatRuntime)
register(codyChatRuntime)
register(zedChatRuntime)
register(devinChatRuntime)
