/**
 * Streaming JSONL reader. Sessions can be multi-megabyte, so we read line by
 * line and parse lazily instead of loading + JSON.parsing the whole file. Bad
 * lines are skipped rather than aborting the whole transcript.
 */

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

export async function* readJsonlLines(
  filePath: string,
): AsyncGenerator<Record<string, unknown>> {
  const stream = createReadStream(filePath, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of rl) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      try {
        const parsed: unknown = JSON.parse(trimmed)
        if (parsed && typeof parsed === 'object') {
          yield parsed as Record<string, unknown>
        }
      } catch {
        // skip malformed lines
      }
    }
  } finally {
    rl.close()
    stream.close()
  }
}

export async function readJsonl(
  filePath: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for await (const obj of readJsonlLines(filePath)) out.push(obj)
  return out
}

/** Narrow helpers used by the per-agent parsers. */
export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
