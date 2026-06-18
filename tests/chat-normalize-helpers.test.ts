/**
 * Focused unit tests for the two helper functions in core/chat/normalize.ts
 * that are only superficially covered by core.test.ts:
 *   - firstTextSnippet
 *   - projectLabelFromCwd
 *
 * No disk IO — pure-logic tests.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  firstTextSnippet,
  projectLabelFromCwd,
} from '../core/chat/normalize'

// ── firstTextSnippet ──────────────────────────────────────────────────────────

test('firstTextSnippet: single text block shorter than max returns text verbatim', () => {
  const content = [{ type: 'text', text: 'Hello' }]
  assert.equal(firstTextSnippet(content, 80), 'Hello')
})

test('firstTextSnippet: text longer than max is truncated with a trailing ellipsis', () => {
  const longText = 'A'.repeat(85)
  const content = [{ type: 'text', text: longText }]
  const result = firstTextSnippet(content, 80)
  // slice(0, 79) + '…'
  assert.equal(result, 'A'.repeat(79) + '…')
  assert.equal(result.length, 80)
})

test('firstTextSnippet: text exactly max characters returns verbatim (no ellipsis)', () => {
  const exactText = 'B'.repeat(80)
  const content = [{ type: 'text', text: exactText }]
  const result = firstTextSnippet(content, 80)
  assert.equal(result, exactText)
  assert.equal(result.endsWith('…'), false)
})

test('firstTextSnippet: text of length max + 1 gets the ellipsis suffix', () => {
  const overText = 'C'.repeat(81)
  const content = [{ type: 'text', text: overText }]
  const result = firstTextSnippet(content, 80)
  assert.equal(result, 'C'.repeat(79) + '…')
})

test('firstTextSnippet: array where no block has kind === "text" returns empty string', () => {
  const content = [
    { type: 'thinking', thinking: 'internal thought' },
    { type: 'tool_use', id: 'tu_1', name: 'bash', input: {} },
  ]
  assert.equal(firstTextSnippet(content, 80), '')
})

test('firstTextSnippet: array where the only text block is whitespace-only returns empty string', () => {
  const content = [{ type: 'text', text: '   \n\t  ' }]
  assert.equal(firstTextSnippet(content, 80), '')
})

test('firstTextSnippet: plain string input returns the first text via blocksFromAnthropicContent', () => {
  const result = firstTextSnippet('Hello from a plain string', 80)
  assert.equal(result, 'Hello from a plain string')
})

test('firstTextSnippet: plain string input longer than max is truncated', () => {
  const longStr = 'D'.repeat(85)
  const result = firstTextSnippet(longStr, 80)
  assert.equal(result, 'D'.repeat(79) + '…')
})

test('firstTextSnippet: multi-line text is collapsed to a single line', () => {
  const content = [{ type: 'text', text: 'line one\nline two\nline three' }]
  const result = firstTextSnippet(content, 80)
  assert.equal(result, 'line one line two line three')
})

// ── projectLabelFromCwd ───────────────────────────────────────────────────────

test('projectLabelFromCwd: Unix absolute path returns the last segment', () => {
  assert.equal(projectLabelFromCwd('/home/user/my-project'), 'my-project')
})

test('projectLabelFromCwd: path with trailing slash strips it before splitting', () => {
  assert.equal(projectLabelFromCwd('/home/user/my-project/'), 'my-project')
})

test('projectLabelFromCwd: Windows-style backslash path returns the last segment', () => {
  assert.equal(projectLabelFromCwd('C:\\Users\\alice\\workspace'), 'workspace')
})

test('projectLabelFromCwd: single-segment path with no separator returns that segment', () => {
  assert.equal(projectLabelFromCwd('my-project'), 'my-project')
})

test('projectLabelFromCwd: empty string returns "unknown"', () => {
  assert.equal(projectLabelFromCwd(''), 'unknown')
})

test('projectLabelFromCwd: path with only slashes returns "unknown"', () => {
  assert.equal(projectLabelFromCwd('///'), 'unknown')
})

test('projectLabelFromCwd: deeply nested path returns only the last segment', () => {
  assert.equal(
    projectLabelFromCwd('/a/b/c/d/e/project-name'),
    'project-name',
  )
})
