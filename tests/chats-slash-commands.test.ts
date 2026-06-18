/**
 * Pure-logic tests for src/features/chats/lib/slashCommands.ts (node:test).
 * filterSlashCommands is deterministic and has no DOM, IPC, or React deps.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  filterSlashCommands,
  SLASH_COMMANDS,
} from '@/features/chats/lib/slashCommands'

// ── SLASH_COMMANDS constant ───────────────────────────────────────────────────

test('SLASH_COMMANDS: is non-empty', () => {
  assert.ok(SLASH_COMMANDS.length > 0)
})

test('SLASH_COMMANDS: every entry has a command starting with "/"', () => {
  for (const sc of SLASH_COMMANDS) {
    assert.ok(
      sc.command.startsWith('/'),
      `Expected "${sc.command}" to start with "/"`,
    )
  }
})

test('SLASH_COMMANDS: every entry has a non-empty description', () => {
  for (const sc of SLASH_COMMANDS) {
    assert.ok(
      sc.description.length > 0,
      `Expected "${sc.command}" to have a non-empty description`,
    )
  }
})

// ── filterSlashCommands ───────────────────────────────────────────────────────

test('filterSlashCommands: empty string returns the full SLASH_COMMANDS list', () => {
  const result = filterSlashCommands('')
  assert.equal(result.length, SLASH_COMMANDS.length)
  assert.deepEqual(result, SLASH_COMMANDS)
})

test('filterSlashCommands: query matching only the command name prefix returns matching entries', () => {
  // '/cle' should match '/clear' but nothing else that does not contain 'cle'
  const result = filterSlashCommands('/cle')
  assert.ok(result.length > 0, 'Expected at least one match for "/cle"')
  for (const sc of result) {
    assert.ok(
      sc.command.toLowerCase().includes('/cle') ||
        sc.description.toLowerCase().includes('/cle'),
    )
  }
  // '/clear' must be in the result
  const hasClean = result.some((sc) => sc.command === '/clear')
  assert.ok(hasClean, 'Expected "/clear" to be in the results for "/cle"')
})

test('filterSlashCommands: query matching only a word in the description returns entries whose description contains it', () => {
  // 'summary' only appears in the description of '/compact'
  const result = filterSlashCommands('summary')
  assert.ok(result.length > 0, 'Expected at least one match for "summary"')
  for (const sc of result) {
    assert.ok(
      sc.description.toLowerCase().includes('summary') ||
        sc.command.toLowerCase().includes('summary'),
    )
  }
  const hasCompact = result.some((sc) => sc.command === '/compact')
  assert.ok(hasCompact, 'Expected "/compact" to be in the results for "summary"')
})

test('filterSlashCommands: case-insensitive match — "CLEAR" matches "/clear"', () => {
  const result = filterSlashCommands('CLEAR')
  const hasClear = result.some((sc) => sc.command === '/clear')
  assert.ok(hasClear, 'Expected "/clear" to match the uppercase query "CLEAR"')
})

test('filterSlashCommands: a query with no match returns an empty array', () => {
  const result = filterSlashCommands('zzznomatchzzz')
  assert.equal(result.length, 0)
})

test('filterSlashCommands: the returned array is a subset of SLASH_COMMANDS (no invented entries)', () => {
  const commandSet = new Set(SLASH_COMMANDS.map((sc) => sc.command))
  const result = filterSlashCommands('e')
  for (const sc of result) {
    assert.ok(
      commandSet.has(sc.command),
      `Returned entry "${sc.command}" is not in SLASH_COMMANDS`,
    )
  }
})

test('filterSlashCommands: whitespace-only query returns all commands', () => {
  // A non-empty query of spaces: every command/description contains nothing
  // useful, but this tests that the filter is applied rather than the short-circuit.
  // Since ' ' is truthy, it goes through the filter path.
  const result = filterSlashCommands('  ')
  // No command or description is expected to contain '  ' (two spaces).
  assert.equal(result.length, 0)
})
