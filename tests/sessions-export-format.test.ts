/**
 * Pure-logic tests for src/features/sessions/lib/export-format.ts (node:test).
 * bulkExportContent is a deterministic serializer with no Node APIs, DOM, or
 * IPC dependencies — it runs cleanly under node:test.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { bulkExportContent } from '@/features/sessions/lib/export-format'
import type { ChatTranscript } from '@/shared/types/chat'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeTranscript = (overrides: Partial<ChatTranscript> = {}): ChatTranscript => ({
  id: 'sess-1',
  agentId: 'claude',
  title: 'First Session',
  cwd: '/home/user/project',
  projectLabel: 'project',
  messageCount: 1,
  sizeBytes: 100,
  filePath: '/home/user/.claude/sessions/sess-1.jsonl',
  messages: [
    {
      id: 'm1',
      role: 'user',
      blocks: [{ kind: 'text', text: 'Hello from first session' }],
    },
  ],
  ...overrides,
})

const transcript1 = makeTranscript({ id: 'sess-1', title: 'First Session' })
const transcript2 = makeTranscript({
  id: 'sess-2',
  title: 'Second Session',
  filePath: '/home/user/.claude/sessions/sess-2.jsonl',
  messages: [
    {
      id: 'm2',
      role: 'user',
      blocks: [{ kind: 'text', text: 'Hello from second session' }],
    },
  ],
})

// ── json format ───────────────────────────────────────────────────────────────

test('bulkExportContent json: single transcript produces valid JSON parseable to an array', () => {
  const result = bulkExportContent([transcript1], 'json')
  const parsed = JSON.parse(result) as ChatTranscript[]
  assert.ok(Array.isArray(parsed), 'json output must parse to an array')
  assert.equal(parsed.length, 1)
})

test('bulkExportContent json: single transcript round-trips with structural equality', () => {
  const result = bulkExportContent([transcript1], 'json')
  const parsed = JSON.parse(result) as ChatTranscript[]
  assert.deepEqual(parsed[0], transcript1)
})

test('bulkExportContent json: multiple transcripts produce an array with all entries', () => {
  const result = bulkExportContent([transcript1, transcript2], 'json')
  const parsed = JSON.parse(result) as ChatTranscript[]
  assert.equal(parsed.length, 2)
  assert.deepEqual(parsed[0], transcript1)
  assert.deepEqual(parsed[1], transcript2)
})

test('bulkExportContent json: empty array produces a valid empty JSON array', () => {
  const result = bulkExportContent([], 'json')
  const parsed = JSON.parse(result) as ChatTranscript[]
  assert.ok(Array.isArray(parsed), 'empty json output must parse to an array')
  assert.equal(parsed.length, 0)
})

test('bulkExportContent json: output ends with a trailing newline', () => {
  const result = bulkExportContent([transcript1], 'json')
  assert.ok(result.endsWith('\n'), 'json output must end with a trailing newline')
})

// ── markdown format — single transcript ───────────────────────────────────────

test('bulkExportContent markdown: single transcript contains H2 heading with session number', () => {
  const result = bulkExportContent([transcript1], 'markdown')
  assert.ok(
    result.includes('## Session 1:'),
    `expected "## Session 1:" heading, got: ${result}`,
  )
})

test('bulkExportContent markdown: single transcript H2 heading includes the session title', () => {
  const result = bulkExportContent([transcript1], 'markdown')
  assert.ok(
    result.includes('## Session 1: First Session'),
    `expected title in heading, got: ${result}`,
  )
})

test('bulkExportContent markdown: single transcript includes markdown body content', () => {
  const result = bulkExportContent([transcript1], 'markdown')
  assert.ok(
    result.includes('Hello from first session'),
    `expected transcript body text to appear, got: ${result}`,
  )
})

test('bulkExportContent markdown: single transcript with no title falls back to "Untitled session"', () => {
  const noTitle = makeTranscript({ title: '' })
  const result = bulkExportContent([noTitle], 'markdown')
  assert.ok(
    result.includes('## Session 1: Untitled session'),
    `expected "Untitled session" fallback, got: ${result}`,
  )
})

// ── markdown format — multiple transcripts ────────────────────────────────────

test('bulkExportContent markdown: two transcripts both get numbered H2 headings', () => {
  const result = bulkExportContent([transcript1, transcript2], 'markdown')
  assert.ok(
    result.includes('## Session 1: First Session'),
    `expected "## Session 1" heading, got: ${result}`,
  )
  assert.ok(
    result.includes('## Session 2: Second Session'),
    `expected "## Session 2" heading, got: ${result}`,
  )
})

test('bulkExportContent markdown: two transcripts are separated by an HR divider (---)', () => {
  const result = bulkExportContent([transcript1, transcript2], 'markdown')
  assert.ok(
    result.includes('\n\n---\n\n'),
    `expected "---" HR separator between sessions, got: ${result}`,
  )
})

test('bulkExportContent markdown: three transcripts have exactly two separators', () => {
  const transcript3 = makeTranscript({
    id: 'sess-3',
    title: 'Third Session',
    filePath: '/home/user/.claude/sessions/sess-3.jsonl',
  })
  const result = bulkExportContent([transcript1, transcript2, transcript3], 'markdown')
  const separators = result.split('\n\n---\n\n').length - 1
  assert.equal(separators, 2, `expected 2 separators for 3 sessions, got: ${separators}`)
})

test('bulkExportContent markdown: heading numbers are monotonically increasing', () => {
  const result = bulkExportContent([transcript1, transcript2], 'markdown')
  const heading1Pos = result.indexOf('## Session 1:')
  const heading2Pos = result.indexOf('## Session 2:')
  assert.ok(
    heading1Pos < heading2Pos,
    'Session 1 heading must appear before Session 2 heading',
  )
})

test('bulkExportContent markdown: each transcript body text appears in order', () => {
  const result = bulkExportContent([transcript1, transcript2], 'markdown')
  const pos1 = result.indexOf('Hello from first session')
  const pos2 = result.indexOf('Hello from second session')
  assert.ok(pos1 !== -1, 'first session body must appear')
  assert.ok(pos2 !== -1, 'second session body must appear')
  assert.ok(pos1 < pos2, 'first session body must appear before second session body')
})

// ── markdown format — empty array ─────────────────────────────────────────────

test('bulkExportContent markdown: empty array returns an empty string', () => {
  const result = bulkExportContent([], 'markdown')
  assert.equal(result, '', 'empty transcripts array must produce an empty string')
})
