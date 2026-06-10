/**
 * Validation engine tests (node:test): the pure runLint pass and the
 * instruction-conflict detector — previously untested.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { runLint, type LintInput } from '@/features/validation/lib/lint'
import { detectInstructionConflicts } from '@/features/context/lib/conflicts'

function base(over: Partial<LintInput> = {}): LintInput {
  return {
    agentId: 'claude',
    instructions: [],
    agents: [],
    skills: [],
    commands: [],
    rules: [],
    codexSubagents: [],
    mcp: [],
    hooks: [],
    permissions: { allow: [], deny: [], ask: [] },
    rawSettings: [],
    readErrors: [],
    ...over,
  }
}

const has = (fs: { id: string }[], id: string) => fs.some((f) => f.id === id)

test('runLint: empty config only flags missing instructions', () => {
  const fs = runLint(base())
  assert.deepEqual(
    fs.map((f) => f.id),
    ['instr-empty'],
  )
})

test('runLint: unrestricted powerful tools with empty deny', () => {
  const fs = runLint(
    base({ permissions: { allow: ['Bash', 'Write'], deny: [], ask: [] } }),
  )
  assert.ok(has(fs, 'perm-unrestricted-Bash'))
  assert.ok(has(fs, 'perm-unrestricted-Write'))
  assert.ok(has(fs, 'perm-no-guardrails'))
})

test('runLint: expanded risk list + mcp wildcard', () => {
  const fs = runLint(
    base({
      permissions: { allow: ['WebFetch', 'mcp__github'], deny: ['x'], ask: [] },
    }),
  )
  assert.ok(has(fs, 'perm-unrestricted-WebFetch'))
  assert.ok(fs.some((f) => f.id.startsWith('perm-mcp-wildcard')))
})

test('runLint: on-demand bodies are not counted as base context', () => {
  const huge = 'x '.repeat(250000) // ~250k tokens of body
  const onDemand = runLint(
    base({
      skills: [
        {
          kind: 'skill',
          id: 's',
          name: 'Big',
          description: 'd',
          content: huge,
        },
      ],
    }),
  )
  assert.ok(!onDemand.some((f) => f.id.startsWith('ctx')))

  const instr = runLint(
    base({
      instructions: [
        { specId: 'i', filename: 'CLAUDE.md', scope: 'global', content: huge },
      ],
    }),
  )
  assert.ok(has(instr, 'ctx-huge'))
})

test('runLint: empty description on a skill warns it never auto-loads', () => {
  const fs = runLint(
    base({
      skills: [
        {
          kind: 'skill',
          id: 'foo',
          name: 'Foo',
          description: '',
          content: 'body',
        },
      ],
    }),
  )
  assert.ok(has(fs, 'desc-empty-skill-foo'))
})

test('runLint: unknown model + unknown tools, valid ones pass', () => {
  const bad = runLint(
    base({
      agents: [
        {
          kind: 'agent',
          id: 'a',
          name: 'A',
          description: 'does a',
          model: 'fast',
          tools: 'Read, Frobnicate',
          content: 'a',
        },
      ],
    }),
  )
  assert.ok(has(bad, 'model-unknown-agent-a'))
  assert.ok(has(bad, 'tools-unknown-agent-a'))

  const good = runLint(
    base({
      agents: [
        {
          kind: 'agent',
          id: 'b',
          name: 'B',
          description: 'does b',
          model: 'claude-opus-4-1',
          tools: 'Read, Bash(git diff:*)',
          content: 'b',
        },
      ],
    }),
  )
  assert.ok(!has(good, 'model-unknown-agent-b'))
  assert.ok(!has(good, 'tools-unknown-agent-b'))
})

test('runLint: Codex TOML required fields + sandbox enum', () => {
  const fs = runLint(
    base({
      agentId: 'codex',
      codexSubagents: [
        {
          id: 'c',
          name: 'C',
          description: '',
          sandboxMode: 'bogus',
          missing: ['description'],
          parseError: null,
        },
      ],
    }),
  )
  assert.ok(has(fs, 'codex-missing-c'))
  assert.ok(has(fs, 'codex-sandbox-c'))
})

test('runLint: invalid settings.json + surfaced read errors', () => {
  const fs = runLint(
    base({
      rawSettings: [{ file: 'settings.json', content: '{ not json' }],
      readErrors: [{ label: 'Skill “x”', detail: 'EACCES' }],
    }),
  )
  assert.ok(has(fs, 'settings-json-settings.json'))
  assert.ok(has(fs, 'read-error-0'))
})

test('runLint: unused subagent by name, referenced one passes', () => {
  const unused = runLint(
    base({
      instructions: [
        {
          specId: 'i',
          filename: 'CLAUDE.md',
          scope: 'global',
          content: 'hello',
        },
      ],
      agents: [
        {
          kind: 'agent',
          id: 'r',
          name: 'reviewer',
          description: 'd',
          content: 'x',
        },
      ],
    }),
  )
  assert.ok(has(unused, 'unused-agent-r'))

  const used = runLint(
    base({
      instructions: [
        {
          specId: 'i',
          filename: 'CLAUDE.md',
          scope: 'global',
          content: 'delegate to reviewer when needed',
        },
      ],
      agents: [
        {
          kind: 'agent',
          id: 'r',
          name: 'reviewer',
          description: 'd',
          content: 'x',
        },
      ],
    }),
  )
  assert.ok(!has(used, 'unused-agent-r'))
})

test('detectInstructionConflicts: real always/never contradiction', () => {
  const fs = detectInstructionConflicts([
    { label: 'A', text: 'Always use tabs for indentation' },
    { label: 'B', text: 'Never use tabs for indentation' },
  ])
  assert.ok(fs.some((f) => f.kind === 'contradiction'))
})

test('detectInstructionConflicts: order-preserving key avoids false positive', () => {
  const fs = detectInstructionConflicts([
    { label: 'A', text: 'Always run tests before commit' },
    { label: 'B', text: 'Never commit before running tests' },
  ])
  assert.ok(!fs.some((f) => f.kind === 'contradiction'))
})

test('detectInstructionConflicts: duplicate instruction across sources', () => {
  const line = 'Prefer small pull requests with clear descriptions and tests'
  const fs = detectInstructionConflicts([
    { label: 'A', text: line },
    { label: 'B', text: line },
  ])
  assert.ok(fs.some((f) => f.kind === 'duplicate'))
})
