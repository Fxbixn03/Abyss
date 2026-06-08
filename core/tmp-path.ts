/**
 * Generate a unique temp-file path for an atomic write (write-to-temp + rename).
 * Node-only.
 *
 * Keying the temp name on the pid alone collides when two writes to the *same*
 * target file run concurrently in one process — they would share the temp path
 * and race on the rename, corrupting the result. A per-process counter plus a
 * short random token makes every temp name unique without a real tmpfile syscall.
 */

import { randomBytes } from 'node:crypto'

let counter = 0

export function uniqueTempPath(target: string): string {
  counter = (counter + 1) >>> 0
  const rand = randomBytes(4).toString('hex')
  return `${target}.abyss-tmp-${process.pid}-${counter}-${rand}`
}
