/**
 * Tests for the JSON-parse layer in Roo Code and Cline chat runtimes.
 *
 * Verifies that:
 *   (a) A well-formed `api_conversation_history.json` produces correct
 *       `ChatMessage` entries via `readRooSession` / `readClineSession`.
 *   (b) A file containing invalid JSON (`{broken`) causes a `ConfigParseError`
 *       rather than leaking a raw `SyntaxError`.
 *   (c) A session whose history file has been deleted before the read produces
 *       a `ConfigNotFoundError`.
 *
 * All tests use real temp directories — no mocks.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { readRooSession } from '@core/chat/roo/parse'
import { readClineSession } from '@core/chat/cline/parse'
import { ConfigNotFoundError, ConfigParseError } from '@core/config-error'
import type { OsEnv } from '@/shared/types/agent'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal OsEnv pointing at a temp home directory. */
function makeEnv(home: string): OsEnv {
  return {
    home,
    appData: home,
    platform: process.platform as OsEnv['platform'],
  }
}

/**
 * Minimal valid Anthropic-style message array that Roo/Cline history files use.
 * The first entry is a user message with a text block so `titleFromMessages`
 * can derive a title and `messageCount` will be >= 1.
 */
const VALID_HISTORY_JSON = JSON.stringify([
  {
    role: 'user',
    content: [{ type: 'text', text: 'Hello from the test suite' }],
  },
  {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hi! This is a test response.' }],
  },
])

const BROKEN_JSON = '{broken'

// ── Roo Code ──────────────────────────────────────────────────────────────────

test('readRooSession: valid JSON history file produces correct ChatMessage entries', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-roo-json-'))
  try {
    const taskId = 'test-task-roo-valid'
    const taskDir = path.join(home, '.roo', 'tasks', taskId)
    await fs.mkdir(taskDir, { recursive: true })
    await fs.writeFile(
      path.join(taskDir, 'api_conversation_history.json'),
      VALID_HISTORY_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readRooSession(env, taskId)

    assert.equal(transcript.id, taskId)
    assert.equal(transcript.agentId, 'roo')
    // Both messages have non-empty content and should produce ChatMessage entries
    assert.ok(
      transcript.messages.length >= 2,
      `Expected at least 2 messages, got ${transcript.messages.length}`,
    )
    // First user message should have a text block with our test content
    const firstUser = transcript.messages.find((m) => m.role === 'user')
    assert.ok(firstUser !== undefined, 'Expected a user message')
    const textBlock = firstUser.blocks.find((b) => b.kind === 'text')
    assert.ok(textBlock !== undefined && textBlock.kind === 'text')
    assert.ok(
      textBlock.text.includes('Hello from the test suite'),
      `Unexpected text: ${textBlock.text}`,
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readRooSession: invalid JSON in history file throws ConfigParseError, not raw SyntaxError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-roo-json-'))
  try {
    const taskId = 'test-task-roo-broken'
    const taskDir = path.join(home, '.roo', 'tasks', taskId)
    await fs.mkdir(taskDir, { recursive: true })
    await fs.writeFile(
      path.join(taskDir, 'api_conversation_history.json'),
      BROKEN_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    await assert.rejects(
      () => readRooSession(env, taskId),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigParseError,
          `Expected ConfigParseError, got: ${String(err)}`,
        )
        assert.ok(
          !(err instanceof SyntaxError),
          'Should not leak a raw SyntaxError',
        )
        return true
      },
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readRooSession: missing session file produces ConfigNotFoundError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-roo-json-'))
  try {
    // Ensure the tasks directory exists so the listing code does not short-circuit,
    // but do NOT create the task subdirectory — simulating a deleted session.
    await fs.mkdir(path.join(home, '.roo', 'tasks'), { recursive: true })

    const env = makeEnv(home)
    await assert.rejects(
      () => readRooSession(env, 'no-such-task-roo'),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigNotFoundError,
          `Expected ConfigNotFoundError, got: ${String(err)}`,
        )
        return true
      },
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── Cline ─────────────────────────────────────────────────────────────────────

test('readClineSession: valid JSON history file produces correct ChatMessage entries', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-cline-json-'))
  try {
    const taskId = 'test-task-cline-valid'
    const taskDir = path.join(home, 'Documents', 'Cline', 'tasks', taskId)
    await fs.mkdir(taskDir, { recursive: true })
    await fs.writeFile(
      path.join(taskDir, 'api_conversation_history.json'),
      VALID_HISTORY_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readClineSession(env, taskId)

    assert.equal(transcript.id, taskId)
    assert.equal(transcript.agentId, 'cline')
    // Both messages have non-empty content and should produce ChatMessage entries
    assert.ok(
      transcript.messages.length >= 2,
      `Expected at least 2 messages, got ${transcript.messages.length}`,
    )
    // First user message should have a text block with our test content
    const firstUser = transcript.messages.find((m) => m.role === 'user')
    assert.ok(firstUser !== undefined, 'Expected a user message')
    const textBlock = firstUser.blocks.find((b) => b.kind === 'text')
    assert.ok(textBlock !== undefined && textBlock.kind === 'text')
    assert.ok(
      textBlock.text.includes('Hello from the test suite'),
      `Unexpected text: ${textBlock.text}`,
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readClineSession: invalid JSON in history file throws ConfigParseError, not raw SyntaxError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-cline-json-'))
  try {
    const taskId = 'test-task-cline-broken'
    const taskDir = path.join(home, 'Documents', 'Cline', 'tasks', taskId)
    await fs.mkdir(taskDir, { recursive: true })
    await fs.writeFile(
      path.join(taskDir, 'api_conversation_history.json'),
      BROKEN_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    await assert.rejects(
      () => readClineSession(env, taskId),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigParseError,
          `Expected ConfigParseError, got: ${String(err)}`,
        )
        assert.ok(
          !(err instanceof SyntaxError),
          'Should not leak a raw SyntaxError',
        )
        return true
      },
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readClineSession: missing session file produces ConfigNotFoundError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-cline-json-'))
  try {
    // Ensure the tasks directory exists but with no task subdirectory
    await fs.mkdir(path.join(home, 'Documents', 'Cline', 'tasks'), {
      recursive: true,
    })

    const env = makeEnv(home)
    await assert.rejects(
      () => readClineSession(env, 'no-such-task-cline'),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigNotFoundError,
          `Expected ConfigNotFoundError, got: ${String(err)}`,
        )
        return true
      },
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
