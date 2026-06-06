/**
 * Small cross-platform helpers for locating and running agent CLI binaries.
 * Node-only. Used by the per-agent chat runtimes (auth + live spawning).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

/** Candidate filenames for a binary, accounting for Windows wrappers. */
function candidateNames(name: string): string[] {
  if (process.platform === 'win32') {
    const exts = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
      .split(';')
      .map((e) => e.toLowerCase())
    return [name, ...exts.map((ext) => `${name}${ext}`)]
  }
  return [name]
}

/**
 * Resolve a binary on PATH (plus a couple of common user-local install dirs),
 * returning its absolute path or null. Avoids depending on `which`/`where`.
 */
export async function findExecutable(name: string): Promise<string | null> {
  const pathDirs = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const extraDirs = home
    ? [
        path.join(home, '.local', 'bin'),
        path.join(home, '.npm-global', 'bin'),
        path.join(home, '.bun', 'bin'),
      ]
    : []
  const names = candidateNames(name)

  for (const dir of [...pathDirs, ...extraDirs]) {
    for (const candidate of names) {
      const full = path.join(dir, candidate)
      try {
        await fs.access(full)
        return full
      } catch {
        // keep scanning
      }
    }
  }
  return null
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

/** Run a command to completion, capturing stdout/stderr. Never rejects. */
export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.on('error', (err) =>
      resolve({ code: null, stdout, stderr: stderr + String(err) }),
    )
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    if (options.input !== undefined) {
      child.stdin.write(options.input)
      child.stdin.end()
    }
  })
}
