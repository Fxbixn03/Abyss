/**
 * Permissions pure-logic tests (node:test): conflict detection, risk
 * assessment and the rule-set evaluator (simulator).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  assessRisk,
  buildConflictMap,
  findConflicts,
} from '@/features/permissions/lib/conflicts'
import { evaluate } from '@/features/permissions/lib/evaluate'
import { mergeEffective } from '@/features/permissions/lib/effective'
import type { PermissionRules } from '@/shared/types/config'

const rules = (over: Partial<PermissionRules> = {}): PermissionRules => ({
  allow: [],
  deny: [],
  ask: [],
  ...over,
})

// --- findConflicts -------------------------------------------------------

test('findConflicts: exact duplicate across columns, deny wins', () => {
  const c = findConflicts(
    rules({ allow: ['Bash(rm:*)'], deny: ['Bash(rm:*)'] }),
  )
  assert.equal(c.length, 1)
  assert.equal(c[0].rule, 'Bash(rm:*)')
  assert.deepEqual(c[0].columns, ['allow', 'deny'])
  assert.equal(c[0].winner, 'deny')
})

test('findConflicts: ask wins over allow', () => {
  const c = findConflicts(rules({ allow: ['Write'], ask: ['Write'] }))
  assert.equal(c[0].winner, 'ask')
})

test('findConflicts: no duplicates, no conflicts; whitespace normalised', () => {
  assert.deepEqual(findConflicts(rules({ allow: ['Read(./**)'] })), [])
  const c = findConflicts(rules({ allow: ['Write '], deny: [' Write'] }))
  assert.equal(c.length, 1)
})

test('buildConflictMap: keyed by trimmed rule', () => {
  const map = buildConflictMap(rules({ allow: ['Edit'], deny: ['Edit'] }))
  assert.equal(map.get('Edit')?.winner, 'deny')
})

// --- assessRisk ----------------------------------------------------------

test('assessRisk: bare powerful tool in allow is high risk', () => {
  assert.equal(assessRisk('Bash', 'allow').level, 'high')
  assert.equal(assessRisk('Write', 'allow').level, 'high')
})

test('assessRisk: dangerous bash prefix in allow is high risk', () => {
  assert.equal(assessRisk('Bash(rm:*)', 'allow').level, 'high')
  assert.equal(assessRisk('Bash(sudo apt install:*)', 'allow').level, 'high')
})

test('assessRisk: catch-all specifier is a warning', () => {
  assert.equal(assessRisk('Read(**)', 'allow').level, 'warn')
})

test('assessRisk: safe rule has no risk', () => {
  assert.equal(assessRisk('Bash(npm run test:*)', 'allow').level, 'none')
  assert.equal(assessRisk('Read(./src/**)', 'allow').level, 'none')
})

test('assessRisk: deny/ask never flagged (breadth is wanted there)', () => {
  assert.equal(assessRisk('Bash', 'deny').level, 'none')
  assert.equal(assessRisk('Bash(rm:*)', 'ask').level, 'none')
})

// --- evaluate ------------------------------------------------------------

test('evaluate: deny precedence beats allow', () => {
  const r = evaluate(
    rules({ allow: ['Bash(rm:*)'], deny: ['Bash(rm:*)'] }),
    'Bash(rm -rf /)',
  )
  assert.equal(r.decision, 'deny')
  assert.equal(r.column, 'deny')
})

test('evaluate: bash prefix match', () => {
  const r = evaluate(rules({ allow: ['Bash(git push:*)'] }), 'Bash(git push origin main)')
  assert.equal(r.decision, 'allow')
  assert.equal(r.matchedRule, 'Bash(git push:*)')
})

test('evaluate: glob match on path tool', () => {
  const r = evaluate(rules({ deny: ['Read(./.env)'] }), 'Read(./.env)')
  assert.equal(r.decision, 'deny')

  const wild = evaluate(rules({ allow: ['Read(./src/**)'] }), 'Read(src/app/main.tsx)')
  assert.equal(wild.decision, 'allow')
})

test('evaluate: bare tool rule matches any call of that tool', () => {
  const r = evaluate(rules({ allow: ['Read'] }), 'Read(anything.txt)')
  assert.equal(r.decision, 'allow')
})

test('evaluate: no match defaults to ask', () => {
  const r = evaluate(rules({ allow: ['Read(./src/**)'] }), 'Bash(rm -rf /)')
  assert.equal(r.decision, 'ask')
  assert.equal(r.matchedRule, null)
  assert.equal(r.defaulted, true)
})

// --- mergeEffective ------------------------------------------------------

test('mergeEffective: global deny beats project allow', () => {
  const eff = mergeEffective(
    rules({ deny: ['Bash(rm:*)'] }),
    rules({ allow: ['Bash(rm:*)'] }),
  )
  assert.deepEqual(eff.deny, ['Bash(rm:*)'])
  assert.deepEqual(eff.allow, [])
})

test('mergeEffective: project overrides global ask with allow', () => {
  const eff = mergeEffective(
    rules({ ask: ['Write'] }),
    rules({ allow: ['Write'] }),
  )
  assert.deepEqual(eff.allow, ['Write'])
  assert.deepEqual(eff.ask, [])
})

test('mergeEffective: unions distinct rules and directories', () => {
  const eff = mergeEffective(
    rules({ allow: ['Read(./**)'], additionalDirectories: ['/a'] }),
    rules({ ask: ['Bash(git push:*)'], additionalDirectories: ['/b'] }),
  )
  assert.deepEqual(eff.allow, ['Read(./**)'])
  assert.deepEqual(eff.ask, ['Bash(git push:*)'])
  assert.deepEqual(eff.additionalDirectories, ['/a', '/b'])
})

test('evaluate: mcp wildcard and server-level match', () => {
  assert.equal(
    evaluate(rules({ allow: ['mcp__github__*'] }), 'mcp__github__create_issue').decision,
    'allow',
  )
  assert.equal(
    evaluate(rules({ deny: ['mcp__github'] }), 'mcp__github__delete_repo').decision,
    'deny',
  )
})
