/**
 * Rule activation simulator tests (node:test): glob splitting/matching and the
 * Cursor-style activation classifier. Pure functions — deterministic, CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  simulateActivation,
  splitGlobs,
  pathMatchesGlob,
  type RuleInput,
} from '@/features/rule-activation/lib/simulate'

test('splitGlobs respects brace groups and flow lists', () => {
  assert.deepEqual(splitGlobs('**/*.{ts,tsx}, src/**'), [
    '**/*.{ts,tsx}',
    'src/**',
  ])
  assert.deepEqual(splitGlobs('[*.md, docs/**]'), ['*.md', 'docs/**'])
  assert.deepEqual(splitGlobs('"src/**/*.ts"'), ['src/**/*.ts'])
  assert.deepEqual(splitGlobs(undefined), [])
  assert.deepEqual(splitGlobs('  '), [])
})

test('pathMatchesGlob handles **, basename fallback and brace alternation', () => {
  assert.ok(pathMatchesGlob('src/app.tsx', '**/*.tsx'))
  assert.ok(pathMatchesGlob('src/app.tsx', '*.tsx')) // no slash → basename
  assert.ok(pathMatchesGlob('app.ts', '*.{ts,tsx}'))
  assert.ok(pathMatchesGlob('app.tsx', '*.{ts,tsx}'))
  assert.ok(pathMatchesGlob('src/a/b/c.ts', 'src/**'))
  assert.ok(pathMatchesGlob('src/x.ts', 'src/**/*.ts'))
  assert.ok(!pathMatchesGlob('README.md', '**/*.ts'))
  assert.ok(!pathMatchesGlob('src/app.ts', '*.py'))
})

test('simulateActivation classifies every activation kind', () => {
  const rules: RuleInput[] = [
    { id: 'always', name: 'A', alwaysApply: true, content: 'x'.repeat(40) },
    { id: 'auto', name: 'B', globs: '**/*.tsx', content: 'y'.repeat(40) },
    { id: 'agent', name: 'C', description: 'apply when styling', content: 'z' },
    { id: 'manual', name: 'D', content: 'w' },
    { id: 'inactive', name: 'E', globs: '*.py', content: 'q' },
  ]
  const res = simulateActivation(rules, 'src/Button.tsx')
  const by = Object.fromEntries(res.rules.map((r) => [r.id, r]))

  assert.equal(by.always.activation, 'always')
  assert.equal(by.auto.activation, 'auto')
  assert.deepEqual(by.auto.matchedGlobs, ['**/*.tsx'])
  assert.equal(by.agent.activation, 'agent')
  assert.equal(by.manual.activation, 'manual')
  assert.equal(by.inactive.activation, 'inactive')

  // Only always + matched-auto count as loaded for this path.
  assert.equal(res.activeCount, 2)
  assert.ok(by.always.active && by.auto.active)
  assert.ok(!by.agent.active && !by.manual.active && !by.inactive.active)
  assert.ok(res.activeTokens > 0)
})

test('globs that miss the path fall back to agent when a description exists', () => {
  const res = simulateActivation(
    [{ id: 'r', name: 'R', globs: '*.py', description: 'd', content: 'c' }],
    'a.ts',
  )
  assert.equal(res.rules[0].activation, 'agent')
})

test('empty path leaves glob rules untriggered', () => {
  const res = simulateActivation(
    [{ id: 'r', name: 'R', globs: '**/*.ts', content: 'c' }],
    '',
  )
  assert.equal(res.rules[0].activation, 'inactive')
  assert.equal(res.activeCount, 0)
})
