/**
 * Central main-process logging. Writes timestamped lines to a logfile under
 * userData (`<userData>/logs/main.log`) and mirrors to the console, so a
 * packaged build leaves a trail that makes bug reports reproducible. Also
 * installs last-resort handlers for `uncaughtException` / `unhandledRejection`
 * so a stray async error is recorded instead of vanishing.
 */

import { app } from 'electron'
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs'
import path from 'node:path'

let stream: WriteStream | null = null
let logFilePath = ''

function ensureStream(): WriteStream | null {
  if (stream) return stream
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    mkdirSync(dir, { recursive: true })
    logFilePath = path.join(dir, 'main.log')
    stream = createWriteStream(logFilePath, { flags: 'a' })
  } catch {
    stream = null // logging must never throw
  }
  return stream
}

function write(level: 'INFO' | 'WARN' | 'ERROR', message: string, extra = ''): void {
  const line = `${new Date().toISOString()} [${level}] ${message}${extra ? ` ${extra}` : ''}\n`
  ensureStream()?.write(line)
}

export function logInfo(message: string): void {
  write('INFO', message)
  console.log(message)
}

export function logError(message: string, err?: unknown): void {
  const detail =
    err instanceof Error
      ? (err.stack ?? err.message)
      : err !== undefined
        ? String(err)
        : ''
  write('ERROR', message, detail)
  console.error(message, err)
}

/** Absolute path of the active logfile (empty until the first write). */
export function getLogFilePath(): string {
  return logFilePath
}

/** Register process-level crash handlers. Call once on startup. */
export function installCrashHandlers(): void {
  process.on('uncaughtException', (err) => {
    logError('uncaughtException', err)
  })
  process.on('unhandledRejection', (reason) => {
    logError('unhandledRejection', reason)
  })
  logInfo(`Abyss main process started (v${app.getVersion()})`)
}
