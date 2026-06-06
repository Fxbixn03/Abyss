/**
 * Sandbox command runner. Spawns a one-off shell command with a hard timeout
 * and bounded output, so the UI can let users try a hook/command snippet and see
 * its stdout/stderr/exit code. Node-only.
 */

import { exec } from 'node:child_process'
import type { SandboxRunResult } from '@/shared/types/sandbox'

const MAX_TIMEOUT_MS = 60_000
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_OUTPUT = 256 * 1024

export function runSandboxCommand(
  command: string,
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<SandboxRunResult> {
  const timeout = Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  const start = Date.now()

  return new Promise((resolve) => {
    if (!command.trim()) {
      resolve({
        stdout: '',
        stderr: 'No command given.',
        exitCode: null,
        durationMs: 0,
        timedOut: false,
      })
      return
    }

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
