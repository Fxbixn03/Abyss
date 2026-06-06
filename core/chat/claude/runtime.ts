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
import type { OsEnv } from '@/shared/types/agent'
import type { ChatPermissionDecision } from '@/shared/types/chat'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import { asRecord, asString } from '../jsonl'
import { blocksFromAnthropicContent } from '../normalize'
import {
  listClaudeSessions,
  readClaudeSession,
  deleteClaudeSession,
} from './parse'
import {
  claudeAvailability,
  claudeLogin,
  claudeLogout,
  findClaudeBinary,
} from './auth'

class ClaudeLiveSession implements LiveSession {
  private child: ChildProcessWithoutNullStreams | null = null
  private sessionId: string | undefined
  private disposed = false

  constructor(
    private readonly binary: string,
    private readonly ctx: StartContext,
  ) {
    this.sessionId = ctx.options.resumeSessionId
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

    if (type === 'assistant' || type === 'user') {
      const message = asRecord(obj.message)
      if (!message) return
      const blocks = blocksFromAnthropicContent(message.content)
      if (blocks.length === 0) return
      const role = type === 'assistant' ? 'assistant' : 'user'
      this.ctx.emit({
        t: 'message_start',
        role,
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
    if (this.child && this.child.exitCode === null) {
      this.child.kill('SIGTERM')
      this.child = null
      this.ctx.emit({ t: 'turn_end', stopReason: 'interrupted' })
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    if (this.child && this.child.exitCode === null) this.child.kill('SIGTERM')
    this.child = null
  }
}

export const claudeChatRuntime: ChatRuntime = {
  agentId: 'claude',

  listSessions: (env: OsEnv) => listClaudeSessions(env),
  readSession: (env: OsEnv, sessionId: string) =>
    readClaudeSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteClaudeSession(env, sessionId),

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
