/**
 * Tests for `core/global-search.ts` — cache hit/miss, invalidation, and the
 * best-effort per-agent error swallowing.
 *
 * We drive real reads against temp directories (no mocking) so the tests are
 * deterministic and exercise the actual IO paths without touching the real home
 * directory.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import {
  indexAllConfigsCached,
  invalidateSearchIndex,
} from '@core/global-search'
import type { OsEnv } from '@/shared/types/agent'

// ── helpers ───────────────────────────────────────────────────────────────────

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

/**
 * Build a minimal OsEnv that points home/appData at a temp directory so none
 * of the 19 active agents find real config files on the test machine.
 */
function makeEnv(home: string, appData: string): OsEnv {
  return { home, appData, platform: process.platform as OsEnv['platform'] }
}

// Always invalidate before each logical test group so prior test runs never
// bleed their cache into the next assertion.
function resetCache(): void {
  invalidateSearchIndex()
}

// ── cache-hit: same env + overrides → identical array reference ───────────────

test('indexAllConfigsCached: second call with identical inputs returns the exact same array reference', async () => {
  resetCache()
  const home = await tmp('abyss-sc-hit-home-')
  const appData = await tmp('abyss-sc-hit-appdata-')
  try {
    const env = makeEnv(home, appData)
    const overrides: Record<string, string> = {}

    const first = await indexAllConfigsCached(env, overrides)
    const second = await indexAllConfigsCached(env, overrides)

    // Strict reference equality — same object in memory, not just deep equal.
    assert.ok(
      first === second,
      'Expected the second call to return the cached array reference',
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
    await fs.rm(appData, { recursive: true, force: true })
  }
})

// ── cache invalidation: invalidateSearchIndex forces a fresh read ─────────────

test('invalidateSearchIndex: after invalidation the next call returns a new reference', async () => {
  resetCache()
  const home = await tmp('abyss-sc-inv-home-')
  const appData = await tmp('abyss-sc-inv-appdata-')
  try {
    const env = makeEnv(home, appData)
    const overrides: Record<string, string> = {}

    const first = await indexAllConfigsCached(env, overrides)
    invalidateSearchIndex()
    const second = await indexAllConfigsCached(env, overrides)

    assert.ok(
      first !== second,
      'Expected a fresh array reference after invalidation',
    )
  } finally {
    await fs.rm(home, { recursive: true, force: true })
    await fs.rm(appData, { recursive: true, force: true })
  }
})

// ── cache-miss: different env → re-runs indexing ─────────────────────────────

test('indexAllConfigsCached: a different env produces a different array reference', async () => {
  resetCache()
  const home1 = await tmp('abyss-sc-env1-home-')
  const appData1 = await tmp('abyss-sc-env1-appdata-')
  const home2 = await tmp('abyss-sc-env2-home-')
  const appData2 = await tmp('abyss-sc-env2-appdata-')
  try {
    const envA = makeEnv(home1, appData1)
    const envB = makeEnv(home2, appData2)
    const overrides: Record<string, string> = {}

    const resultA = await indexAllConfigsCached(envA, overrides)
    const resultB = await indexAllConfigsCached(envB, overrides)

    assert.ok(
      resultA !== resultB,
      'Expected different env to produce a different array reference (cache miss)',
    )
  } finally {
    for (const d of [home1, appData1, home2, appData2])
      await fs.rm(d, { recursive: true, force: true })
  }
})

// ── cache-miss: different overrides → re-runs indexing ───────────────────────

test('indexAllConfigsCached: different overrides produce a different array reference', async () => {
  resetCache()
  const home = await tmp('abyss-sc-ovr-home-')
  const appData = await tmp('abyss-sc-ovr-appdata-')
  const dir1 = await tmp('abyss-sc-ovr-dir1-')
  const dir2 = await tmp('abyss-sc-ovr-dir2-')
  try {
    const env = makeEnv(home, appData)

    const resultA = await indexAllConfigsCached(env, { cursor: dir1 })
    const resultB = await indexAllConfigsCached(env, { cursor: dir2 })

    assert.ok(
      resultA !== resultB,
      'Expected different overrides to produce a different array reference (cache miss)',
    )
  } finally {
    for (const d of [home, appData, dir1, dir2])
      await fs.rm(d, { recursive: true, force: true })
  }
})

// ── overrides ordering: same override map but different key ordering are equal ─

test('indexAllConfigsCached: cache key is stable regardless of override key insertion order', async () => {
  resetCache()
  const home = await tmp('abyss-sc-ord-home-')
  const appData = await tmp('abyss-sc-ord-appdata-')
  const dirA = await tmp('abyss-sc-ord-a-')
  const dirB = await tmp('abyss-sc-ord-b-')
  try {
    const env = makeEnv(home, appData)

    // Two override objects with the same key-value pairs but different insertion order.
    const overridesAlpha: Record<string, string> = {}
    overridesAlpha['cursor'] = dirA
    overridesAlpha['roo'] = dirB

    const overridesBeta: Record<string, string> = {}
    overridesBeta['roo'] = dirB
    overridesBeta['cursor'] = dirA

    const firstCall = await indexAllConfigsCached(env, overridesAlpha)
    const secondCall = await indexAllConfigsCached(env, overridesBeta)

    assert.ok(
      firstCall === secondCall,
      'Cache key must be stable regardless of override insertion order',
    )
  } finally {
    for (const d of [home, appData, dirA, dirB])
      await fs.rm(d, { recursive: true, force: true })
  }
})

// ── error swallowing: corrupt MCP file for one agent does not block others ────
//
// Cursor stores MCP servers in `<basePath>/mcp.json`. We place corrupt JSON
// there, point Cursor at that dir via overrides, and give Roo (which also uses
// `mcp.json`) a valid server file. The result must still include the Roo MCP
// entry even though Cursor's read threw.

test('indexAllConfigsCached: a corrupt MCP file for one agent does not prevent other agents from appearing in results', async () => {
  resetCache()
  const home = await tmp('abyss-sc-err-home-')
  const appData = await tmp('abyss-sc-err-appdata-')
  const corruptDir = await tmp('abyss-sc-err-corrupt-')
  const validDir = await tmp('abyss-sc-err-valid-')
  try {
    // Cursor reads `<basePath>/mcp.json`. Write corrupt JSON so the read throws.
    await fs.writeFile(
      path.join(corruptDir, 'mcp.json'),
      '{ this is not valid json!!!',
      'utf8',
    )

    // Roo also reads `<basePath>/mcp.json` (same shape as Cursor).
    // Write a valid server so we get a result from Roo.
    await fs.writeFile(
      path.join(validDir, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          'test-server': { type: 'stdio', command: 'echo', args: ['hi'] },
        },
      }),
      'utf8',
    )

    const env = makeEnv(home, appData)
    const overrides: Record<string, string> = {
      cursor: corruptDir,
      roo: validDir,
    }

    const results = await indexAllConfigsCached(env, overrides)

    // Must contain the Roo MCP entry.
    const rooResults = results.filter(
      (r) => r.agentId === 'roo' && r.kind === 'mcp',
    )
    assert.ok(
      rooResults.length >= 1,
      'Expected at least one Roo MCP result even though Cursor MCP read failed',
    )
    assert.equal(rooResults[0].label, 'test-server')

    // Cursor must not have contributed any MCP results (its read failed).
    const cursorMcpResults = results.filter(
      (r) => r.agentId === 'cursor' && r.kind === 'mcp',
    )
    assert.equal(
      cursorMcpResults.length,
      0,
      'Expected no Cursor MCP results when its file is corrupt',
    )
  } finally {
    for (const d of [home, appData, corruptDir, validDir])
      await fs.rm(d, { recursive: true, force: true })
  }
})

// ── invalidation is idempotent ────────────────────────────────────────────────

test('invalidateSearchIndex: calling it multiple times in a row does not throw', () => {
  assert.doesNotThrow(() => {
    invalidateSearchIndex()
    invalidateSearchIndex()
    invalidateSearchIndex()
  })
})

// ── empty overrides vs absent overrides produce the same cache key ────────────

test('indexAllConfigsCached: empty overrides object and absent overrides are treated as equivalent', async () => {
  resetCache()
  const home = await tmp('abyss-sc-noovr-home-')
  const appData = await tmp('abyss-sc-noovr-appdata-')
  try {
    const env = makeEnv(home, appData)

    const withEmpty = await indexAllConfigsCached(env, {})
    const withAbsent = await indexAllConfigsCached(env)

    // Both should hit the same cache slot.
    assert.ok(
      withEmpty === withAbsent,
      'Empty overrides object and absent parameter must produce the same cache entry',
    )
  } finally {
    for (const d of [home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})
