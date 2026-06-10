/**
 * Skill pure-logic tests (node:test): reference extraction, quality checks and
 * the skill template builder.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractReferencedPaths,
  checkSkill,
} from '@/features/collections/lib/skillChecks'
import { buildTemplate } from '@/features/collections/lib/templates'

test('extractReferencedPaths: dir-prefixed paths and markdown links', () => {
  const refs = extractReferencedPaths(
    'Run scripts/run.py and read references/guide.md. See [doc](references/api.md) and [site](https://x.com/y.md).',
  )
  assert.ok(refs.includes('scripts/run.py'))
  assert.ok(refs.includes('references/guide.md'))
  assert.ok(refs.includes('references/api.md'))
  assert.ok(!refs.some((r) => r.startsWith('http')))
})

test('checkSkill: empty description warns it never auto-loads', () => {
  const issues = checkSkill({
    name: 'x',
    description: '',
    content: '---\nname: x\n---\n\nbody',
    body: 'body',
    files: [],
  })
  assert.ok(issues.some((i) => i.message.includes('never auto-loads')))
})

test('checkSkill: missing referenced file flagged, present one passes', () => {
  const body = 'Read references/guide.md for details.'
  const missing = checkSkill({
    name: 'x',
    description: 'A clear, useful description of the skill',
    content: `---\nname: x\n---\n\n${body}`,
    body,
    files: [],
  })
  assert.ok(missing.some((i) => i.message.includes('references/guide.md')))

  const present = checkSkill({
    name: 'x',
    description: 'A clear, useful description of the skill',
    content: `---\nname: x\n---\n\n${body}`,
    body,
    files: ['references/guide.md'],
  })
  assert.ok(!present.some((i) => i.message.includes('references/guide.md')))
})

test('checkSkill: unterminated frontmatter is flagged', () => {
  const issues = checkSkill({
    name: 'x',
    description: 'A clear, useful description of the skill',
    content: '---\nname: x\ndescription: y\n\nno closing fence',
    body: 'no closing fence',
    files: [],
  })
  assert.ok(issues.some((i) => i.message.includes('Unterminated frontmatter')))
})

test('checkSkill: oversized SKILL.md suggests references/', () => {
  const big = 'word '.repeat(4000) // ~2k tokens
  const issues = checkSkill({
    name: 'x',
    description: 'A clear, useful description of the skill',
    content: `---\nname: x\n---\n\n${big}`,
    body: big,
    files: [],
  })
  assert.ok(issues.some((i) => i.message.includes('references/')))
})

test('buildTemplate: skills emit name + allowed-tools + body', () => {
  const out = buildTemplate('skills', {
    id: 'pdf',
    name: 'pdf',
    description: 'Process PDFs',
    tools: 'Read, Grep',
    body: '# PDF\n\nDoes things.',
  })
  assert.ok(out.includes('name: pdf'))
  assert.ok(out.includes('description: Process PDFs'))
  assert.ok(out.includes('allowed-tools: Read, Grep'))
  assert.ok(out.includes('Does things.'))
})
