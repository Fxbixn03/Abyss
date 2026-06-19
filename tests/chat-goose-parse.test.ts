/**
 * Tests for `core/chat/goose/parse.ts` — specifically the three JSON event
 * shapes that the internal `extractMessage` function must handle, plus
 * `readGooseSession` end-to-end behaviour.
 *
 * Acceptance criteria:
 *   (a) Shape 1 (top-level `role` field) produces the correct { role, blocks }.
 *   (b) Shape 2 (`type`-as-role field) produces the correct { role, blocks }.
 *   (c) Shape 3 (nested `message.role` wrapper) produces the correct { role, blocks }.
 *   (d) An unrecognised shape is skipped (returns null internally) and does not
 *       appear in the final `ChatMessage` list.
 *   (e) A line with recognised role but empty content is skipped.
 *   (f) A multi-shape JSONL file round-trips through `readGooseSession` into the
 *       correct `ChatMessage` sequence.
 *   (g) A missing session file causes `ConfigNotFoundError`.
 *
 * All tests use real temp files — no mocks.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { readGooseSession } from '@core/chat/goose/parse'
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

/**
 * Create a Goose sessions directory under `home` and write `lines` as a JSONL
 * file with the given `sessionId`. Returns the sessions directory path.
 */
async function writeGooseSession(
  home: string,
  sessionId: string,
  lines: object[],
): Promise<string> {
  const sessDir = path.join(home, '.config', 'goose', 'sessions')
  await fs.mkdir(sessDir, { recursive: true })
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  await fs.writeFile(path.join(sessDir, `${sessionId}.jsonl`), content, 'utf-8')
  return sessDir
}

// ── Shape 1: top-level `role` field ──────────────────────────────────────────

test('readGooseSession: Shape 1 (top-level role) produces correct ChatMessage entries', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-goose-shape1-'))
  try {
    const sessionId = 'test-goose-shape1'
    await writeGooseSession(home, sessionId, [
      { role: 'user', content: 'Hello from shape 1' },
      { role: 'assistant', content: 'Reply from shape 1 assistant' },
    ])

    const env = makeEnv(home)
    const transcript = await readGooseSession(env, sessionId)

    assert.equal(transcript.id, sessionId)
    assert.equal(transcript.agentId, 'goose')
    assert.equal(transcript.messages.length, 2)

    const [userMsg, assistantMsg] = transcript.messages
    assert.equal(userMsg.role, 'user')
    assert.ok(
      userMsg.blocks.some((b) => b.kind === 'text' && b.text.includes('Hello from shape 1')),
      'user message should contain "Hello from shape 1"',
    )
    assert.equal(assistantMsg.role, 'assistant')
    assert.ok(
      assistantMsg.blocks.some(
        (b) => b.kind === 'text' && b.text.includes('Reply from shape 1 assistant'),
      ),
      'assistant message should contain expected text',
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── Shape 2: top-level `type`-as-role field ───────────────────────────────────

test('readGooseSession: Shape 2 (type-as-role) produces correct ChatMessage entries', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-goose-shape2-'))
  try {
    const sessionId = 'test-goose-shape2'
    await writeGooseSession(home, sessionId, [
      { type: 'user', content: 'Hello from shape 2 user' },
      { type: 'assistant', content: 'Hello from shape 2 assistant' },
    ])

    const env = makeEnv(home)
    const transcript = await readGooseSession(env, sessionId)

    assert.equal(transcript.messages.length, 2)

    const [userMsg, assistantMsg] = transcript.messages
    assert.equal(userMsg.role, 'user')
    assert.ok(
      userMsg.blocks.some((b) => b.kind === 'text' && b.text.includes('Hello from shape 2 user')),
      'user message should contain "Hello from shape 2 user"',
    )
    assert.equal(assistantMsg.role, 'assistant')
    assert.ok(
      assistantMsg.blocks.some(
        (b) => b.kind === 'text' && b.text.includes('Hello from shape 2 assistant'),
      ),
      'assistant message should contain expected text',
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── Shape 3: nested `message.role` wrapper ────────────────────────────────────

test('readGooseSession: Shape 3 (nested message.role wrapper) produces correct ChatMessage entries', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-goose-shape3-'))
  try {
    const sessionId = 'test-goose-shape3'
    await writeGooseSession(home, sessionId, [
      { message: { role: 'user', content: 'Hello from shape 3 user' } },
      { message: { role: 'assistant', content: 'Hello from shape 3 assistant' } },
    ])

    const env = makeEnv(home)
    const transcript = await readGooseSession(env, sessionId)

    assert.equal(transcript.messages.length, 2)

    const [userMsg, assistantMsg] = transcript.messages
    assert.equal(userMsg.role, 'user')
    assert.ok(
      userMsg.blocks.some(
        (b) => b.kind === 'text' && b.text.includes('Hello from shape 3 user'),
      ),
      'user message should contain "Hello from shape 3 user"',
    )
    assert.equal(assistantMsg.role, 'assistant')
    assert.ok(
      assistantMsg.blocks.some(
        (b) => b.kind === 'text' && b.text.includes('Hello from shape 3 assistant'),
      ),
      'assistant message should contain expected text',
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── Unrecognised shape is skipped ─────────────────────────────────────────────

test('readGooseSession: unrecognised JSON shapes are skipped and produce no ChatMessages', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-goose-skip-'))
  try {
    const sessionId = 'test-goose-skip'
    await writeGooseSession(home, sessionId, [
      // These have no role/type/message field — should be skipped
      { event: 'session_start', timestamp: '2024-01-01T00:00:00Z' },
      { metadata: { model: 'gpt-4' }, tokens: 100 },
      { unknown_field: 'value' },
      // A valid message at the end to confirm the file is parseable
      { role: 'user', content: 'This one should appear' },
    ])

    const env = makeEnv(home)
    const transcript = await readGooseSession(env, sessionId)

    // Only the one valid message should produce a ChatMessage entry
    assert.equal(
      transcript.messages.length,
      1,
      `Expected 1 message (skipping unrecognised shapes), got ${transcript.messages.length}`,
    )
    assert.equal(transcript.messages[0].role, 'user')
    assert.ok(
      transcript.messages[0].blocks.some(
        (b) => b.kind === 'text' && b.text.includes('This one should appear'),
      ),
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── Empty content returns null and is skipped ─────────────────────────────────

test('readGooseSession: lines with recognised role but empty content are skipped', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-goose-empty-'))
  try {
    const sessionId = 'test-goose-empty'
    await writeGooseSession(home, sessionId, [
      // Empty string content — should be skipped
      { role: 'user', content: '' },
      // Whitespace-only — should be skipped
      { role: 'assistant', content: '   ' },
      // Valid message — should appear
      { role: 'user', content: 'Non-empty content here' },
    ])

    const env = makeEnv(home)
    const transcript = await readGooseSession(env, sessionId)

    assert.equal(
      transcript.messages.length,
      1,
      `Expected 1 message (skipping empty content), got ${transcript.messages.length}`,
    )
    assert.equal(transcript.messages[0].role, 'user')
    assert.ok(
      transcript.messages[0].blocks.some(
        (b) => b.kind === 'text' && b.text.includes('Non-empty content here'),
      ),
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── Multi-shape JSONL round-trip ──────────────────────────────────────────────

test('readGooseSession: multi-shape JSONL file round-trips into correct ChatMessage sequence', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-goose-multi-'))
  try {
    const sessionId = 'test-goose-multi'
    // Mix all three shapes in one file, interspersed with unrecognised lines
    await writeGooseSession(home, sessionId, [
      // Shape 1: top-level role
      { role: 'user', content: 'Shape1 user message' },
      // Unrecognised: skipped
      { event: 'tool_call', tool: 'bash' },
      // Shape 2: type-as-role
      { type: 'assistant', content: 'Shape2 assistant message' },
      // Unrecognised: skipped
      { metadata: { cwd: '/projects/foo' } },
      // Shape 3: nested message.role wrapper
      { message: { role: 'user', content: 'Shape3 user message' } },
    ])

    const env = makeEnv(home)
    const transcript = await readGooseSession(env, sessionId)

    assert.equal(
      transcript.messages.length,
      3,
      `Expected 3 messages (one per shape), got ${transcript.messages.length}`,
    )

    // Verify role order
    assert.equal(transcript.messages[0].role, 'user')
    assert.equal(transcript.messages[1].role, 'assistant')
    assert.equal(transcript.messages[2].role, 'user')

    // Verify content is preserved across all shapes
    const findText = (idx: number) =>
      transcript.messages[idx].blocks
        .filter((b) => b.kind === 'text')
        .map((b) => (b.kind === 'text' ? b.text : ''))
        .join(' ')

    assert.ok(findText(0).includes('Shape1 user message'), 'Shape 1 text missing')
    assert.ok(findText(1).includes('Shape2 assistant message'), 'Shape 2 text missing')
    assert.ok(findText(2).includes('Shape3 user message'), 'Shape 3 text missing')

    // agentId is always 'goose'
    assert.equal(transcript.agentId, 'goose')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

// ── Missing session file → ConfigNotFoundError ────────────────────────────────

test('readGooseSession: missing session file produces ConfigNotFoundError', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-goose-missing-'))
  try {
    // Create the sessions directory but do NOT write any session file
    await fs.mkdir(path.join(home, '.config', 'goose', 'sessions'), {
      recursive: true,
    })

    const env = makeEnv(home)
    await assert.rejects(
      () => readGooseSession(env, 'no-such-goose-session'),
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
