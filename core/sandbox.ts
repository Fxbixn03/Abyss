/**
 * Sandbox command runner. Spawns a one-off shell command with a hard timeout
 * and bounded output, so the UI can let users try a hook/command snippet and see
 * its stdout/stderr/exit code. Node-only.
 */

import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { isWellFormedPath } from './path-scope'
import type { SandboxRunResult } from '@/shared/types/sandbox'

const MAX_TIMEOUT_MS = 60_000
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_OUTPUT = 256 * 1024

/**
 * Validate a sandbox working directory. Defense-in-depth at the core level: a
 * cwd must be well-formed (no empty / NUL-byte strings) and resolve to a real
 * directory. We intentionally don't enforce a tighter allowlist here — the
 * legitimate cwd is any project directory the user picks — so the IPC layer
 * additionally scopes it to the allowed roots before calling us.
 */
async function isUsableCwd(cwd: string): Promise<boolean> {
  if (!isWellFormedPath(cwd)) return false
  try {
    return (await fs.stat(cwd)).isDirectory()
  } catch {
    return false
  }
}

export async function runSandboxCommand(
  command: string,
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<SandboxRunResult> {
  const timeout = Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  const start = Date.now()

  if (!command.trim()) {
    return {
      stdout: '',
      stderr: 'No command given.',
      exitCode: null,
      durationMs: 0,
      timedOut: false,
    }
  }

  // A cwd was requested but isn't a real directory — bail rather than silently
  // falling back to the process cwd, which could run the command somewhere
  // unexpected.
  if (opts.cwd !== undefined && !(await isUsableCwd(opts.cwd))) {
    return {
      stdout: '',
      stderr: `Working directory not found: ${opts.cwd}`,
      exitCode: null,
      durationMs: Date.now() - start,
      timedOut: false,
    }
  }

  return new Promise<SandboxRunResult>((resolve) => {
    exec(
      command,
      {
        cwd: opts.cwd || undefined,
        timeout,
        maxBuffer: MAX_OUTPUT,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        const e = err as
          | (Error & { code?: number; killed?: boolean; signal?: string })
          | null
        const timedOut = Boolean(e?.killed && e?.signal === 'SIGTERM')
        const exitCode =
          e && typeof e.code === 'number' ? e.code : err ? null : 0
        resolve({
          stdout: String(stdout).slice(0, MAX_OUTPUT),
          stderr: String(stderr).slice(0, MAX_OUTPUT),
          exitCode,
          durationMs: Date.now() - start,
          timedOut,
        })
      },
    )
  })
}
