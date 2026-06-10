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
