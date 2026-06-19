/**
 * Tests for the JSON-parse layer in Amp (Sourcegraph) and Kiro (AWS) chat runtimes.
 *
 * Verifies that:
 *   (a) A well-formed Anthropic-compatible JSON session file produces correct
 *       `ChatMessage` entries via `readAmpSession` / `readKiroSession`.
 *   (b) A file containing invalid JSON (`{broken`) causes a `ConfigParseError`
 *       rather than leaking a raw `SyntaxError`.
 *   (c) A session whose file has been deleted before the read produces
 *       a `ConfigNotFoundError`.
 *
 * All tests use real temp directories — no mocks.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { readAmpSession } from '@core/chat/amp/parse'
import { readKiroSession } from '@core/chat/kiro/parse'
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
 * Minimal valid Anthropic-style session object that Amp/Kiro JSON files use.
 * The `messages` array contains two entries so `messageCount` will be >= 2.
 */
const VALID_SESSION_JSON = JSON.stringify({
  title: 'Test session',
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: 'Hello from the test suite' }],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi! This is a test response.' }],
    },
  ],
})

const BROKEN_JSON = '{broken'

// ── Amp ───────────────────────────────────────────────────────────────────────

test('readAmpSession: valid JSON session file produces correct ChatMessage entries', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-amp-json-'))
  try {
    const sessionId = 'test-session-amp-valid'
    const convDir = path.join(home, '.amp', 'conversations')
    await fs.mkdir(convDir, { recursive: true })
    await fs.writeFile(
      path.join(convDir, `${sessionId}.json`),
      VALID_SESSION_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readAmpSession(env, sessionId)

    assert.equal(transcript.id, sessionId)
    assert.equal(transcript.agentId, 'amp')
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

test('readAmpSession: invalid JSON in session file throws ConfigParseError, not raw SyntaxError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-amp-json-'))
  try {
    const sessionId = 'test-session-amp-broken'
    const convDir = path.join(home, '.amp', 'conversations')
    await fs.mkdir(convDir, { recursive: true })
    await fs.writeFile(
      path.join(convDir, `${sessionId}.json`),
      BROKEN_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    await assert.rejects(
      () => readAmpSession(env, sessionId),
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

test('readAmpSession: missing session file produces ConfigNotFoundError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-amp-json-'))
  try {
    // Ensure the conversations directory exists but with no session file
    await fs.mkdir(path.join(home, '.amp', 'conversations'), {
      recursive: true,
    })

    const env = makeEnv(home)
    await assert.rejects(
      () => readAmpSession(env, 'no-such-session-amp'),
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

// ── Kiro ──────────────────────────────────────────────────────────────────────

test('readKiroSession: valid JSON session file produces correct ChatMessage entries', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-kiro-json-'))
  try {
    const sessionId = 'test-session-kiro-valid'
    const sessDir = path.join(home, '.kiro', 'sessions')
    await fs.mkdir(sessDir, { recursive: true })
    await fs.writeFile(
      path.join(sessDir, `${sessionId}.json`),
      VALID_SESSION_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readKiroSession(env, sessionId)

    assert.equal(transcript.id, sessionId)
    assert.equal(transcript.agentId, 'kiro')
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

test('readKiroSession: invalid JSON in session file throws ConfigParseError, not raw SyntaxError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-kiro-json-'))
  try {
    const sessionId = 'test-session-kiro-broken'
    const sessDir = path.join(home, '.kiro', 'sessions')
    await fs.mkdir(sessDir, { recursive: true })
    await fs.writeFile(
      path.join(sessDir, `${sessionId}.json`),
      BROKEN_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    await assert.rejects(
      () => readKiroSession(env, sessionId),
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

test('readKiroSession: missing session file produces ConfigNotFoundError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-kiro-json-'))
  try {
    // Ensure the sessions directory exists but with no session file
    await fs.mkdir(path.join(home, '.kiro', 'sessions'), {
      recursive: true,
    })

    const env = makeEnv(home)
    await assert.rejects(
      () => readKiroSession(env, 'no-such-session-kiro'),
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
