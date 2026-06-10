/**
 * Subagent / collection pure-logic tests (node:test): frontmatter round-trip,
 * quality checks and the scaffold-aware template builder.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseFrontmatter,
  serializeFrontmatter,
} from '@/features/collections/lib/frontmatter'
import { parseToolList, joinToolList } from '@/features/collections/lib/tools'
import { checkSubagent } from '@/features/collections/lib/subagentChecks'
import { buildTemplate } from '@/features/collections/lib/templates'

test('frontmatter: parse then serialize round-trips known keys + body', () => {
  const src =
    '---\nname: rev\ndescription: Reviews code\ntools: Read, Grep\nmodel: sonnet\n---\n\nBody here\n'
  const { data, body } = parseFrontmatter(src)
  assert.equal(data.name, 'rev')
  assert.equal(body.trim(), 'Body here')

  const out = serializeFrontmatter(data, body)
  const again = parseFrontmatter(out)
  assert.deepEqual(again.data, data)
  assert.equal(again.body.trim(), 'Body here')
})

test('frontmatter: quotes values with colons, drops empty, body-only', () => {
  const out = serializeFrontmatter(
    { name: 'x', description: 'Use: when needed', tools: '' },
    'b',
  )
  const r = parseFrontmatter(out)
  assert.equal(r.data.description, 'Use: when needed')
  assert.equal(r.data.tools, undefined)

  assert.equal(serializeFrontmatter({}, 'just body'), 'just body')
})

test('tools: parse and join are inverse', () => {
  assert.deepEqual(parseToolList('Read, Grep ,Bash'), ['Read', 'Grep', 'Bash'])
  assert.equal(joinToolList(['Read', 'Grep']), 'Read, Grep')
  assert.deepEqual(parseToolList(undefined), [])
})

test('checkSubagent: warns on empty description and empty body', () => {
  const issues = checkSubagent({
    name: 'x',
    description: '',
    body: '',
    siblings: [],
  })
  assert.ok(issues.some((i) => i.message.includes('No description')))
  assert.ok(issues.some((i) => i.message.includes('Empty system prompt')))
})

test('checkSubagent: flags overlapping descriptions', () => {
  const issues = checkSubagent({
    name: 'reviewer-2',
    description: 'Reviews code changes for correctness and edge cases',
    body: 'You review code.',
    siblings: [
      {
        name: 'reviewer',
        description: 'Reviews code changes for correctness and edge cases',
      },
    ],
  })
  assert.ok(issues.some((i) => i.message.includes('overlaps')))
})

test('checkSubagent: clean, distinct subagent yields no overlap', () => {
  const issues = checkSubagent({
    name: 'tester',
    description: 'Writes deterministic unit tests for new and changed code',
    body: 'You write tests.',
    siblings: [
      { name: 'docs', description: 'Writes and updates project documentation' },
    ],
  })
  assert.equal(
    issues.some((i) => i.message.includes('overlaps')),
    false,
  )
})

test('buildTemplate: agents scaffold body is used verbatim', () => {
  const out = buildTemplate('agents', {
    id: 'r',
    name: 'r',
    description: 'd',
    model: 'sonnet',
    tools: 'Read, Grep',
    body: 'You are R.',
  })
  assert.ok(out.includes('model: sonnet'))
  assert.ok(out.includes('tools: Read, Grep'))
  assert.ok(out.includes('You are R.'))
  assert.ok(!out.includes('Describe this subagent'))
})
