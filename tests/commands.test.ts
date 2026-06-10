/**
 * Slash-command pure-logic tests (node:test): argument placeholders, quality
 * checks and the command template builder.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractArgs,
  hasArgs,
  applyArgs,
} from '@/features/collections/lib/commandArgs'
import { checkCommand } from '@/features/collections/lib/commandChecks'
import { buildTemplate } from '@/features/collections/lib/templates'

test('extractArgs: $ARGUMENTS first, then positional, unique', () => {
  assert.deepEqual(extractArgs('Run $1 then $ARGUMENTS and $2 again'), [
    '$ARGUMENTS',
    '$1',
    '$2',
  ])
  assert.deepEqual(extractArgs('no placeholders'), [])
})

test('hasArgs / applyArgs: positional, ignores $100', () => {
  assert.equal(hasArgs('use $1'), true)
  assert.equal(hasArgs('price $100'), false)
  assert.equal(
    applyArgs('Hi $1 and $ARGUMENTS', { $1: 'A', $ARGUMENTS: 'X Y' }),
    'Hi A and X Y',
  )
  assert.equal(applyArgs('$1 $2', { $1: 'a' }), 'a $2')
  assert.equal(applyArgs('cost $100', { $1: 'X' }), 'cost $100')
})

test('checkCommand: warns on empty description and missing Bash', () => {
  const issues = checkCommand({
    description: '',
    argumentHint: '',
    allowedTools: '',
    body: 'Diff:\n\n!`git diff`',
  })
  assert.ok(issues.some((i) => i.message.includes('No description')))
  assert.ok(issues.some((i) => i.message.includes('Bash')))
})

test('checkCommand: argument-hint / $ARGUMENTS consistency', () => {
  const hintNoArgs = checkCommand({
    description: 'x',
    argumentHint: '[file]',
    allowedTools: '',
    body: 'Do something fixed.',
  })
  assert.ok(hintNoArgs.some((i) => i.message.includes('never uses')))

  const argsNoHint = checkCommand({
    description: 'x',
    argumentHint: '',
    allowedTools: '',
    body: 'Work on $1 please.',
  })
  assert.ok(argsNoHint.some((i) => i.message.includes('argument-hint')))
})

test('checkCommand: Bash allowed clears the warning', () => {
  const issues = checkCommand({
    description: 'Commit',
    argumentHint: '',
    allowedTools: 'Bash',
    body: '!`git diff --staged`\n\nWrite a message.',
  })
  assert.equal(
    issues.some((i) => i.message.includes('Bash')),
    false,
  )
})

test('buildTemplate: commands emit command frontmatter + scaffold body', () => {
  const out = buildTemplate('commands', {
    id: 'review',
    name: 'review',
    description: 'Review changes',
    argumentHint: '[path]',
    tools: 'Read, Bash',
    model: '',
    body: 'Review $ARGUMENTS',
  })
  assert.ok(out.includes('description: Review changes'))
  assert.ok(out.includes('argument-hint: "[path]"')) // quoted: starts with [
  assert.ok(out.includes('allowed-tools: Read, Bash'))
  assert.ok(out.includes('Review $ARGUMENTS'))
  assert.ok(!out.includes('name:')) // commands have no name frontmatter
  assert.ok(!out.includes('model:')) // empty model dropped
})

test('buildTemplate: commands fall back to a $ARGUMENTS stub', () => {
  const out = buildTemplate('commands', {
    id: 'x',
    name: 'x',
    description: 'd',
  })
  assert.ok(out.includes('$ARGUMENTS'))
})
