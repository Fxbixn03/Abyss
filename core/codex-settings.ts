/**
 * Codex approval + sandbox settings, stored in `~/.codex/config.toml` (or
 * `<base>/config.toml`). This is Codex's equivalent of Claude's permissions,
 * but with a different model: `approval_policy` + `sandbox_mode` (+ network
 * access under `[sandbox_workspace_write]`). Other keys are preserved on write.
 * Node-only.
 */

import os from 'node:os'
import path from 'node:path'
import { parse, stringify } from 'smol-toml'
import type {
  CodexApprovalPolicy,
  CodexSandboxMode,
  CodexSettings,
} from '@/shared/types/config'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'

const APPROVALS: CodexApprovalPolicy[] = [
  'untrusted',
  'on-failure',
  'on-request',
  'never',
]
const SANDBOXES: CodexSandboxMode[] = [
  'read-only',
  'workspace-write',
  'danger-full-access',
]

const DEFAULTS: CodexSettings = {
  approvalPolicy: 'on-request',
  sandboxMode: 'workspace-write',
  networkAccess: false,
}

function configPath(basePath: string): string {
  const dir =
    basePath && basePath.trim() !== ''
      ? basePath
      : path.join(os.homedir(), '.codex')
  return path.join(dir, 'config.toml')
}

async function readToml(file: string): Promise<Record<string, unknown>> {
  if (!(await pathExists(file))) return {}
  try {
    return parse(await readTextFile(file)) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function readCodexSettings(
  basePath: string,
): Promise<CodexSettings> {
  const data = await readToml(configPath(basePath))
  const approval = data.approval_policy
  const sandbox = data.sandbox_mode
  const sww = (data.sandbox_workspace_write ?? {}) as Record<string, unknown>
  return {
    approvalPolicy: APPROVALS.includes(approval as CodexApprovalPolicy)
      ? (approval as CodexApprovalPolicy)
      : DEFAULTS.approvalPolicy,
    sandboxMode: SANDBOXES.includes(sandbox as CodexSandboxMode)
      ? (sandbox as CodexSandboxMode)
      : DEFAULTS.sandboxMode,
    networkAccess: sww.network_access === true,
  }
}

export async function writeCodexSettings(
  basePath: string,
  settings: CodexSettings,
): Promise<{ success: boolean; path: string }> {
  const file = configPath(basePath)
  const data = await readToml(file)

  data.approval_policy = settings.approvalPolicy
  data.sandbox_mode = settings.sandboxMode
  const sww = (data.sandbox_workspace_write ?? {}) as Record<string, unknown>
  sww.network_access = settings.networkAccess
  data.sandbox_workspace_write = sww

  await writeTextFileAtomic(file, stringify(data))
  return { success: true, path: file }
}
