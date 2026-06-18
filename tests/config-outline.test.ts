/**
 * Edge-case tests for extractOutline from src/features/config/lib/outline.ts.
 * The two "happy path" tests already live in tests/instructions.test.ts; this
 * file fills in the remaining branches.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractOutline } from '@/features/config/lib/outline'

// ── Empty and trivial inputs ──────────────────────────────────────────────────

test('extractOutline: empty string returns empty array', () => {
  assert.deepEqual(extractOutline(''), [])
})

test('extractOutline: only whitespace/blank lines returns empty array', () => {
  assert.deepEqual(extractOutline('   \n\n   \n'), [])
})

// ── Heading-only file (no body text) ─────────────────────────────────────────

test('extractOutline: heading-only file — consecutive headings, no body', () => {
  const md = ['# Alpha', '## Beta', '### Gamma'].join('\n')
  assert.deepEqual(extractOutline(md), [
    { level: 1, text: 'Alpha', line: 1 },
    { level: 2, text: 'Beta', line: 2 },
    { level: 3, text: 'Gamma', line: 3 },
  ])
})

// ── Deep heading levels (H4 / H5 / H6) ───────────────────────────────────────

test('extractOutline: H4 heading is captured with level 4', () => {
  const result = extractOutline('#### Deep Section')
  assert.deepEqual(result, [{ level: 4, text: 'Deep Section', line: 1 }])
})

test('extractOutline: H5 heading is captured with level 5', () => {
  const result = extractOutline('##### Even Deeper')
  assert.deepEqual(result, [{ level: 5, text: 'Even Deeper', line: 1 }])
})

test('extractOutline: H6 heading is captured with level 6', () => {
  const result = extractOutline('###### Maximum Depth')
  assert.deepEqual(result, [{ level: 6, text: 'Maximum Depth', line: 1 }])
})

// ── Trailing # characters are stripped ───────────────────────────────────────

test('extractOutline: trailing # chars on the heading line are stripped from text', () => {
  // ATX "closed" heading style: "## Title ##"
  const result = extractOutline('## My Section ##')
  assert.deepEqual(result, [{ level: 2, text: 'My Section', line: 1 }])
})

test('extractOutline: multiple trailing # chars are stripped', () => {
  const result = extractOutline('# Heading ####')
  assert.deepEqual(result, [{ level: 1, text: 'Heading', line: 1 }])
})

// ── Tilde fences suppress headings just like backtick fences ─────────────────

test('extractOutline: ~~~ fenced block suppresses headings inside it', () => {
  const md = ['# Before', '~~~', '# inside tilde fence', '~~~', '# After'].join(
    '\n',
  )
  assert.deepEqual(
    extractOutline(md).map((h) => h.text),
    ['Before', 'After'],
  )
})

// ── Fence re-opening after first fence closes resumes suppression ─────────────

test('extractOutline: second fence block after first one closes also suppresses', () => {
  const md = [
    '# Real A',
    '```',
    '# not a heading 1',
    '```',
    '# Real B',
    '```',
    '# not a heading 2',
    '```',
    '# Real C',
  ].join('\n')
  assert.deepEqual(
    extractOutline(md).map((h) => h.text),
    ['Real A', 'Real B', 'Real C'],
  )
})

// ── Heading immediately after the closing fence line is captured ──────────────

test('extractOutline: heading on the line immediately after a closing fence is captured', () => {
  const md = ['```', '# inside', '```', '# immediately after'].join('\n')
  assert.deepEqual(extractOutline(md), [
    { level: 1, text: 'immediately after', line: 4 },
  ])
})

// ── File with only code blocks and no real headings ───────────────────────────

test('extractOutline: file containing only fenced code blocks returns empty array', () => {
  const md = [
    '```bash',
    '# This is a shell comment, not a heading',
    'echo hello',
    '```',
    '',
    '~~~python',
    '## another comment',
    '~~~',
  ].join('\n')
  assert.deepEqual(extractOutline(md), [])
})

// ── Headings with inline code or punctuation ──────────────────────────────────

test('extractOutline: heading text containing backtick inline code is preserved', () => {
  const result = extractOutline('## Use `npm install` first')
  assert.deepEqual(result, [
    { level: 2, text: 'Use `npm install` first', line: 1 },
  ])
})

test('extractOutline: heading text containing punctuation is preserved', () => {
  const result = extractOutline('### FAQ: What\'s new? (v2.0!)')
  assert.deepEqual(result, [
    { level: 3, text: 'FAQ: What\'s new? (v2.0!)', line: 1 },
  ])
})

// ── Mixed heading density and correct 1-based line numbers ───────────────────

test('extractOutline: mixed # and ## density preserves correct 1-based line numbers', () => {
  const md = [
    '# Top Level',  // line 1
    '',             // line 2
    'some text',    // line 3
    '',             // line 4
    '## Sub A',     // line 5
    'more text',    // line 6
    '## Sub B',     // line 7
    '',             // line 8
    '# Another Top',// line 9
  ].join('\n')
  assert.deepEqual(extractOutline(md), [
    { level: 1, text: 'Top Level', line: 1 },
    { level: 2, text: 'Sub A', line: 5 },
    { level: 2, text: 'Sub B', line: 7 },
    { level: 1, text: 'Another Top', line: 9 },
  ])
})
