/**
 * Tests for `core/chat/history.ts` — the thin facade over the runtime registry.
 *
 * Covers:
 *   1. Guard path (unknown agent id): `listChatSessions` returns the empty page,
 *      `readChatSession` throws.
 *   2. Happy-path delegation: both functions call through to the real Claude
 *      runtime when given a temp dir with a minimal valid `.jsonl` session file.
 *
 * No mocking — real temp directories and real files are used throughout.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import {
  listChatSessions,
  readChatSession,
} from '@core/chat/history'
import type { OsEnv } from '@/shared/types/agent'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal OsEnv pointing `home` at a temp directory. */
function makeEnv(home: string): OsEnv {
  return {
    home,
    appData: home,
    platform: process.platform as OsEnv['platform'],
  }
}

/**
 * Write a minimal valid Claude JSONL session file.
 *
 * Claude's parse.ts requires:
 *   - At least one message with `type: 'user' | 'assistant'`
 *   - Each message has a `message` record with a non-empty `content`
 *   - Content must contain a non-whitespace text block
 */
async function writeMinimalSession(
  sessionId: string,
  claudeProjectsDir: string,
): Promise<string> {
  // Claude stores sessions at ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl
  // We use a simple project directory name.
  const projectDir = path.join(claudeProjectsDir, '-tmp-test-project')
  await fs.mkdir(projectDir, { recursive: true })
  const filePath = path.join(projectDir, `${sessionId}.jsonl`)

  // A minimal session: one user message with a text block.
  const userMessage = {
    type: 'user',
    uuid: `${sessionId}-msg-0`,
    timestamp: '2024-01-01T00:00:00.000Z',
    cwd: '/tmp/test-project',
    message: {
      role: 'user',
      content: [{ type: 'text', text: 'Hello from test' }],
    },
  }
  await fs.writeFile(filePath, JSON.stringify(userMessage) + '\n', 'utf8')
  return filePath
}

// ── guard path: unregistered agent id ─────────────────────────────────────────

test('listChatSessions: unregistered agent id returns { sessions: [], total: 0 } without throwing', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-hist-guard-'))
  try {
    const env = makeEnv(home)
    const result = await listChatSessions(env, 'unknown-agent-xyz')
    // Assertion 1: shape
    assert.deepEqual(result, { sessions: [], total: 0 })
    // Assertion 2: sessions array is empty
    assert.equal(result.sessions.length, 0)
    // Assertion 3: total is zero
    assert.equal(result.total, 0)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readChatSession: unregistered agent id throws an error', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-hist-throw-'))
  try {
    const env = makeEnv(home)
    let caught: unknown
    // Assertion 4: the call throws (synchronously or as a rejected promise)
    try {
      await readChatSession(env, 'unknown-agent-xyz', 'some-session-id')
    } catch (err) {
      caught = err
    }
    assert.ok(caught !== undefined, 'Expected readChatSession to throw for an unregistered agent id')
    // Assertion 5: the thrown value is an Error
    assert.ok(caught instanceof Error)
    // Assertion 6: the error message names the unknown agent id
    assert.ok(
      (caught as Error).message.includes('unknown-agent-xyz'),
      `Expected error message to include 'unknown-agent-xyz', got: ${(caught as Error).message}`,
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── happy path: delegation to the Claude runtime ──────────────────────────────

test('listChatSessions: claude agent with a valid session file returns that session', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-hist-claude-'))
  const claudeProjectsDir = path.join(home, '.claude', 'projects')
  await fs.mkdir(claudeProjectsDir, { recursive: true })
  const sessionId = 'test-session-abc123'
  await writeMinimalSession(sessionId, claudeProjectsDir)
  try {
    const env = makeEnv(home)
    const page = await listChatSessions(env, 'claude')
    // Assertion 6: the session appears in the listing
    assert.equal(page.total, 1)
    // Assertion 7: the returned session carries the correct id
    assert.equal(page.sessions[0].id, sessionId)
    // Assertion 8: the agentId field is 'claude'
    assert.equal(page.sessions[0].agentId, 'claude')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readChatSession: claude agent with a valid session file returns the transcript', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-hist-read-'))
  const claudeProjectsDir = path.join(home, '.claude', 'projects')
  await fs.mkdir(claudeProjectsDir, { recursive: true })
  const sessionId = 'test-session-read456'
  await writeMinimalSession(sessionId, claudeProjectsDir)
  try {
    const env = makeEnv(home)
    const transcript = await readChatSession(env, 'claude', sessionId)
    // Assertion 9: transcript id matches
    assert.equal(transcript.id, sessionId)
    // Assertion 10: transcript agentId is 'claude'
    assert.equal(transcript.agentId, 'claude')
    // Assertion 11: transcript has at least one message
    assert.ok(
      transcript.messages.length >= 1,
      `Expected at least one message, got ${transcript.messages.length}`,
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
