/**
 * Prompt-template pure-logic tests (node:test). Run with `pnpm test`. These
 * cover variable extraction/substitution and the apply (insert/dedup/compose)
 * helpers, which are framework-free so they stay deterministic.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractVariables,
  hasVariables,
  applyVariables,
} from '@/features/templates/lib/variables'
import {
  insertBlock,
  isBlockPresent,
  composeTemplates,
} from '@/features/templates/lib/apply'

test('extractVariables: unique, ordered, whitespace-tolerant', () => {
  assert.deepEqual(
    extractVariables('Hi {{name}}, use {{ lang }} then {{name}} again'),
    ['name', 'lang'],
  )
  assert.deepEqual(extractVariables('no placeholders here'), [])
})

test('hasVariables', () => {
  assert.equal(hasVariables('plain {{x}}'), true)
  assert.equal(hasVariables('plain text'), false)
})

test('applyVariables: substitutes, leaves unknown/empty untouched', () => {
  assert.equal(
    applyVariables('Role: {{role}} in {{lang}}', { role: 'Senior', lang: '' }),
    'Role: Senior in {{lang}}',
  )
  assert.equal(applyVariables('{{ a }}', { a: 'X' }), 'X')
  assert.equal(applyVariables('{{missing}}', {}), '{{missing}}')
})

test('insertBlock: append/prepend with normalized spacing', () => {
  assert.equal(insertBlock('existing', 'new', 'append'), 'existing\n\nnew\n')
  assert.equal(insertBlock('existing', 'new', 'prepend'), 'new\n\nexisting\n')
  assert.equal(insertBlock('', 'new', 'append'), 'new\n')
  assert.equal(
    insertBlock('existing\n\n', 'new', 'append'),
    'existing\n\nnew\n',
  )
  assert.equal(insertBlock('existing', '   ', 'append'), 'existing')
})

test('isBlockPresent: whitespace-insensitive containment', () => {
  const existing = 'intro\n\n# Role\n- a\n- b\n'
  assert.equal(isBlockPresent(existing, '# Role\n-  a\n-   b'), true)
  assert.equal(isBlockPresent(existing, '# Missing'), false)
  assert.equal(isBlockPresent(existing, '   '), false)
  // A freshly inserted block is then detected as present.
  const next = insertBlock(existing, '# New rule\n- do it', 'append')
  assert.equal(isBlockPresent(next, '# New rule\n- do it'), true)
})

test('composeTemplates: joins non-empty, trims', () => {
  assert.equal(composeTemplates(['  a  ', '', 'b']), 'a\n\nb')
  assert.equal(composeTemplates([]), '')
})

// ── apply.ts acceptance-criteria suite (F023) ────────────────────────────────

test('isBlockPresent: true with varied whitespace runs (tabs, multi-space, mixed)', () => {
  const existing = '# Section\n\t- item one\n  -  item two\n'
  // Block uses different spacing than what's on disk — should still match.
  assert.equal(isBlockPresent(existing, '# Section\n- item one\n- item two'), true)
  // Tab vs space in the needle.
  assert.equal(isBlockPresent('a\tb\tc', 'a b c'), true)
  // Multiple consecutive spaces collapse.
  assert.equal(isBlockPresent('word  word', 'word word'), true)
})

test('isBlockPresent: false for content not present', () => {
  assert.equal(isBlockPresent('hello world', 'goodbye'), false)
})

test('isBlockPresent: false for empty block regardless of existing', () => {
  assert.equal(isBlockPresent('non-empty content', ''), false)
  assert.equal(isBlockPresent('non-empty content', '   \t  '), false)
})

test('insertBlock: prepend produces block + blank line + existing + trailing newline', () => {
  const result = insertBlock('existing content', 'new block', 'prepend')
  assert.equal(result, 'new block\n\nexisting content\n')
})

test('insertBlock: append produces existing + blank line + block + trailing newline', () => {
  const result = insertBlock('existing content', 'new block', 'append')
  assert.equal(result, 'existing content\n\nnew block\n')
})

test('insertBlock: empty block is a no-op (returns existing unchanged)', () => {
  assert.equal(insertBlock('existing', '', 'append'), 'existing')
  assert.equal(insertBlock('existing', '   ', 'prepend'), 'existing')
  assert.equal(insertBlock('existing', '\n\n\n', 'append'), 'existing')
})

test('insertBlock: empty existing content yields just the block with trailing newline', () => {
  assert.equal(insertBlock('', 'block content', 'append'), 'block content\n')
  assert.equal(insertBlock('', 'block content', 'prepend'), 'block content\n')
  // Whitespace-only existing is treated as empty.
  assert.equal(insertBlock('\n\n', 'block content', 'append'), 'block content\n')
})

test('composeTemplates: drops empty and whitespace-only bodies', () => {
  assert.equal(composeTemplates(['', '  ', '\n', 'real content']), 'real content')
  assert.equal(composeTemplates(['', '', '']), '')
})

test('composeTemplates: single non-empty item has no separators', () => {
  assert.equal(composeTemplates(['only one']), 'only one')
})

test('composeTemplates: multiple non-empty items joined with blank line', () => {
  assert.equal(composeTemplates(['first', 'second', 'third']), 'first\n\nsecond\n\nthird')
  // Whitespace trimming happens before joining.
  assert.equal(composeTemplates(['  a\n', '\nb  ']), 'a\n\nb')
})
