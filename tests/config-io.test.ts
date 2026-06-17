/**
 * Unit tests for core/config-io.ts (validateContent) and core/json-file.ts
 * (writeJsonFile schema guard). All tests use node:test + assert/strict and
 * are deterministic (no network, no process spawning).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { z } from 'zod'
import { validateContent } from '@core/config-io'
import { writeJsonFile } from '@core/json-file'
import { ConfigValidationError } from '@core/config-error'
import type { ConfigFileSpec } from '@/shared/types/agent'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(language: ConfigFileSpec['language']): ConfigFileSpec {
  return {
    id: 'test',
    filename: 'test-file',
    scope: 'global',
    description: 'test spec',
    language,
  }
}

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

const FAKE_PATH = '/tmp/fake-config-file.json'

// ---------------------------------------------------------------------------
// validateContent — JSON branch
// ---------------------------------------------------------------------------

test('validateContent: valid JSON does not throw', () => {
  assert.doesNotThrow(() =>
    validateContent(makeSpec('json'), FAKE_PATH, '{"key":"value","num":42}'),
  )
})

test('validateContent: valid JSON array does not throw', () => {
  assert.doesNotThrow(() =>
    validateContent(makeSpec('json'), FAKE_PATH, '[1, 2, 3]'),
  )
})

test('validateContent: invalid JSON throws ConfigValidationError', () => {
  assert.throws(
    () => validateContent(makeSpec('json'), FAKE_PATH, '{ bad json ]'),
    (err: unknown) => {
      assert.ok(err instanceof ConfigValidationError, 'should be ConfigValidationError')
      assert.equal((err as ConfigValidationError).filePath, FAKE_PATH)
      assert.ok(
        (err as ConfigValidationError).message.includes(FAKE_PATH),
        'message should include filePath',
      )
      return true
    },
  )
})

test('validateContent: truncated JSON throws ConfigValidationError', () => {
  assert.throws(
    () => validateContent(makeSpec('json'), FAKE_PATH, '{"key": '),
    ConfigValidationError,
  )
})

// ---------------------------------------------------------------------------
// validateContent — YAML branch
// ---------------------------------------------------------------------------

test('validateContent: valid YAML does not throw', () => {
  assert.doesNotThrow(() =>
    validateContent(
      makeSpec('yaml'),
      '/tmp/config.yaml',
      'key: value\nlist:\n  - item1\n  - item2\n',
    ),
  )
})

test('validateContent: valid YAML with block scalars does not throw', () => {
  assert.doesNotThrow(() =>
    validateContent(
      makeSpec('yaml'),
      '/tmp/config.yaml',
      'description: |\n  line one\n  line two\n',
    ),
  )
})

test('validateContent: invalid YAML throws ConfigValidationError', () => {
  // A mapping key followed by another key at the same indent with bad indentation
  const badYaml = 'key: value\n  bad_indent: oops'
  assert.throws(
    () => validateContent(makeSpec('yaml'), '/tmp/config.yaml', badYaml),
    (err: unknown) => {
      assert.ok(err instanceof ConfigValidationError, 'should be ConfigValidationError')
      assert.equal(
        (err as ConfigValidationError).filePath,
        '/tmp/config.yaml',
      )
      return true
    },
  )
})

test('validateContent: YAML with tab characters throws ConfigValidationError', () => {
  // YAML does not allow tab indentation
  const tabYaml = 'key:\n\t- value'
  assert.throws(
    () => validateContent(makeSpec('yaml'), '/tmp/config.yaml', tabYaml),
    ConfigValidationError,
  )
})

// ---------------------------------------------------------------------------
// validateContent — TOML branch
// ---------------------------------------------------------------------------

test('validateContent: valid TOML does not throw', () => {
  assert.doesNotThrow(() =>
    validateContent(
      makeSpec('toml'),
      '/tmp/config.toml',
      '[section]\nkey = "value"\nnumber = 42\n',
    ),
  )
})

test('validateContent: invalid TOML throws ConfigValidationError', () => {
  const badToml = '[section\nkey = "unclosed section header'
  assert.throws(
    () => validateContent(makeSpec('toml'), '/tmp/config.toml', badToml),
    (err: unknown) => {
      assert.ok(err instanceof ConfigValidationError, 'should be ConfigValidationError')
      assert.equal(
        (err as ConfigValidationError).filePath,
        '/tmp/config.toml',
      )
      return true
    },
  )
})

// ---------------------------------------------------------------------------
// validateContent — non-validating language branches (markdown, text)
// ---------------------------------------------------------------------------

test('validateContent: markdown language passes through without validation', () => {
  // Even intentionally broken text should not throw for markdown
  assert.doesNotThrow(() =>
    validateContent(
      makeSpec('markdown'),
      '/tmp/CLAUDE.md',
      '# Heading\n\nSome content with { bad json } and [bad yaml: nope',
    ),
  )
})

test('validateContent: text language passes through without validation', () => {
  assert.doesNotThrow(() =>
    validateContent(
      makeSpec('text'),
      '/tmp/config.toml',
      'completely invalid { } [ ] : === toml yaml json',
    ),
  )
})

// ---------------------------------------------------------------------------
// writeJsonFile — schema guard (throws before touching disk)
// ---------------------------------------------------------------------------

test('writeJsonFile: schema-violating value throws ConfigValidationError before writing', async () => {
  const dir = await tmp('abyss-wjf-schema-')
  const file = path.join(dir, 'output.json')

  const schema = z.object({ name: z.string(), count: z.number() })
  // Pass an object with count as a string instead of a number
  const badValue = { name: 'test', count: 'not-a-number' }

  await assert.rejects(
    writeJsonFile(file, badValue, schema as z.ZodType<{ name: string; count: number }>),
    (err: unknown) => {
      assert.ok(err instanceof ConfigValidationError, 'should be ConfigValidationError')
      assert.equal((err as ConfigValidationError).filePath, file)
      return true
    },
  )

  // The file must NOT have been written
  const exists = await fs
    .access(file)
    .then(() => true)
    .catch(() => false)
  assert.equal(exists, false, 'file should not exist after schema rejection')

  await fs.rm(dir, { recursive: true, force: true })
})

test('writeJsonFile: missing required field throws ConfigValidationError before writing', async () => {
  const dir = await tmp('abyss-wjf-missing-')
  const file = path.join(dir, 'output.json')

  const schema = z.object({ name: z.string(), count: z.number() })
  const partialValue = { name: 'test' } // count is missing

  await assert.rejects(
    writeJsonFile(file, partialValue, schema as z.ZodType<{ name: string; count: number }>),
    ConfigValidationError,
  )

  const exists = await fs
    .access(file)
    .then(() => true)
    .catch(() => false)
  assert.equal(exists, false, 'file should not be created on schema mismatch')

  await fs.rm(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// writeJsonFile — conforming value writes successfully
// ---------------------------------------------------------------------------

test('writeJsonFile: conforming value with schema writes the file', async () => {
  const dir = await tmp('abyss-wjf-valid-')
  const file = path.join(dir, 'output.json')

  const schema = z.object({ name: z.string(), count: z.number() })
  const goodValue = { name: 'hello', count: 7 }

  await assert.doesNotReject(writeJsonFile(file, goodValue, schema))

  const written = JSON.parse(await fs.readFile(file, 'utf8')) as unknown
  assert.deepEqual(written, goodValue)

  await fs.rm(dir, { recursive: true, force: true })
})

test('writeJsonFile: no schema writes the value without validation', async () => {
  const dir = await tmp('abyss-wjf-noschema-')
  const file = path.join(dir, 'output.json')

  const value = { anything: true, nested: { a: 1 } }

  await assert.doesNotReject(writeJsonFile(file, value))

  const written = JSON.parse(await fs.readFile(file, 'utf8')) as unknown
  assert.deepEqual(written, value)

  await fs.rm(dir, { recursive: true, force: true })
})
