/**
 * Codex chat runtime. History is delegated to parse.ts; live chat drives
 * `codex exec --json` once per turn and maps its streamed events onto the
 * normalized {@link ChatStreamEvent} union.
 *
 * NOTE: Codex's exec/JSON event schema is less stable than Claude's streaming
 * mode and was not verifiable locally. The mapping below is tolerant and should
 * be validated on a machine with `codex` installed.
 */

import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'
import type { OsEnv } from '@/shared/types/agent'
import type { ChatPermissionDecision } from '@/shared/types/chat'
import type { ChatRuntime, LiveSession, StartContext } from '../runtime'
import { asRecord, asString } from '../jsonl'
import {
  listCodexSessions,
  readCodexSession,
  deleteCodexSession,
} from './parse'
import {
  codexAvailability,
  codexLogin,
  codexLogout,
  findCodexBinary,
} from './auth'

class CodexLiveSession implements LiveSession {
  private child: ChildProcessWithoutNullStreams | null = null
  private sessionId: string | undefined
  private disposed = false

  constructor(
    private readonly binary: string,
    private readonly ctx: StartContext,
  ) {
    this.sessionId = ctx.options.resumeSessionId
  }

  async send(text: string): Promise<void> {
    if (this.child && this.child.exitCode === null) {
      // A turn is already running; ignore until it finishes.
      return
    }
    const args = ['exec', '--json']
    if (this.sessionId) args.push('resume', this.sessionId)
    args.push(text)

    const env = { ...process.env }
    if (this.ctx.options.apiKey) env.OPENAI_API_KEY = this.ctx.options.apiKey

    const child = spawn(this.binary, args, {
      cwd: this.ctx.options.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child

    this.ctx.emit({
      t: 'message_start',
      role: 'assistant',
      messageId: randomUUID(),
    })

    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity })
    rl.on('line', (line) => this.onLine(line))
    child.stderr.on('data', (d: Buffer) => {
      const t = d.toString().trim()
      if (t) this.ctx.emit({ t: 'error', message: t })
    })
    child.on('error', (err) =>
      this.ctx.emit({ t: 'error', message: String(err) }),
    )
    child.on('close', () => {
      rl.close()
      this.child = null
      if (!this.disposed) this.ctx.emit({ t: 'turn_end' })
    })
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

    const sid = asString(obj.session_id) ?? asString(asRecord(obj.session)?.id)
    if (sid) this.sessionId = sid

    // Pull assistant text from the common item shapes.
    const item = asRecord(obj.item) ?? obj
    const text =
      asString(item.text) ??
      asString(asRecord(item.message)?.text) ??
      asString(obj.delta)
    if (text && text.trim() !== '') {
      this.ctx.emit({ t: 'text_delta', text })
    }
  }

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

export const codexChatRuntime: ChatRuntime = {
  agentId: 'codex',

  listSessions: (env, opts) => listCodexSessions(env, opts),
  readSession: (env: OsEnv, sessionId: string) =>
    readCodexSession(env, sessionId),
  deleteSession: (env: OsEnv, sessionId: string) =>
    deleteCodexSession(env, sessionId),

  availability: (env: OsEnv) => codexAvailability(env),
  login: (env: OsEnv, apiKey?: string) => codexLogin(env, apiKey),
  logout: (env: OsEnv) => codexLogout(env),

  async start(ctx: StartContext): Promise<LiveSession> {
    const binary = await findCodexBinary()
    if (!binary) throw new Error('The `codex` CLI was not found on your PATH.')
    return new CodexLiveSession(binary, ctx)
  },
}
