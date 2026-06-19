/**
 * Tests for the JSONL/JSON-parse layer in Zed and Windsurf chat runtimes.
 *
 * Zed stores sessions as JSONL (one Anthropic-compatible JSON object per line).
 * Windsurf stores sessions as a single JSON file with a top-level `messages`
 * array of Anthropic-compatible objects.
 *
 * Verifies that:
 *   (a) A well-formed JSONL/JSON session file produces correct `ChatMessage`
 *       entries via `readZedSession` / `readWindsurfSession`.
 *   (b) A JSONL file containing one malformed line (Zed) / a `messages` array
 *       entry with unrecognised shape (Windsurf) is silently skipped, and the
 *       remaining valid messages are still returned.
 *   (c) A missing session file produces a `ConfigNotFoundError`.
 *
 * All tests use real temp directories — no mocks.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { readZedSession } from '@core/chat/zed/parse'
import { readWindsurfSession } from '@core/chat/windsurf/parse'
import { ConfigNotFoundError } from '@core/config-error'
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

/** Two valid Anthropic-style JSONL lines. */
const VALID_JSONL = [
  JSON.stringify({
    role: 'user',
    content: [{ type: 'text', text: 'Hello from the Zed test suite' }],
  }),
  JSON.stringify({
    role: 'assistant',
    content: [{ type: 'text', text: 'Hi! This is a Zed test response.' }],
  }),
].join('\n')

/** JSONL with a malformed second line that the parser must skip. */
const JSONL_WITH_BAD_LINE = [
  JSON.stringify({
    role: 'user',
    content: [{ type: 'text', text: 'Hello from the Zed test suite' }],
  }),
  '{broken json line',
  JSON.stringify({
    role: 'assistant',
    content: [{ type: 'text', text: 'Hi! This is a Zed test response.' }],
  }),
].join('\n')

/** Valid Windsurf single-JSON session file. */
const VALID_WINDSURF_JSON = JSON.stringify({
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: 'Hello from the Windsurf test suite' }],
    },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Hi! This is a Windsurf test response.' },
      ],
    },
  ],
})

/**
 * Windsurf JSON file where the second `messages` entry lacks a valid role and
 * content — the parser should skip it and return only the first message.
 */
const WINDSURF_JSON_WITH_BAD_ENTRY = JSON.stringify({
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: 'Hello from the Windsurf test suite' }],
    },
    {
      role: 'unknown-role',
      content: [{ type: 'text', text: 'This entry should be skipped.' }],
    },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Hi! This is a Windsurf test response.' },
      ],
    },
  ],
})

// ── Zed ───────────────────────────────────────────────────────────────────────

test('readZedSession: valid JSONL file produces correct ChatTranscript with right role order', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-zed-jsonl-'))
  try {
    const sessionId = 'test-session-zed-valid'
    const convDir = path.join(home, '.config', 'zed', 'conversations')
    await fs.mkdir(convDir, { recursive: true })
    await fs.writeFile(
      path.join(convDir, `${sessionId}.jsonl`),
      VALID_JSONL,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readZedSession(env, sessionId)

    assert.equal(transcript.id, sessionId)
    assert.equal(transcript.agentId, 'zed')
    assert.equal(transcript.messages.length, 2, 'Expected exactly 2 messages')

    const [first, second] = transcript.messages
    assert.equal(first.role, 'user')
    assert.equal(second.role, 'assistant')

    const userText = first.blocks.find((b) => b.kind === 'text')
    assert.ok(userText !== undefined && userText.kind === 'text')
    assert.ok(
      userText.text.includes('Hello from the Zed test suite'),
      `Unexpected user text: ${userText.text}`,
    )

    const assistantText = second.blocks.find((b) => b.kind === 'text')
    assert.ok(assistantText !== undefined && assistantText.kind === 'text')
    assert.ok(
      assistantText.text.includes('This is a Zed test response'),
      `Unexpected assistant text: ${assistantText.text}`,
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readZedSession: JSONL file with one malformed line skips it and returns valid messages', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-zed-jsonl-'))
  try {
    const sessionId = 'test-session-zed-malformed'
    const convDir = path.join(home, '.config', 'zed', 'conversations')
    await fs.mkdir(convDir, { recursive: true })
    await fs.writeFile(
      path.join(convDir, `${sessionId}.jsonl`),
      JSONL_WITH_BAD_LINE,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readZedSession(env, sessionId)

    // The bad line must be skipped; only the two valid messages remain
    assert.equal(
      transcript.messages.length,
      2,
      `Expected 2 messages (bad line skipped), got ${transcript.messages.length}`,
    )
    assert.equal(transcript.messages[0].role, 'user')
    assert.equal(transcript.messages[1].role, 'assistant')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readZedSession: missing session file produces ConfigNotFoundError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-zed-jsonl-'))
  try {
    // Ensure the conversations directory exists but contains no session file
    await fs.mkdir(path.join(home, '.config', 'zed', 'conversations'), {
      recursive: true,
    })

    const env = makeEnv(home)
    await assert.rejects(
      () => readZedSession(env, 'no-such-session-zed'),
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

// ── Windsurf ──────────────────────────────────────────────────────────────────

test('readWindsurfSession: valid JSON file produces correct ChatTranscript with right role order', async () => {
  const home = await fs.mkdtemp(
    path.join(os.tmpdir(), 'abyss-windsurf-json-'),
  )
  try {
    const sessionId = 'test-session-windsurf-valid'
    const convDir = path.join(home, '.codeium', 'windsurf', 'conversations')
    await fs.mkdir(convDir, { recursive: true })
    await fs.writeFile(
      path.join(convDir, `${sessionId}.json`),
      VALID_WINDSURF_JSON,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readWindsurfSession(env, sessionId)

    assert.equal(transcript.id, sessionId)
    assert.equal(transcript.agentId, 'windsurf')
    assert.equal(transcript.messages.length, 2, 'Expected exactly 2 messages')

    const [first, second] = transcript.messages
    assert.equal(first.role, 'user')
    assert.equal(second.role, 'assistant')

    const userText = first.blocks.find((b) => b.kind === 'text')
    assert.ok(userText !== undefined && userText.kind === 'text')
    assert.ok(
      userText.text.includes('Hello from the Windsurf test suite'),
      `Unexpected user text: ${userText.text}`,
    )

    const assistantText = second.blocks.find((b) => b.kind === 'text')
    assert.ok(assistantText !== undefined && assistantText.kind === 'text')
    assert.ok(
      assistantText.text.includes('This is a Windsurf test response'),
      `Unexpected assistant text: ${assistantText.text}`,
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readWindsurfSession: messages array entry with unknown role is skipped and valid messages are returned', async () => {
  const home = await fs.mkdtemp(
    path.join(os.tmpdir(), 'abyss-windsurf-json-'),
  )
  try {
    const sessionId = 'test-session-windsurf-badentry'
    const convDir = path.join(home, '.codeium', 'windsurf', 'conversations')
    await fs.mkdir(convDir, { recursive: true })
    await fs.writeFile(
      path.join(convDir, `${sessionId}.json`),
      WINDSURF_JSON_WITH_BAD_ENTRY,
      'utf-8',
    )

    const env = makeEnv(home)
    const transcript = await readWindsurfSession(env, sessionId)

    // The entry with unknown-role must be skipped; the two valid messages remain
    assert.equal(
      transcript.messages.length,
      2,
      `Expected 2 messages (bad entry skipped), got ${transcript.messages.length}`,
    )
    assert.equal(transcript.messages[0].role, 'user')
    assert.equal(transcript.messages[1].role, 'assistant')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test('readWindsurfSession: missing session file produces ConfigNotFoundError', async () => {
  const home = await fs.mkdtemp(
    path.join(os.tmpdir(), 'abyss-windsurf-json-'),
  )
  try {
    // Ensure the conversations directory exists but contains no session file
    await fs.mkdir(
      path.join(home, '.codeium', 'windsurf', 'conversations'),
      { recursive: true },
    )

    const env = makeEnv(home)
    await assert.rejects(
      () => readWindsurfSession(env, 'no-such-session-windsurf'),
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
