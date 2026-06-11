/**
 * Config Doctor engine. Runs fast, static checks over each enabled agent's
 * on-disk config and returns a flat finding list — plus a tiny set of safe,
 * reversible auto-fixes. Never spawns a process or hits the network, so a scan
 * is cheap and side-effect free; only {@link applyDoctorFix} writes, and it does
 * so through the same snapshotting atomic-write path as every other config edit.
 */

import { readMcpServers, writeMcpServers } from './mcp'
import { readHooks, writeHooks } from './hooks'
import { readPermissions } from './claude-settings'
import type {
  DoctorAgentInput,
  DoctorFinding,
  DoctorFix,
  DoctorFixResult,
  DoctorReport,
} from '@/shared/types/doctor'

/** Allow-rules that hand an agent broad, unguarded shell/tool access. */
const RISKY_ALLOW = new Set(['*', 'Bash', 'Bash(*)', 'Shell', 'Shell(*)'])

function isRiskyAllow(rule: string): boolean {
  const r = rule.trim()
  return RISKY_ALLOW.has(r) || /^Bash\(\s*\*\s*\)$/.test(r)
}

async function checkMcp(input: DoctorAgentInput): Promise<DoctorFinding[]> {
  const { agentId, displayName, basePath } = input
  const out: DoctorFinding[] = []
  let servers
  try {
    servers = await readMcpServers(agentId, basePath)
  } catch (err) {
    out.push({
      id: `${agentId}:mcp:parse`,
      agentId,
      agentName: displayName,
      severity: 'error',
      category: 'settings',
      title: 'MCP config could not be parsed',
      detail:
        err instanceof Error
          ? err.message
          : 'The MCP configuration file contains invalid JSON.',
      route: '/mcp',
    })
    return out
  }

  const seen = new Map<string, number>()
  for (const s of servers) {
    seen.set(s.name, (seen.get(s.name) ?? 0) + 1)
    const isStdio = s.type === 'stdio'
    const missingStdio = isStdio && !s.command?.trim()
    const missingRemote = !isStdio && !s.url?.trim()
    if (missingStdio || missingRemote) {
      out.push({
        id: `${agentId}:mcp:incomplete:${s.id}`,
        agentId,
        agentName: displayName,
        severity: 'error',
        category: 'mcp',
        title: `MCP server “${s.name}” is incomplete`,
        detail: missingStdio
          ? 'A stdio server with no command can never start.'
          : 'A remote server with no URL can never connect.',
        route: '/mcp',
        fix: {
          kind: 'remove-mcp-server',
          agentId,
          basePath,
          serverId: s.id,
          serverName: s.name,
        },
      })
    }
  }

  for (const [name, count] of seen) {
    if (count > 1) {
      out.push({
        id: `${agentId}:mcp:dup:${name}`,
        agentId,
        agentName: displayName,
        severity: 'warning',
        category: 'mcp',
        title: `Duplicate MCP server “${name}”`,
        detail: `“${name}” is defined ${count} times — only one will take effect.`,
        route: '/mcp',
      })
    }
  }
  return out
}

async function checkHooks(input: DoctorAgentInput): Promise<DoctorFinding[]> {
  const { agentId, displayName, basePath } = input
  let hooks
  try {
    hooks = await readHooks(agentId, basePath)
  } catch (err) {
    return [
      {
        id: `${agentId}:hooks:parse`,
        agentId,
        agentName: displayName,
        severity: 'error',
        category: 'settings',
        title: 'Hooks config could not be parsed',
        detail:
          err instanceof Error
            ? err.message
            : 'The hooks configuration contains invalid JSON.',
        route: '/hooks',
      },
    ]
  }

  const empty = hooks.filter((h) => !h.command.trim())
  if (empty.length === 0) return []
  return [
    {
      id: `${agentId}:hooks:empty`,
      agentId,
      agentName: displayName,
      severity: 'warning',
      category: 'hooks',
      title: `${empty.length} hook${empty.length === 1 ? '' : 's'} with no command`,
      detail:
        'Empty hooks do nothing and clutter the config. They can be removed safely.',
      route: '/hooks',
      fix: { kind: 'remove-empty-hooks', agentId, basePath },
    },
  ]
}

async function checkPermissions(
  input: DoctorAgentInput,
): Promise<DoctorFinding[]> {
  const { agentId, displayName, basePath } = input
  let perms
  try {
    perms = await readPermissions(basePath)
  } catch (err) {
    return [
      {
        id: `${agentId}:perms:parse`,
        agentId,
        agentName: displayName,
        severity: 'error',
        category: 'settings',
        title: 'Permissions could not be parsed',
        detail:
          err instanceof Error
            ? err.message
            : 'The settings file contains invalid JSON.',
        route: '/permissions',
      },
    ]
  }

  const out: DoctorFinding[] = []
  const risky = perms.allow.filter(isRiskyAllow)
  if (risky.length > 0) {
    out.push({
      id: `${agentId}:perms:risky`,
      agentId,
      agentName: displayName,
      severity: 'warning',
      category: 'permissions',
      title: 'Unrestricted tool access allowed',
      detail: `Allow rule${risky.length === 1 ? '' : 's'} ${risky
        .map((r) => `“${r}”`)
        .join(', ')} grant broad, unguarded access. Consider scoping them.`,
      route: '/permissions',
    })
  }

  const noGuardrails =
    perms.allow.length === 0 &&
    perms.deny.length === 0 &&
    perms.ask.length === 0 &&
    (perms.defaultMode === 'bypassPermissions' ||
      perms.defaultMode === 'acceptEdits')
  if (noGuardrails) {
    out.push({
      id: `${agentId}:perms:noguardrails`,
      agentId,
      agentName: displayName,
      severity: 'info',
      category: 'permissions',
      title: 'No permission rules set',
      detail: `The default mode is “${perms.defaultMode}” with no allow/ask/deny rules — the agent runs with little oversight.`,
      route: '/permissions',
    })
  }
  return out
}

/** Run every applicable check for one agent. */
async function scanAgent(input: DoctorAgentInput): Promise<DoctorFinding[]> {
  const { agentId, displayName, basePath, caps } = input
  if (!basePath) {
    return [
      {
        id: `${agentId}:general:nobase`,
        agentId,
        agentName: displayName,
        severity: 'info',
        category: 'general',
        title: 'No config directory found',
        detail: `Abyss couldn't locate a config directory for ${displayName}. Set its path in Settings or disable it.`,
        route: '/settings',
      },
    ]
  }

  const groups = await Promise.all([
    caps.mcp ? checkMcp(input) : Promise.resolve([]),
    caps.hooks ? checkHooks(input) : Promise.resolve([]),
    caps.permissions ? checkPermissions(input) : Promise.resolve([]),
  ])
  return groups.flat()
}

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 } as const

export async function runDoctor(
  agents: DoctorAgentInput[],
): Promise<DoctorReport> {
  const grouped = await Promise.all(agents.map(scanAgent))
  const findings = grouped
    .flat()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  const counts = { error: 0, warning: 0, info: 0 }
  for (const f of findings) counts[f.severity] += 1

  return {
    findings,
    checkedAt: new Date().toISOString(),
    agentCount: agents.length,
    counts,
  }
}

/**
 * Apply a structured fix. `scopePath` re-validates the write target against
 * Abyss's allowed roots (handed in by the IPC layer), matching every other
 * config write.
 */
export async function applyDoctorFix(
  fix: DoctorFix,
  scopePath: (p: string) => string,
): Promise<DoctorFixResult> {
  if (fix.kind === 'remove-mcp-server') {
    const servers = await readMcpServers(fix.agentId, fix.basePath)
    const next = servers.filter((s) => s.id !== fix.serverId)
    if (next.length === servers.length) {
      return { success: false, message: 'That server was already gone.' }
    }
    await writeMcpServers(fix.agentId, scopePath(fix.basePath), next)
    return { success: true, message: `Removed “${fix.serverName}”.` }
  }

  // remove-empty-hooks
  const hooks = await readHooks(fix.agentId, fix.basePath)
  const next = hooks.filter((h) => h.command.trim())
  const removed = hooks.length - next.length
  if (removed === 0) {
    return { success: false, message: 'No empty hooks left to remove.' }
  }
  await writeHooks(fix.agentId, scopePath(fix.basePath), next)
  return {
    success: true,
    message: `Removed ${removed} empty hook${removed === 1 ? '' : 's'}.`,
  }
}
