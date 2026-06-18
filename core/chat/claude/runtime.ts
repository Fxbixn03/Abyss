/**
 * Claude Code chat runtime: history (delegated to parse.ts), auth (auth.ts) and
 * live read/write chat by driving the `claude` CLI in streaming-JSON mode
 * (`--print --input-format stream-json --output-format stream-json`). Native
 * events are mapped onto the normalized {@link ChatStreamEvent} union.
 */

import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type { ChatPermissionDecision } from '@/shared/types/chat'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import { asRecord, asString } from '../jsonl'
import { blocksFromAnthropicContent } from '../normalize'
import {
  listClaudeSessions,
  readClaudeSession,
  deleteClaudeSession,
  readSessionMeta,
} from './parse'
import { listClaudeSessionFiles, findClaudeSessionFile } from './paths'
import {
  claudeAvailability,
  claudeLogin,
  claudeLogout,
  findClaudeBinary,
} from './auth'
import { ConfigWriteError } from '../../config-error'

/** Grace period after SIGTERM before a still-running child is force-killed. */
const KILL_ESCALATION_MS = 2500

class ClaudeLiveSession implements LiveSession {
  private child: ChildProcessWithoutNullStreams | null = null
  private sessionId: string | undefined
  private disposed = false
  private killTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * Accumulates streaming `tool_use` blocks by content-block index while their
   * input JSON arrives in `input_json_delta` fragments. Emitted as a complete
   * `block` event on `content_block_stop`. Reset at each `message_start`.
   */
  private partialTools = new Map<
    number,
    { id: string; name: string; json: string }
  >()

  constructor(
    private readonly binary: string,
    private readonly ctx: StartContext,
  ) {
    this.sessionId = ctx.options.resumeSessionId
  }

  /**
   * SIGTERM the child, then escalate to SIGKILL if it hasn't exited within the
   * grace period. The timer is cleared by the `close` handler set up in
   * {@link ensureProcess}, so a clean exit never leaks a timer or fires SIGKILL.
   */
  private terminate(child: ChildProcessWithoutNullStreams): void {
    child.kill('SIGTERM')
    if (this.killTimer) clearTimeout(this.killTimer)
    this.killTimer = setTimeout(() => {
      this.killTimer = null
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    }, KILL_ESCALATION_MS)
    this.killTimer.unref?.()
  }

  private clearKillTimer(): void {
    if (this.killTimer) {
      clearTimeout(this.killTimer)
      this.killTimer = null
    }
  }

  /** Spawn the process up front so the init event (sessionId) arrives early. */
  prime(): void {
    this.ensureProcess()
  }

  /** Build CLI args, resuming an existing session id when we have one. */
  private buildArgs(): string[] {
    const o = this.ctx.options
    const args = [
      '--print',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      // Emit token-by-token partial events so the transcript streams live
      // instead of appearing all at once when the turn completes.
      '--include-partial-messages',
      '--verbose',
      '--permission-mode',
      o.permissionMode,
    ]
    if (o.model) args.push('--model', o.model)
    if (this.sessionId) args.push('--resume', this.sessionId)
    return args
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.child && this.child.exitCode === null) return this.child

    const env = { ...process.env }
    if (this.ctx.options.apiKey) env.ANTHROPIC_API_KEY = this.ctx.options.apiKey

    const child = spawn(this.binary, this.buildArgs(), {
      cwd: this.ctx.options.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child

    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity })
    rl.on('line', (line) => this.onLine(line))
    child.stderr.on('data', (d: Buffer) => {
      const text = d.toString().trim()
      if (text) this.ctx.emit({ t: 'error', message: text })
    })
    child.on('error', (err) =>
      this.ctx.emit({ t: 'error', message: String(err) }),
    )
    child.on('close', () => {
      rl.close()
      this.clearKillTimer()
      if (!this.disposed) this.ctx.emit({ t: 'done' })
    })
    return child
  }

  private onLine(line: string): void {
    const trimmed = line.trim()
    if (trimmed === '') return
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return
    }
    const obj = asRecord(parsed)
    if (!obj) return
    const type = asString(obj.type)

    if (type === 'system' && asString(obj.subtype) === 'init') {
      this.sessionId = asString(obj.session_id) ?? this.sessionId
      this.ctx.emit({
        t: 'session_init',
        sessionId: this.sessionId ?? '',
        model: asString(obj.model),
        cwd: asString(obj.cwd),
      })
      return
    }

    // Token-by-token partial events (`--include-partial-messages`): these carry
    // the raw Anthropic stream event and drive the live transcript reveal.
    if (type === 'stream_event') {
      this.onPartialEvent(asRecord(obj.event))
      return
    }

    // Assistant turns are fully covered by the partial `stream_event` path
    // above, so the consolidated `assistant` line is redundant — skip it to
    // avoid emitting every block a second time. `user` lines (tool results)
    // are not part of partial streaming, so they are still surfaced here.
    if (type === 'user') {
      const message = asRecord(obj.message)
      if (!message) return
      const blocks = blocksFromAnthropicContent(message.content)
      if (blocks.length === 0) return
      this.ctx.emit({
        t: 'message_start',
        role: 'user',
        messageId: asString(message.id) ?? randomUUID(),
      })
      for (const block of blocks) {
        if (block.kind === 'text') {
          this.ctx.emit({ t: 'text_delta', text: block.text })
        } else if (block.kind === 'thinking') {
          this.ctx.emit({ t: 'thinking_delta', text: block.text })
        } else {
          this.ctx.emit({ t: 'block', block })
        }
      }
      return
    }

    if (type === 'result') {
      const usageRec = asRecord(obj.usage)
      this.ctx.emit({
        t: 'turn_end',
        stopReason: asString(obj.subtype),
        usage: {
          inputTokens:
            typeof usageRec?.input_tokens === 'number'
              ? usageRec.input_tokens
              : undefined,
          outputTokens:
            typeof usageRec?.output_tokens === 'number'
              ? usageRec.output_tokens
              : undefined,
          totalCostUsd:
            typeof obj.total_cost_usd === 'number'
              ? obj.total_cost_usd
              : undefined,
        },
      })
    }
  }

  /**
   * Map a single raw Anthropic streaming event (delivered inside a
   * `stream_event` line) onto normalized {@link ChatStreamEvent}s. Text and
   * thinking arrive as deltas so the transcript grows token-by-token; tool_use
   * blocks are reassembled from their `input_json_delta` fragments and emitted
   * whole on `content_block_stop`.
   */
  private onPartialEvent(event: Record<string, unknown> | undefined): void {
    if (!event) return
    const eventType = asString(event.type)

    switch (eventType) {
      case 'message_start': {
        const message = asRecord(event.message)
        this.partialTools.clear()
        this.ctx.emit({
          t: 'message_start',
          role: asString(message?.role) === 'user' ? 'user' : 'assistant',
          messageId: asString(message?.id) ?? randomUUID(),
        })
        return
      }
      case 'content_block_start': {
        const index = event.index
        const block = asRecord(event.content_block)
        if (typeof index === 'number' && asString(block?.type) === 'tool_use') {
          this.partialTools.set(index, {
            id: asString(block?.id) ?? '',
            name: asString(block?.name) ?? '',
            json: '',
          })
        }
        return
      }
      case 'content_block_delta': {
        const delta = asRecord(event.delta)
        const deltaType = asString(delta?.type)
        if (deltaType === 'text_delta') {
          const text = asString(delta?.text)
          if (text) this.ctx.emit({ t: 'text_delta', text })
        } else if (deltaType === 'thinking_delta') {
          const text = asString(delta?.thinking)
          if (text) this.ctx.emit({ t: 'thinking_delta', text })
        } else if (deltaType === 'input_json_delta') {
          const index = event.index
          const tool =
            typeof index === 'number' ? this.partialTools.get(index) : undefined
          if (tool) tool.json += asString(delta?.partial_json) ?? ''
        }
        return
      }
      case 'content_block_stop': {
        const index = event.index
        if (typeof index !== 'number') return
        const tool = this.partialTools.get(index)
        if (!tool) return
        this.partialTools.delete(index)
        let input: unknown
        try {
          input = tool.json ? JSON.parse(tool.json) : {}
        } catch {
          input = {}
        }
        this.ctx.emit({
          t: 'block',
          block: { kind: 'tool_use', id: tool.id, name: tool.name, input },
        })
        return
      }
      // message_delta / message_stop: turn completion is driven by the
      // top-level `result` line, so nothing to do here.
    }
  }

  async send(text: string): Promise<void> {
    const child = this.ensureProcess()
    const payload =
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text }] },
      }) + '\n'
    child.stdin.write(payload)
  }

  // v1 approves tools via --permission-mode, so there is no interactive
  // per-tool prompt to answer yet. Kept for the open contract / future agents.
  async respondPermission(
    _requestId: string,
    _decision: ChatPermissionDecision,
  ): Promise<void> {
    void _requestId
    void _decision
  }

  async interrupt(): Promise<void> {
    const child = this.child
    if (child && child.exitCode === null) {
      this.terminate(child)
      this.child = null
      this.ctx.emit({ t: 'turn_end', stopReason: 'interrupted' })
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    const child = this.child
    if (child && child.exitCode === null) this.terminate(child)
    this.child = null
  }
}

export const claudeChatRuntime: ChatRuntime = {
  agentId: 'claude',

  listSessions: (env, opts) => listClaudeSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readClaudeSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteClaudeSession(env, sessionId),

  /**
   * Rename a Claude session by appending a `{ type: 'summary', summary: title
   * }` line to the JSONL file. The existing parser prefers `summary` over the
   * first-message title, so the rename takes effect on the next read.
   */
  async renameSession(
    env: OsEnv,
    sessionId: string,
    title: string,
  ): Promise<void> {
    const found = await findClaudeSessionFile(env, sessionId)
    if (!found) {
      throw new ConfigWriteError(sessionId, new Error('Session file not found'))
    }
    const line = JSON.stringify({ type: 'summary', summary: title }) + '\n'
    try {
      await fs.appendFile(found.filePath, line, 'utf8')
    } catch (err) {
      throw new ConfigWriteError(found.filePath, err)
    }
  },

  usage: {
    listFiles: (env) => listClaudeSessionFiles(env),
    readMeta: (ref) => readSessionMeta(ref.filePath, ref.projectDir ?? ''),
  },

  availability: (env: OsEnv) => claudeAvailability(env),
  login: (env: OsEnv, apiKey?: string) => claudeLogin(env, apiKey),
  logout: (env: OsEnv) => claudeLogout(env),

  async start(ctx: StartContext): Promise<LiveSession> {
    const binary = await findClaudeBinary()
    if (!binary) throw new Error('The `claude` CLI was not found on your PATH.')
    const session = new ClaudeLiveSession(binary, ctx)
    session.prime()
    return session
  },
}
