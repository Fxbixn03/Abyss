/**
 * Instruction-editor pure-logic tests (node:test). Cover the markdown outline
 * and the content-aware checks (duplicate headings, secret detection).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractOutline } from '@/features/config/lib/outline'
import { checkInstructions } from '@/shared/lib/instructionChecks'

test('extractOutline: levels, text and 1-based lines', () => {
  const md = ['# Title', '', 'intro', '## Section A', 'text', '### Deep'].join(
    '\n',
  )
  assert.deepEqual(extractOutline(md), [
    { level: 1, text: 'Title', line: 1 },
    { level: 2, text: 'Section A', line: 4 },
    { level: 3, text: 'Deep', line: 6 },
  ])
})

test('extractOutline: ignores headings inside fenced code blocks', () => {
  const md = ['# Real', '```', '# not a heading', '```', '## Also real'].join(
    '\n',
  )
  assert.deepEqual(
    extractOutline(md).map((h) => h.text),
    ['Real', 'Also real'],
  )
})

test('checkInstructions: flags duplicate headings with the first line', () => {
  const md = ['# Setup', 'a', '## Setup', 'b'].join('\n')
  const issues = checkInstructions(md)
  const dup = issues.find((i) => i.message.includes('Duplicate heading'))
  assert.ok(dup)
  assert.equal(dup?.severity, 'warning')
  assert.equal(dup?.line, 3)
})

test('checkInstructions: detects likely secrets, ignores prose', () => {
  const withSecret = checkInstructions(
    'Use this key: sk-abcdefghijklmnopqrstuvwxyz0123',
  )
  assert.ok(withSecret.some((i) => i.message.includes('hard-coded')))

  const clean = checkInstructions('# Title\n\nJust normal instructions here.')
  assert.equal(
    clean.some((i) => i.message.includes('hard-coded')),
    false,
  )
})

test('checkInstructions: clean file yields no findings', () => {
  assert.deepEqual(checkInstructions('# A\n\ntext\n\n## B\n\nmore'), [])
})
