/**
 * Tests for the unknown-agent-id ConfigValidationError guard in applyBundle
 * (core/bundle.ts). Added as part of F281.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { applyBundle } from '@core/bundle'
import { ConfigValidationError } from '@core/config-error'
import { IpcErrorCode } from '@/shared/ipc/ipc-error'
import type { ExportBundle } from '@/shared/types/bundle'

function tempDir(): string {
  return path.join(os.tmpdir(), `abyss-bv-${randomUUID()}`)
}

function makeBundle(agentIds: string[]): ExportBundle {
  return {
    $schema: 'abyss-bundle/v1',
    version: 1,
    exportedAt: new Date().toISOString(),
    agents: agentIds.map((id) => ({
      agentId: id,
      basePath: tempDir(),
      files: {},
    })),
  }
}

// Scenario 1: a bundle with a single unknown agent id rejects with
// ConfigValidationError whose code is IpcErrorCode.ConfigInvalid.
test('applyBundle rejects a bundle containing a single unknown agent id', async () => {
  const bundle = makeBundle(['not-a-real-agent'])

  await assert.rejects(applyBundle(bundle), (err: unknown) => {
    assert.ok(
      err instanceof ConfigValidationError,
      'expected ConfigValidationError',
    )
    assert.equal(
      (err as ConfigValidationError).code,
      IpcErrorCode.ConfigInvalid,
    )
    return true
  })
})

// Scenario 2: a bundle where all agent ids are valid succeeds (guard does not
// incorrectly reject known agents).
test('applyBundle accepts a bundle where all agent ids are valid', async () => {
  const dest = tempDir()
  await fs.mkdir(dest, { recursive: true })

  // cline has only an instructions file surface — simplest valid agent to use
  // in a dry-run (no real files needed for dryRun: true).
  const bundle = makeBundle(['cline'])

  // dryRun: true so no disk writes are attempted; basePaths redirects to the
  // temp directory so the read of the (missing) file gets the empty-file default.
  const changes = await applyBundle(bundle, {
    dryRun: true,
    basePaths: { cline: dest },
  })

  // The function returned without throwing — the guard did not fire.
  assert.ok(Array.isArray(changes), 'expected an array of changes')

  await fs.rm(dest, { recursive: true, force: true })
})

// Scenario 3: a bundle that mixes one valid and one unknown agent id also
// rejects — the guard iterates ALL agents before attempting any writes.
test('applyBundle rejects a bundle with a mix of valid and unknown agent ids', async () => {
  const bundle = makeBundle(['cline', 'not-a-real-agent'])

  await assert.rejects(applyBundle(bundle), (err: unknown) => {
    assert.ok(
      err instanceof ConfigValidationError,
      'expected ConfigValidationError',
    )
    assert.equal(
      (err as ConfigValidationError).code,
      IpcErrorCode.ConfigInvalid,
    )
    // The error message must identify the offending agent id.
    assert.ok(
      (err as ConfigValidationError).message.includes('not-a-real-agent'),
      'error message should name the bad agent id',
    )
    return true
  })
})
