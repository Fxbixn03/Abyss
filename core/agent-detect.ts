/**
 * Detect whether an agent's CLI is installed and its version, by locating the
 * binary on PATH and running `<bin> --version`. Node-only. The binary name is
 * the agent id (claude / codex / gemini / cursor).
 */

import type { AgentInstallStatus } from '@/shared/types/agent'
import { findExecutable, runCommand } from './chat/cli'

export async function detectAgentInstall(
  agentId: string,
): Promise<AgentInstallStatus> {
  const binary = await findExecutable(agentId)
  if (!binary) return { installed: false }

  const result = await runCommand(binary, ['--version'])
  const out = `${result.stdout} ${result.stderr}`.trim()
  // Pull the first version-looking token, else the first line.
  const match = out.match(/\d+\.\d+\.\d+[\w.-]*/)
  const version = match ? match[0] : out.split('\n')[0]?.trim() || undefined
  return { installed: true, path: binary, version }
}
