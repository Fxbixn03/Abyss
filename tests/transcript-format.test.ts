/**
 * Pure-logic tests for src/shared/chat/transcript-format.ts (node:test).
 * transcriptToMarkdown and transcriptToJson are pure serializers with no
 * Node APIs, DOM, or IPC dependencies — they run cleanly under node:test.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  transcriptToMarkdown,
  transcriptToJson,
} from '@/shared/chat/transcript-format'
import type { ChatTranscript } from '@/shared/types/chat'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A minimal ChatTranscript with all optional fields omitted. */
const minimal: ChatTranscript = {
  id: 'sess-1',
  agentId: 'claude',
  title: 'Test Session',
  cwd: '/home/user/project',
  projectLabel: 'project',
  messageCount: 0,
  sizeBytes: 0,
  filePath: '/home/user/.claude/sessions/sess-1.jsonl',
  messages: [],
}

/** A full transcript with all optional header fields present. */
const withAllFields: ChatTranscript = {
  ...minimal,
  gitBranch: 'main',
  startedAt: '2026-01-01T12:00:00Z',
  messageCount: 2,
  messages: [],
}

// ── transcriptToMarkdown: header ──────────────────────────────────────────────

test('transcriptToMarkdown: output starts with H1 title line', () => {
  const md = transcriptToMarkdown(minimal)
  const firstLine = md.split('\n')[0]
  assert.equal(firstLine, `# ${minimal.title}`)
})

test('transcriptToMarkdown: missing optional fields (gitBranch, startedAt) are absent from header', () => {
  const md = transcriptToMarkdown(minimal)
  // Neither "Branch" nor "Started" should appear in the output
  assert.ok(!md.includes('Branch'), 'gitBranch line must be absent when undefined')
  assert.ok(!md.includes('Started'), 'startedAt line must be absent when undefined')
})

test('transcriptToMarkdown: no empty list items from missing optional fields', () => {
  const md = transcriptToMarkdown(minimal)
  // A line that is just "- " would indicate an empty filtered item leaked through
  const lines = md.split('\n')
  for (const line of lines) {
    assert.ok(line !== '- ', `unexpected empty list item in output: "${line}"`)
  }
})

test('transcriptToMarkdown: present optional fields (gitBranch, startedAt) appear in header', () => {
  const md = transcriptToMarkdown(withAllFields)
  assert.ok(md.includes('**Branch:** main'), 'gitBranch should appear in header')
  assert.ok(
    md.includes('**Started:** 2026-01-01T12:00:00Z'),
    'startedAt should appear in header',
  )
})

// ── transcriptToMarkdown: text block ──────────────────────────────────────────

test('transcriptToMarkdown: text block renders as plain prose', () => {
  const t: ChatTranscript = {
    ...minimal,
    messages: [
      {
        id: 'm1',
        role: 'user',
        blocks: [{ kind: 'text', text: 'Hello, world!' }],
      },
    ],
  }
  const md = transcriptToMarkdown(t)
  assert.ok(md.includes('Hello, world!'), 'text block content should appear verbatim')
})

// ── transcriptToMarkdown: thinking block ─────────────────────────────────────

test('transcriptToMarkdown: thinking block renders as blockquote with brain emoji', () => {
  const t: ChatTranscript = {
    ...minimal,
    messages: [
      {
        id: 'm1',
        role: 'assistant',
        blocks: [{ kind: 'thinking', text: 'Let me think...' }],
      },
    ],
  }
  const md = transcriptToMarkdown(t)
  // Must be a blockquote starting with > and contain the brain emoji
  assert.ok(md.includes('> 🧠'), 'thinking block must start with blockquote and brain emoji')
  assert.ok(md.includes('Let me think...'), 'thinking block text must appear')
})

// ── transcriptToMarkdown: tool_use block ─────────────────────────────────────

test('transcriptToMarkdown: tool_use block renders with wrench emoji and JSON code fence', () => {
  const t: ChatTranscript = {
    ...minimal,
    messages: [
      {
        id: 'm1',
        role: 'assistant',
        blocks: [
          {
            kind: 'tool_use',
            id: 'tu-1',
            name: 'read_file',
            input: { path: '/tmp/foo.txt' },
          },
        ],
      },
    ],
  }
  const md = transcriptToMarkdown(t)
  assert.ok(md.includes('🔧 read_file'), 'tool_use block must include wrench emoji and tool name')
  assert.ok(md.includes('```json'), 'tool_use block must open a JSON code fence')
  assert.ok(md.includes('/tmp/foo.txt'), 'tool_use block must include serialized input')
  assert.ok(md.includes('```'), 'tool_use block must close the code fence')
})

// ── transcriptToMarkdown: tool_result block ───────────────────────────────────

test('transcriptToMarkdown: tool_result block renders as a code fence', () => {
  const t: ChatTranscript = {
    ...minimal,
    messages: [
      {
        id: 'm1',
        role: 'user',
        blocks: [
          {
            kind: 'tool_result',
            toolUseId: 'tu-1',
            output: 'file contents here',
          },
        ],
      },
    ],
  }
  const md = transcriptToMarkdown(t)
  assert.ok(md.includes('↳ result'), 'tool_result must include result label')
  assert.ok(md.includes('```'), 'tool_result must use a code fence')
  assert.ok(md.includes('file contents here'), 'tool_result must include output content')
  // Must NOT include "(error)" for a non-error result
  assert.ok(!md.includes('(error)'), 'non-error tool_result must not include (error)')
})

test('transcriptToMarkdown: tool_result with isError: true appends "(error)" to label', () => {
  const t: ChatTranscript = {
    ...minimal,
    messages: [
      {
        id: 'm1',
        role: 'user',
        blocks: [
          {
            kind: 'tool_result',
            toolUseId: 'tu-1',
            output: 'command not found',
            isError: true,
          },
        ],
      },
    ],
  }
  const md = transcriptToMarkdown(t)
  assert.ok(md.includes('result (error)'), 'isError tool_result must append "(error)" to label')
})

// ── transcriptToMarkdown: image block ─────────────────────────────────────────

test('transcriptToMarkdown: image block renders as _[image]_', () => {
  const t: ChatTranscript = {
    ...minimal,
    messages: [
      {
        id: 'm1',
        role: 'user',
        blocks: [{ kind: 'image', mime: 'image/png', source: 'data:image/png;base64,abc' }],
      },
    ],
  }
  const md = transcriptToMarkdown(t)
  assert.ok(md.includes('_[image]_'), 'image block must render as _[image]_')
})

// ── transcriptToMarkdown: error block ─────────────────────────────────────────

test('transcriptToMarkdown: error block renders with warning emoji', () => {
  const t: ChatTranscript = {
    ...minimal,
    messages: [
      {
        id: 'm1',
        role: 'assistant',
        blocks: [{ kind: 'error', message: 'Something went wrong' }],
      },
    ],
  }
  const md = transcriptToMarkdown(t)
  assert.ok(md.includes('⚠️'), 'error block must include warning emoji')
  assert.ok(md.includes('Something went wrong'), 'error block must include message text')
})

// ── transcriptToJson ──────────────────────────────────────────────────────────

test('transcriptToJson: round-trips a ChatTranscript with structural equality', () => {
  const t: ChatTranscript = {
    ...withAllFields,
    messages: [
      {
        id: 'm1',
        role: 'user',
        blocks: [{ kind: 'text', text: 'ping' }],
        timestamp: '2026-01-01T12:00:00Z',
      },
      {
        id: 'm2',
        role: 'assistant',
        blocks: [
          { kind: 'thinking', text: 'pondering' },
          { kind: 'text', text: 'pong' },
        ],
      },
    ],
  }
  const json = transcriptToJson(t)
  const parsed = JSON.parse(json) as ChatTranscript
  assert.deepEqual(parsed, t)
})

test('transcriptToJson: output ends with a newline', () => {
  const json = transcriptToJson(minimal)
  assert.ok(json.endsWith('\n'), 'JSON output must end with a trailing newline')
})
