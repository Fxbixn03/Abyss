#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import { createInterface } from 'node:readline'
import { Command } from 'commander'
import { resolveOsEnv } from '@core/os-env'
import { detectAllAgentPaths } from '@core/agent-paths'
import { applyBundle, exportBundle } from '@core/bundle'
import { redactBundleSecrets } from '@core/bundle-redact'
import type { ExportBundle } from '@core/bundle'
import { listAbyssMcpTools, callAbyssMcpTool } from '@core/mcp-server'
import { runTui } from './tui'
import { getActiveAgentDefinitions } from '@/shared/agents/defs'

const program = new Command()

program
  .name('abyss')
  .description('Abyss CLI — manage AI coding agent config from the terminal.')
  .version('1.0.0')

program
  .command('detect')
  .description('Show auto-detected config locations for each agent.')
  .action(async () => {
    const env = resolveOsEnv()
    const detected = await detectAllAgentPaths(env)
    for (const def of getActiveAgentDefinitions()) {
      console.log(`\n${def.displayName} (${def.id})`)
      for (const candidate of detected[def.id] ?? []) {
        console.log(`  ${candidate.exists ? '✓' : '·'} ${candidate.path}`)
      }
    }
  })

program
  .command('export')
  .description('Export agent config into a portable bundle.')
  .option('-a, --agent <id...>', 'limit to specific agent ids')
  .option('-o, --out <file>', 'write to a file instead of stdout')
  .option(
    '--include-secrets',
    'keep real MCP env tokens in the bundle (redacted by default)',
  )
  .action(
    async (opts: {
      agent?: string[]
      out?: string
      includeSecrets?: boolean
    }) => {
      const env = resolveOsEnv()
      const raw = await exportBundle(env, { agentIds: opts.agent })
      const { bundle, redactedCount } = opts.includeSecrets
        ? { bundle: raw, redactedCount: 0 }
        : redactBundleSecrets(raw)
      const json = JSON.stringify(bundle, null, 2)
      if (opts.out) {
        await fs.writeFile(opts.out, `${json}\n`, 'utf8')
        console.log(`Exported ${bundle.agents.length} agent(s) to ${opts.out}`)
        if (redactedCount > 0) {
          console.log(
            `Redacted ${redactedCount} secret(s) — use --include-secrets to keep them.`,
          )
        }
      } else {
        console.log(json)
      }
    },
  )

program
  .command('apply')
  .description('Apply a config bundle to disk.')
  .argument('<file>', 'bundle JSON file produced by `abyss export`')
  .option('--dry-run', 'show what would change without writing')
  .action(async (file: string, opts: { dryRun?: boolean }) => {
    const raw = await fs.readFile(file, 'utf8')
    const bundle = JSON.parse(raw) as ExportBundle
    const changes = await applyBundle(bundle, { dryRun: opts.dryRun })
    const changed = changes.filter((c) => c.changed)

    if (changed.length === 0) {
      console.log('Everything is already up to date.')
      return
    }

    console.log(opts.dryRun ? 'Planned changes:' : 'Applied changes:')
    for (const change of changed) {
      console.log(`  ~ [${change.agentId}/${change.kind}] ${change.target}`)
    }
    if (opts.dryRun) {
      console.log(
        `\n${changed.length} target(s) would change. Re-run without --dry-run to apply.`,
      )
    }
  })

program
  .command('tui')
  .description('Interactive menu to toggle each agent’s MCP servers.')
  .action(async () => {
    await runTui()
  })

program
  .command('serve')
  .description(
    'Run Abyss as an MCP server over stdio, so an MCP client (Claude Code, ' +
      'Cursor, …) can inspect and edit your agent config programmatically.',
  )
  .action(() => {
    runMcpServer()
  })

/** Minimal newline-delimited JSON-RPC loop implementing the MCP server side. */
function runMcpServer(): void {
  const env = resolveOsEnv()
  // The protocol owns stdout — every log line must go to stderr instead.
  const log = (msg: string) => process.stderr.write(`${msg}\n`)
  const write = (obj: unknown) => process.stdout.write(`${JSON.stringify(obj)}\n`)
  const reply = (id: unknown, result: unknown) =>
    write({ jsonrpc: '2.0', id, result })
  const fail = (id: unknown, code: number, message: string) =>
    write({ jsonrpc: '2.0', id, error: { code, message } })

  interface RpcRequest {
    id?: unknown
    method?: string
    params?: { name?: string; arguments?: Record<string, unknown> }
  }

  const handle = async (req: RpcRequest): Promise<void> => {
    const { id, method } = req
    switch (method) {
      case 'initialize':
        reply(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'abyss', version: program.version() },
        })
        return
      case 'notifications/initialized':
        return // notification: no response
      case 'ping':
        reply(id, {})
        return
      case 'tools/list':
        reply(id, { tools: listAbyssMcpTools() })
        return
      case 'tools/call': {
        const name = req.params?.name ?? ''
        const args = req.params?.arguments ?? {}
        const result = await callAbyssMcpTool(name, args, env)
        reply(id, {
          content: [{ type: 'text', text: result.text }],
          isError: result.isError,
        })
        return
      }
      default:
        if (id !== undefined) fail(id, -32601, `Method not found: ${method}`)
    }
  }

  const rl = createInterface({ input: process.stdin })
  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let req: RpcRequest
    try {
      req = JSON.parse(trimmed) as RpcRequest
    } catch {
      log(`Ignoring non-JSON line: ${trimmed.slice(0, 80)}`)
      return
    }
    void handle(req).catch((err: unknown) => {
      log(err instanceof Error ? err.message : String(err))
      if (req.id !== undefined) fail(req.id, -32603, 'Internal error')
    })
  })
  rl.on('close', () => process.exit(0))
  log('Abyss MCP server ready on stdio.')
}

// Bare `abyss` with no subcommand: launch the interactive TUI in a real
// terminal, but stay agent-first — in a non-TTY/automation context, print help
// instead of blocking on input.
if (process.argv.length <= 2) {
  if (process.stdin.isTTY) {
    runTui().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
  } else {
    program.help()
  }
} else {
  program.parseAsync().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
