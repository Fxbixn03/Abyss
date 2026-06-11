/**
 * Interactive terminal menu for non-technical users — pick an agent, then
 * toggle its MCP servers on/off. Mirrors the GUI's MCP page in the terminal,
 * reusing the same `core/` read/write functions. Built on node:readline so it
 * needs no extra dependency. Launched by `abyss tui` (or the bare `abyss` in a
 * TTY); in a non-TTY environment the CLI prints help instead.
 */

import { createInterface, type Interface } from 'node:readline'
import { resolveOsEnv } from '@core/os-env'
import { effectiveBasePath } from '@core/agent-paths'
import { readMcpServers, writeMcpServers } from '@core/mcp'
import { pathExists } from '@core/json-file'
import { getActiveAgentDefinitions } from '@/shared/agents/defs'

interface AgentRow {
  id: string
  displayName: string
  basePath: string
}

function ask(rl: Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve))
}

/** Agents that support MCP and have an existing config directory on disk. */
async function mcpAgents(): Promise<AgentRow[]> {
  const env = resolveOsEnv()
  const rows: AgentRow[] = []
  for (const def of getActiveAgentDefinitions()) {
    if (!def.capabilities.mcp) continue
    const basePath = await effectiveBasePath(def.id, env)
    if (await pathExists(basePath)) {
      rows.push({ id: def.id, displayName: def.displayName, basePath })
    }
  }
  return rows
}

async function agentMenu(rl: Interface, agent: AgentRow): Promise<void> {
  for (;;) {
    const servers = await readMcpServers(agent.id, agent.basePath)
    console.log(`\n${agent.displayName} — MCP servers`)
    if (servers.length === 0) {
      console.log('  (none configured)')
    } else {
      servers.forEach((s, i) => {
        const mark = s.enabled ? '[x]' : '[ ]'
        const where =
          s.type === 'stdio' ? (s.command ?? '') : (s.url ?? '')
        console.log(`  ${i + 1}. ${mark} ${s.name}  (${s.type}) ${where}`)
      })
    }
    console.log('  Enter a number to toggle, b = back, q = quit.')
    const answer = (await ask(rl, '> ')).trim().toLowerCase()

    if (answer === 'q') {
      rl.close()
      process.exit(0)
    }
    if (answer === 'b' || answer === '') return

    const idx = Number.parseInt(answer, 10) - 1
    if (Number.isNaN(idx) || idx < 0 || idx >= servers.length) {
      console.log('  Not a valid choice.')
      continue
    }
    const next = servers.map((s, i) =>
      i === idx ? { ...s, enabled: !s.enabled } : s,
    )
    await writeMcpServers(agent.id, agent.basePath, next)
    console.log(
      `  ${next[idx].enabled ? 'Enabled' : 'Disabled'} "${next[idx].name}".`,
    )
  }
}

export async function runTui(): Promise<void> {
  const agents = await mcpAgents()
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  // EOF (piped input ends, or Ctrl-D) cleanly ends the session instead of
  // leaving a pending prompt hanging.
  rl.on('close', () => process.exit(0))

  try {
    if (agents.length === 0) {
      console.log(
        'No MCP-capable agents detected on this machine. Nothing to manage.',
      )
      return
    }

    for (;;) {
      console.log('\nAbyss — pick an agent to manage its MCP servers:')
      agents.forEach((a, i) => console.log(`  ${i + 1}. ${a.displayName}`))
      console.log('  q = quit.')
      const answer = (await ask(rl, '> ')).trim().toLowerCase()
      if (answer === 'q' || answer === '') return
      const idx = Number.parseInt(answer, 10) - 1
      if (Number.isNaN(idx) || idx < 0 || idx >= agents.length) {
        console.log('  Not a valid choice.')
        continue
      }
      await agentMenu(rl, agents[idx])
    }
  } finally {
    rl.close()
  }
}
