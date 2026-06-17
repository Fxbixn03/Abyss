/**
 * Pure-helper tests for src/features/chats/lib/suspicion.ts (node:test).
 * Both `analyzeTranscript` and `extractReferencedPaths` are deterministic and
 * side-effect-free — no disk access, no IPC, no React — so these tests are
 * cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  analyzeTranscript,
  extractReferencedPaths,
} from '@/features/chats/lib/suspicion'
import type { ChatMessage } from '@/shared/types/chat'

// ── helpers ───────────────────────────────────────────────────────────────────

function textMessage(text: string, role: ChatMessage['role'] = 'assistant'): ChatMessage {
  return {
    id: 'msg-1',
    role,
    blocks: [{ kind: 'text', text }],
  }
}

function textMessageWithToolUse(text: string): ChatMessage {
  return {
    id: 'msg-2',
    role: 'assistant',
    blocks: [
      { kind: 'text', text },
      { kind: 'tool_use', id: 'tu-1', name: 'bash', input: { command: 'ls' } },
    ],
  }
}

function toolResultMessage(): ChatMessage {
  return {
    id: 'msg-3',
    role: 'assistant',
    blocks: [
      { kind: 'tool_result', toolUseId: 'tu-1', output: 'file.txt', isError: false },
    ],
  }
}

// ── analyzeTranscript — overconfident ─────────────────────────────────────────

test('analyzeTranscript: flags "definitely" in assistant message without tool use', () => {
  const messages: ChatMessage[] = [
    textMessage('This will definitely work for your use case.'),
  ]
  const markers = analyzeTranscript(messages)
  assert.equal(markers.length, 1)
  assert.equal(markers[0].kind, 'overconfident')
  assert.equal(markers[0].severity, 'warning')
})

test('analyzeTranscript: flags "guaranteed" in assistant message without tool use', () => {
  const messages: ChatMessage[] = [
    textMessage('The build is guaranteed to pass on the first try.'),
  ]
  const markers = analyzeTranscript(messages)
  const overconfident = markers.filter((m) => m.kind === 'overconfident')
  assert.equal(overconfident.length, 1)
})

test('analyzeTranscript: flags "100%" confidence claim without tool use', () => {
  const messages: ChatMessage[] = [
    textMessage('I am 100% certain this is the right solution.'),
  ]
  const markers = analyzeTranscript(messages)
  const overconfident = markers.filter((m) => m.kind === 'overconfident')
  assert.equal(overconfident.length, 1)
})

test('analyzeTranscript: flags "i\'m sure" without tool use', () => {
  const messages: ChatMessage[] = [
    textMessage("I'm sure it works correctly in all browsers."),
  ]
  const markers = analyzeTranscript(messages)
  const overconfident = markers.filter((m) => m.kind === 'overconfident')
  assert.equal(overconfident.length, 1)
})

test('analyzeTranscript: does NOT flag confidence phrase when message has tool_use block', () => {
  const messages: ChatMessage[] = [
    textMessageWithToolUse('This will definitely fix the issue.'),
  ]
  const markers = analyzeTranscript(messages)
  const overconfident = markers.filter((m) => m.kind === 'overconfident')
  assert.equal(overconfident.length, 0)
})

test('analyzeTranscript: does NOT flag confidence phrase when message has tool_result block', () => {
  const messages: ChatMessage[] = [
    {
      id: 'msg-x',
      role: 'assistant',
      blocks: [
        { kind: 'text', text: 'I am sure this fixes the bug.' },
        { kind: 'tool_result', toolUseId: 'tu-x', output: 'ok' },
      ],
    },
  ]
  const markers = analyzeTranscript(messages)
  const overconfident = markers.filter((m) => m.kind === 'overconfident')
  assert.equal(overconfident.length, 0)
})

test('analyzeTranscript: ignores user messages for overconfident check', () => {
  const messages: ChatMessage[] = [
    textMessage('I am 100% sure of this.', 'user'),
  ]
  const markers = analyzeTranscript(messages)
  assert.equal(markers.length, 0)
})

// ── analyzeTranscript — quantitative claims ───────────────────────────────────

test('analyzeTranscript: flags quantitative claim "3 files" when no session tool use', () => {
  const messages: ChatMessage[] = [
    textMessage('There are 3 files in the directory.'),
  ]
  const markers = analyzeTranscript(messages)
  const noVerification = markers.filter((m) => m.kind === 'no-verification')
  assert.equal(noVerification.length, 1)
  assert.equal(noVerification[0].severity, 'warning')
})

test('analyzeTranscript: flags quantitative claim "10 tables" when no session tool use', () => {
  const messages: ChatMessage[] = [
    textMessage('The database has 10 tables in total.'),
  ]
  const markers = analyzeTranscript(messages)
  const noVerification = markers.filter((m) => m.kind === 'no-verification')
  assert.equal(noVerification.length, 1)
})

test('analyzeTranscript: does NOT flag quantitative claim when session has tool use in another message', () => {
  const messages: ChatMessage[] = [
    toolResultMessage(),
    textMessage('There are 5 rows in the result set.'),
  ]
  const markers = analyzeTranscript(messages)
  const noVerification = markers.filter((m) => m.kind === 'no-verification')
  assert.equal(noVerification.length, 0)
})

test('analyzeTranscript: does NOT flag quantitative claim when same message has tool_use', () => {
  const messages: ChatMessage[] = [
    textMessageWithToolUse('I found 7 functions to refactor.'),
  ]
  const markers = analyzeTranscript(messages)
  const noVerification = markers.filter((m) => m.kind === 'no-verification')
  assert.equal(noVerification.length, 0)
})

// ── analyzeTranscript — antonym contradiction detection ───────────────────────

test('analyzeTranscript: detects offline vs online contradiction in one message', () => {
  const messages: ChatMessage[] = [
    textMessage('The service is offline but it is still running and reachable via port 8080.'),
  ]
  const markers = analyzeTranscript(messages)
  const contradictions = markers.filter((m) => m.kind === 'contradiction')
  assert.equal(contradictions.length, 1)
  assert.equal(contradictions[0].severity, 'info')
})

test('analyzeTranscript: detects exists vs not-found contradiction — "does not exist" and "exists"', () => {
  const messages: ChatMessage[] = [
    textMessage('The file does not exist, but it was found in the cache.'),
  ]
  const markers = analyzeTranscript(messages)
  const contradictions = markers.filter((m) => m.kind === 'contradiction')
  assert.equal(contradictions.length, 1)
})

test('analyzeTranscript: detects exists vs not-found contradiction — "not found" and "returned"', () => {
  const messages: ChatMessage[] = [
    textMessage('The record was not found but returned successfully from the API.'),
  ]
  const markers = analyzeTranscript(messages)
  const contradictions = markers.filter((m) => m.kind === 'contradiction')
  assert.equal(contradictions.length, 1)
})

test('analyzeTranscript: detects failed vs succeeded contradiction', () => {
  const messages: ChatMessage[] = [
    textMessage('The test failed but the overall suite succeeded and passed all checks.'),
  ]
  const markers = analyzeTranscript(messages)
  const contradictions = markers.filter((m) => m.kind === 'contradiction')
  assert.equal(contradictions.length, 1)
})

test('analyzeTranscript: does NOT flag contradiction when antonym pair is not in the same message', () => {
  const messages: ChatMessage[] = [
    textMessage('The service is offline for maintenance.'),
    textMessage('The service is now online.'),
  ]
  const markers = analyzeTranscript(messages)
  const contradictions = markers.filter((m) => m.kind === 'contradiction')
  assert.equal(contradictions.length, 0)
})

test('analyzeTranscript: contradiction marker has correct titleKey', () => {
  const messages: ChatMessage[] = [
    textMessage('It failed but everything succeeded in the end.'),
  ]
  const markers = analyzeTranscript(messages)
  const contradiction = markers.find((m) => m.kind === 'contradiction')
  assert.ok(contradiction)
  assert.equal(contradiction.titleKey, 'markers.contradiction.title')
})

// ── analyzeTranscript — tool use suppression ──────────────────────────────────

test('analyzeTranscript: tool_use block suppresses overconfident flag for that message', () => {
  const messages: ChatMessage[] = [
    {
      id: 'msg-a',
      role: 'assistant',
      blocks: [
        { kind: 'tool_use', id: 'tu-a', name: 'read_file', input: {} },
        { kind: 'text', text: 'This is definitely the correct output.' },
      ],
    },
  ]
  const markers = analyzeTranscript(messages)
  const overconfident = markers.filter((m) => m.kind === 'overconfident')
  assert.equal(overconfident.length, 0)
})

test('analyzeTranscript: session with tool_result in any message suppresses no-verification', () => {
  const messages: ChatMessage[] = [
    {
      id: 'msg-b',
      role: 'assistant',
      blocks: [
        { kind: 'tool_result', toolUseId: 'tu-b', output: '42 records' },
      ],
    },
    textMessage('We have 42 records in the database.'),
  ]
  const markers = analyzeTranscript(messages)
  const noVerification = markers.filter((m) => m.kind === 'no-verification')
  assert.equal(noVerification.length, 0)
})

// ── analyzeTranscript — empty messages edge case ──────────────────────────────

test('analyzeTranscript: empty messages array returns empty markers array', () => {
  const markers = analyzeTranscript([])
  assert.deepEqual(markers, [])
})

test('analyzeTranscript: message with empty text block produces no markers', () => {
  const messages: ChatMessage[] = [
    {
      id: 'msg-empty',
      role: 'assistant',
      blocks: [{ kind: 'text', text: '' }],
    },
  ]
  const markers = analyzeTranscript(messages)
  assert.deepEqual(markers, [])
})

test('analyzeTranscript: assistant message with no text blocks produces no markers', () => {
  const messages: ChatMessage[] = [
    {
      id: 'msg-no-text',
      role: 'assistant',
      blocks: [{ kind: 'tool_use', id: 'tu-c', name: 'bash', input: {} }],
    },
  ]
  const markers = analyzeTranscript(messages)
  assert.deepEqual(markers, [])
})

// ── extractReferencedPaths — backtick extraction ──────────────────────────────

test('extractReferencedPaths: extracts path wrapped in backticks', () => {
  const messages: ChatMessage[] = [
    textMessage('See the file `src/features/chats/lib/suspicion.ts` for details.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.ok(paths.includes('src/features/chats/lib/suspicion.ts'))
})

test('extractReferencedPaths: extracts multiple backtick-wrapped paths', () => {
  const messages: ChatMessage[] = [
    textMessage('Edit `src/index.ts` and then run `scripts/build.sh`.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.ok(paths.includes('src/index.ts'))
  assert.ok(paths.includes('scripts/build.sh'))
})

test('extractReferencedPaths: backtick path with absolute Unix path is extracted', () => {
  const messages: ChatMessage[] = [
    textMessage('The config is at `/home/user/.config/app/settings.json`.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.ok(paths.includes('/home/user/.config/app/settings.json'))
})

// ── extractReferencedPaths — bare token extraction ────────────────────────────

test('extractReferencedPaths: extracts bare path token with slash and extension', () => {
  const messages: ChatMessage[] = [
    textMessage('Please update src/app/main.ts to fix the issue.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.ok(paths.includes('src/app/main.ts'))
})

test('extractReferencedPaths: bare path token with trailing punctuation is cleaned', () => {
  const messages: ChatMessage[] = [
    textMessage('You can find it in src/shared/types/chat.ts.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.ok(paths.includes('src/shared/types/chat.ts'))
})

test('extractReferencedPaths: extracts path with @ prefix (e.g. @/shared/...)', () => {
  const messages: ChatMessage[] = [
    textMessage('Import from @/shared/lib/errors.ts in your file.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.ok(paths.includes('@/shared/lib/errors.ts'))
})

// ── extractReferencedPaths — non-pathish tokens ignored ──────────────────────

test('extractReferencedPaths: plain word without slash is not extracted', () => {
  const messages: ChatMessage[] = [
    textMessage('This is just a plain word without slashes.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.deepEqual(paths, [])
})

test('extractReferencedPaths: token with slash but no extension is not extracted', () => {
  const messages: ChatMessage[] = [
    textMessage('Look in the src/features directory for the code.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.deepEqual(paths, [])
})

test('extractReferencedPaths: URL-like token with spaces is not extracted', () => {
  const messages: ChatMessage[] = [
    textMessage('Visit https://example.com for more info (it is a great site).'),
  ]
  // "https://example.com" contains a space after it, so no valid path token
  // The pathish regex requires no spaces, so URLs with protocol colons won't match
  const paths = extractReferencedPaths(messages)
  // Should not produce paths from the normal prose words
  for (const p of paths) {
    assert.ok(p.includes('/') && /\.[a-zA-Z]{1,6}$/.test(p), `unexpected path: ${p}`)
  }
})

test('extractReferencedPaths: ignores user role messages', () => {
  const messages: ChatMessage[] = [
    textMessage('Can you look at src/index.ts for me?', 'user'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.deepEqual(paths, [])
})

// ── extractReferencedPaths — 25-item cap ─────────────────────────────────────

test('extractReferencedPaths: caps output at 25 paths', () => {
  // Create a message with 30 backtick-wrapped unique paths
  const pathList = Array.from({ length: 30 }, (_, i) => `src/module${i}/index.ts`)
  const text = pathList.map((p) => `\`${p}\``).join(' ')
  const messages: ChatMessage[] = [textMessage(text)]
  const paths = extractReferencedPaths(messages)
  assert.equal(paths.length, 25)
})

test('extractReferencedPaths: returns fewer than 25 when fewer unique paths exist', () => {
  const messages: ChatMessage[] = [
    textMessage('Edit `src/a/index.ts` and `src/b/index.ts`.'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.ok(paths.length <= 25)
  assert.equal(paths.length, 2)
})

test('extractReferencedPaths: deduplicates repeated paths across backtick and bare tokens', () => {
  const messages: ChatMessage[] = [
    textMessage('Edit `src/app/main.ts`. Also src/app/main.ts is important.'),
  ]
  const paths = extractReferencedPaths(messages)
  const count = paths.filter((p) => p === 'src/app/main.ts').length
  assert.equal(count, 1)
})

// ── extractReferencedPaths — empty messages edge case ────────────────────────

test('extractReferencedPaths: empty messages array returns empty array', () => {
  const paths = extractReferencedPaths([])
  assert.deepEqual(paths, [])
})

test('extractReferencedPaths: message with empty text returns empty array', () => {
  const messages: ChatMessage[] = [
    textMessage(''),
  ]
  const paths = extractReferencedPaths(messages)
  assert.deepEqual(paths, [])
})

test('extractReferencedPaths: non-path text produces no results', () => {
  const messages: ChatMessage[] = [
    textMessage('Hello world. How are you today?'),
  ]
  const paths = extractReferencedPaths(messages)
  assert.deepEqual(paths, [])
})
