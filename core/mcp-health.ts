/**
 * MCP "test connection" health check. For stdio servers we speak the real MCP
 * JSON-RPC handshake (initialize → tools/list) over the child's stdio and report
 * the advertised tools. For http/sse we do a best-effort reachability probe.
 * Node-only.
 */

import { spawn } from 'node:child_process'
import type {
  McpHealthResult,
  McpServerEntry,
  McpToolCallResult,
  McpToolInfo,
} from '@/shared/types/config'

const STDIO_TIMEOUT_MS = 12_000
const HTTP_TIMEOUT_MS = 8_000

interface RawTool {
  name?: string
  description?: string
  inputSchema?: unknown
}

interface ToolCallContent {
  type?: string
  text?: string
}

interface JsonRpcMessage {
  id?: number
  result?: {
    serverInfo?: { name?: string; version?: string }
    tools?: RawTool[]
    /** tools/call result. */
    content?: ToolCallContent[]
    isError?: boolean
  }
  error?: { message?: string }
}

/** Map raw `tools/list` entries to our typed, name-guaranteed tool info. */
function toToolDetails(tools: RawTool[]): McpToolInfo[] {
  return tools
    .filter((t): t is RawTool & { name: string } => Boolean(t.name))
    .map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
}

/** Flatten an MCP tool result's content blocks into displayable text. */
function flattenContent(content: ToolCallContent[] | undefined): string {
  if (!content?.length) return ''
  return content
    .map((c) => (c.type === 'text' ? (c.text ?? '') : `[${c.type ?? 'block'}]`))
    .join('\n')
    .trim()
}

function checkStdio(
  entry: McpServerEntry,
  start: number,
  signal?: AbortSignal,
): Promise<McpHealthResult> {
  return new Promise((resolve) => {
    if (!entry.command) {
      resolve({ ok: false, tools: [], error: 'No command set.', durationMs: 0 })
      return
    }

    const child = spawn(entry.command, entry.args ?? [], {
      env: { ...process.env, ...(entry.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let buffer = ''
    let stderr = ''
    let settled = false
    let serverName: string | undefined
    let serverVersion: string | undefined

    const finish = (r: McpHealthResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      try {
        child.kill('SIGTERM')
      } catch {
        // ignore
      }
      resolve({ ...r, durationMs: Date.now() - start })
    }

    // External cancellation (renderer navigated away / re-tested): kill the
    // child instead of leaving an orphaned process running.
    const onAbort = () =>
      finish({ ok: false, tools: [], error: 'Cancelled.', durationMs: 0 })
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          tools: [],
          error: stderr.trim()
            ? `Timed out. ${stderr.trim().slice(0, 200)}`
            : 'Timed out waiting for the server to respond.',
          durationMs: 0,
        }),
      STDIO_TIMEOUT_MS,
    )

    const send = (obj: unknown) => {
      try {
        child.stdin.write(`${JSON.stringify(obj)}\n`)
      } catch {
        // ignore write-after-end
      }
    }

    child.stdout.on('data', (d: Buffer) => {
      buffer += d.toString()
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        let msg: JsonRpcMessage
        try {
          msg = JSON.parse(line) as JsonRpcMessage
        } catch {
          continue
        }
        if (msg.id === 1 && msg.result) {
          serverName = msg.result.serverInfo?.name
          serverVersion = msg.result.serverInfo?.version
          send({ jsonrpc: '2.0', method: 'notifications/initialized' })
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
        } else if (msg.id === 1 && msg.error) {
          finish({
            ok: false,
            tools: [],
            error: msg.error.message ?? 'initialize failed',
            durationMs: 0,
          })
        } else if (msg.id === 2) {
          if (msg.result) {
            const toolDetails = toToolDetails(msg.result.tools ?? [])
            finish({
              ok: true,
              tools: toolDetails.map((t) => t.name),
              toolDetails,
              serverName,
              serverVersion,
              durationMs: 0,
            })
          } else {
            finish({
              ok: false,
              tools: [],
              error: msg.error?.message ?? 'tools/list failed',
              serverName,
              durationMs: 0,
            })
          }
        }
      }
    })

    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('error', (err) =>
      finish({ ok: false, tools: [], error: String(err), durationMs: 0 }),
    )
    child.on('close', () =>
      finish({
        ok: false,
        tools: [],
        error: stderr.trim()
          ? stderr.trim().slice(0, 300)
          : 'Server exited before responding.',
        durationMs: 0,
      }),
    )

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'abyss', version: '1.0.0' },
      },
    })
  })
}

async function checkHttp(
  entry: McpServerEntry,
  start: number,
  signal?: AbortSignal,
): Promise<McpHealthResult> {
  if (!entry.url) {
    return { ok: false, tools: [], error: 'No URL set.', durationMs: 0 }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  // Fold external cancellation into the same signal we hand to fetch.
  signal?.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const res = await fetch(entry.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'abyss', version: '1.0.0' },
        },
      }),
      signal: controller.signal,
    })
    // Any HTTP response means the endpoint is reachable.
    return {
      ok: res.ok,
      tools: [],
      error: res.ok ? undefined : `HTTP ${res.status}`,
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      tools: [],
      error: err instanceof Error ? err.message : 'Endpoint unreachable.',
      durationMs: Date.now() - start,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function checkMcpHealth(
  entry: McpServerEntry,
  signal?: AbortSignal,
): Promise<McpHealthResult> {
  const start = Date.now()
  return entry.type === 'stdio'
    ? checkStdio(entry, start, signal)
    : checkHttp(entry, start, signal)
}

/**
 * Invoke a single tool on an MCP server (the "test tool" probe), so a user can
 * validate a server's behaviour before wiring it into an agent. Speaks the same
 * handshake as the health check, then `tools/call`. Node-only.
 */
function callStdioTool(
  entry: McpServerEntry,
  toolName: string,
  args: Record<string, unknown>,
  start: number,
  signal?: AbortSignal,
): Promise<McpToolCallResult> {
  return new Promise((resolve) => {
    if (!entry.command) {
      resolve({ ok: false, output: '', error: 'No command set.', durationMs: 0 })
      return
    }

    const child = spawn(entry.command, entry.args ?? [], {
      env: { ...process.env, ...(entry.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let buffer = ''
    let stderr = ''
    let settled = false

    const finish = (r: McpToolCallResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      try {
        child.kill('SIGTERM')
      } catch {
        // ignore
      }
      resolve({ ...r, durationMs: Date.now() - start })
    }

    const onAbort = () =>
      finish({ ok: false, output: '', error: 'Cancelled.', durationMs: 0 })
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          output: '',
          error: stderr.trim()
            ? `Timed out. ${stderr.trim().slice(0, 200)}`
            : 'Timed out waiting for the tool to respond.',
          durationMs: 0,
        }),
      STDIO_TIMEOUT_MS,
    )

    const send = (obj: unknown) => {
      try {
        child.stdin.write(`${JSON.stringify(obj)}\n`)
      } catch {
        // ignore write-after-end
      }
    }

    child.stdout.on('data', (d: Buffer) => {
      buffer += d.toString()
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        let msg: JsonRpcMessage
        try {
          msg = JSON.parse(line) as JsonRpcMessage
        } catch {
          continue
        }
        if (msg.id === 1 && msg.result) {
          send({ jsonrpc: '2.0', method: 'notifications/initialized' })
          send({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: toolName, arguments: args },
          })
        } else if (msg.id === 1 && msg.error) {
          finish({
            ok: false,
            output: '',
            error: msg.error.message ?? 'initialize failed',
            durationMs: 0,
          })
        } else if (msg.id === 2) {
          if (msg.result) {
            finish({
              ok: !msg.result.isError,
              output: flattenContent(msg.result.content),
              isError: msg.result.isError,
              durationMs: 0,
            })
          } else {
            finish({
              ok: false,
              output: '',
              error: msg.error?.message ?? 'tools/call failed',
              durationMs: 0,
            })
          }
        }
      }
    })

    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('error', (err) =>
      finish({ ok: false, output: '', error: String(err), durationMs: 0 }),
    )
    child.on('close', () =>
      finish({
        ok: false,
        output: '',
        error: stderr.trim()
          ? stderr.trim().slice(0, 300)
          : 'Server exited before responding.',
        durationMs: 0,
      }),
    )

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'abyss', version: '1.0.0' },
      },
    })
  })
}

export async function callMcpTool(
  entry: McpServerEntry,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<McpToolCallResult> {
  const start = Date.now()
  if (entry.type !== 'stdio') {
    return {
      ok: false,
      output: '',
      error: 'Tool invocation is only supported for stdio servers.',
      durationMs: 0,
    }
  }
  return callStdioTool(entry, toolName, args, start, signal)
}
