/**
 * Unit tests for claudeChatRuntime.renameSession — verifies append correctness
 * and error propagation using a real temp directory (node:test + assert/strict).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { claudeChatRuntime } from '@core/chat/claude/runtime'
import { readSessionMeta } from '@core/chat/claude/parse'
import { ConfigWriteError } from '@core/config-error'
import type { OsEnv } from '@/shared/types/agent'

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

function testEnv(home: string, appData: string): OsEnv {
  return { home, appData, platform: process.platform as OsEnv['platform'] }
}

/** Write a minimal Claude JSONL session under ~/.claude/projects/<encoded>/<id>.jsonl. */
async function seedClaudeSession(
  home: string,
  cwd: string,
  sessionId: string,
  lines: unknown[],
): Promise<void> {
  const encoded = cwd.replace(/[/\\]/g, '-')
  const dir = path.join(home, '.claude', 'projects', encoded)
  await fs.mkdir(dir, { recursive: true })
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  await fs.writeFile(path.join(dir, `${sessionId}.jsonl`), body, 'utf8')
}

/** Minimal set of JSONL lines representing a Claude session with one user message. */
function minimalLines(cwd: string): unknown[] {
  return [
    {
      type: 'user',
      uuid: 'u1',
      timestamp: '2024-06-01T00:00:00.000Z',
      cwd,
      message: { role: 'user', content: 'hello world' },
    },
  ]
}

test('renameSession happy path: readSessionMeta returns the new title', async () => {
  const home = await tmp('abyss-rename-happy-')
  const env = testEnv(home, await tmp('abyss-rename-happy-app-'))
  const cwd = '/home/u/proj'
  const sessionId = 'sess-rename-1'

  await seedClaudeSession(home, cwd, sessionId, minimalLines(cwd))
  await claudeChatRuntime.renameSession(env, sessionId, 'New Title')

  const filePath = path.join(
    home,
    '.claude',
    'projects',
    '-home-u-proj',
    `${sessionId}.jsonl`,
  )
  const meta = await readSessionMeta(filePath, '')
  assert.ok(meta, 'meta must not be null after rename')
  assert.equal(meta.title, 'New Title')

  for (const d of [home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('renameSession second rename wins: only the last title is returned', async () => {
  const home = await tmp('abyss-rename-second-')
  const env = testEnv(home, await tmp('abyss-rename-second-app-'))
  const cwd = '/home/u/proj2'
  const sessionId = 'sess-rename-2'

  await seedClaudeSession(home, cwd, sessionId, minimalLines(cwd))
  await claudeChatRuntime.renameSession(env, sessionId, 'First Title')
  await claudeChatRuntime.renameSession(env, sessionId, 'Second Title')

  const filePath = path.join(
    home,
    '.claude',
    'projects',
    '-home-u-proj2',
    `${sessionId}.jsonl`,
  )
  const meta = await readSessionMeta(filePath, '')
  assert.ok(meta, 'meta must not be null after double rename')
  assert.equal(meta.title, 'Second Title')

  for (const d of [home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('renameSession missing session: throws ConfigWriteError', async () => {
  const home = await tmp('abyss-rename-missing-')
  const env = testEnv(home, await tmp('abyss-rename-missing-app-'))

  await assert.rejects(
    () => claudeChatRuntime.renameSession(env, 'nonexistent-session-id', 'Any'),
    (err: unknown) => {
      assert.ok(err instanceof ConfigWriteError, 'must be ConfigWriteError')
      assert.equal(err.code, 'WRITE_PERMISSION_DENIED')
      return true
    },
  )

  for (const d of [home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('renameSession appended line is valid JSON with type and summary fields', async () => {
  const home = await tmp('abyss-rename-json-')
  const env = testEnv(home, await tmp('abyss-rename-json-app-'))
  const cwd = '/home/u/proj3'
  const sessionId = 'sess-rename-3'
  const expectedTitle = 'Appended Title'

  await seedClaudeSession(home, cwd, sessionId, minimalLines(cwd))
  await claudeChatRuntime.renameSession(env, sessionId, expectedTitle)

  const filePath = path.join(
    home,
    '.claude',
    'projects',
    '-home-u-proj3',
    `${sessionId}.jsonl`,
  )
  const raw = await fs.readFile(filePath, 'utf8')
  const lines = raw.trim().split('\n')
  // The last line is the appended summary line.
  const lastLine = lines[lines.length - 1]
  let parsed: unknown
  assert.doesNotThrow(() => {
    parsed = JSON.parse(lastLine)
  }, 'appended line must be valid JSON')
  const obj = parsed as Record<string, unknown>
  assert.equal(obj.type, 'summary')
  assert.equal(obj.summary, expectedTitle)

  for (const d of [home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})
