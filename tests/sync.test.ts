/**
 * Unit tests for the pure normalisation helpers exported from core/sync.ts:
 *   valueKey, normalizeMcp, normalizeHooks
 *
 * These helpers are @internal but exported so the test suite can exercise
 * them directly without going through the async compareSurface integration path.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { valueKey, normalizeMcp, normalizeHooks } from '@core/sync'
import type { McpServerEntry } from '@/shared/types/config'
import type { HookEntry } from '@/shared/types/hooks'
import type { SurfaceValue } from '@/shared/types/sync'

// ── valueKey ──────────────────────────────────────────────────────────────────

test('valueKey: returns empty string for null', () => {
  assert.equal(valueKey(null), '')
})

test('valueKey: returns content string for instructions surface', () => {
  const v: SurfaceValue = { kind: 'instructions', content: '# hello\n' }
  assert.equal(valueKey(v), '# hello\n')
})

test('valueKey: returns stable JSON for mcp surface regardless of id field', () => {
  const servers: McpServerEntry[] = [
    {
      id: 'volatile-id-1',
      name: 'alpha',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'pkg'],
      env: { K: 'v' },
      enabled: true,
    },
  ]
  const v: SurfaceValue = { kind: 'mcp', servers }
  const key = valueKey(v)
  // The key must not contain the volatile local id.
  assert.ok(!key.includes('volatile-id-1'))
  // It must contain the stable name.
  assert.ok(key.includes('alpha'))
})

test('valueKey: mcp surface is stable regardless of field ordering in input objects', () => {
  // Two McpServerEntry objects that are semantically identical but are
  // constructed with properties in different orders must produce the same key.
  const a: McpServerEntry = {
    id: 'id-a',
    name: 'srv',
    type: 'http',
    url: 'https://example.com',
    enabled: true,
  }
  // Deliberately create b with different property insertion order.
  const b: McpServerEntry = {
    enabled: true,
    url: 'https://example.com',
    type: 'http',
    name: 'srv',
    id: 'id-b', // different volatile id — must be ignored
  }
  const keyA = valueKey({ kind: 'mcp', servers: [a] })
  const keyB = valueKey({ kind: 'mcp', servers: [b] })
  assert.equal(keyA, keyB)
})

test('valueKey: permissions surface sorts allow/deny/ask lists', () => {
  const v1: SurfaceValue = {
    kind: 'permissions',
    rules: { allow: ['Read(*)', 'Bash'], deny: [], ask: [] },
  }
  const v2: SurfaceValue = {
    kind: 'permissions',
    rules: { allow: ['Bash', 'Read(*)'], deny: [], ask: [] },
  }
  assert.equal(valueKey(v1), valueKey(v2))
})

test('valueKey: hooks surface returns stable string ignoring local id', () => {
  const hooks: HookEntry[] = [
    {
      id: 'local-volatile-id',
      event: 'PostToolUse',
      matcher: 'Bash',
      command: 'echo done',
    },
  ]
  const key = valueKey({ kind: 'hooks', hooks })
  assert.ok(!key.includes('local-volatile-id'))
  assert.ok(key.includes('PostToolUse'))
  assert.ok(key.includes('echo done'))
})

// ── normalizeMcp ──────────────────────────────────────────────────────────────

test('normalizeMcp: sorts servers by name regardless of input order', () => {
  const servers: McpServerEntry[] = [
    {
      id: '1',
      name: 'zebra',
      type: 'stdio',
      command: 'z',
      enabled: true,
    },
    {
      id: '2',
      name: 'alpha',
      type: 'stdio',
      command: 'a',
      enabled: true,
    },
  ]
  const sorted = normalizeMcp(servers)
  const parsed = JSON.parse(sorted) as Array<{ name: string }>
  assert.equal(parsed[0].name, 'alpha')
  assert.equal(parsed[1].name, 'zebra')
})

test('normalizeMcp: produces equal output for same servers in different order', () => {
  const a: McpServerEntry = {
    id: 'id-1',
    name: 'first',
    type: 'stdio',
    command: 'cmd1',
    enabled: true,
  }
  const b: McpServerEntry = {
    id: 'id-2',
    name: 'second',
    type: 'sse',
    url: 'https://sse.example.com',
    enabled: false,
  }
  assert.equal(normalizeMcp([a, b]), normalizeMcp([b, a]))
})

test('normalizeMcp: strips volatile local id from output', () => {
  const entry: McpServerEntry = {
    id: 'some-uuid-0000',
    name: 'myserver',
    type: 'stdio',
    command: 'npx',
    enabled: true,
  }
  const out = normalizeMcp([entry])
  assert.ok(!out.includes('some-uuid-0000'))
})

// ── normalizeHooks ────────────────────────────────────────────────────────────

test('normalizeHooks: sorts hooks and ignores volatile local ids', () => {
  const hooks: HookEntry[] = [
    { id: 'id-b', event: 'Stop', matcher: '', command: 'echo stop' },
    {
      id: 'id-a',
      event: 'PostToolUse',
      matcher: 'Bash',
      command: 'echo post',
    },
  ]
  const out = normalizeHooks(hooks)
  const parsed = JSON.parse(out) as Array<{ event: string }>
  // PostToolUse < Stop lexicographically
  assert.equal(parsed[0].event, 'PostToolUse')
  assert.equal(parsed[1].event, 'Stop')
  // No volatile id in output
  assert.ok(!out.includes('id-a'))
  assert.ok(!out.includes('id-b'))
})

test('normalizeHooks: two semantically equal lists with different ids produce same key', () => {
  const hooksA: HookEntry[] = [
    {
      id: 'uuid-aaa',
      event: 'PreToolUse',
      matcher: 'Write',
      command: 'lint',
      timeout: 30,
      disabled: false,
    },
  ]
  const hooksB: HookEntry[] = [
    {
      id: 'uuid-bbb', // different volatile id
      event: 'PreToolUse',
      matcher: 'Write',
      command: 'lint',
      timeout: 30,
      disabled: false,
    },
  ]
  assert.equal(normalizeHooks(hooksA), normalizeHooks(hooksB))
})

test('normalizeHooks: empty list returns stable empty-array JSON', () => {
  assert.equal(normalizeHooks([]), '[]')
})
