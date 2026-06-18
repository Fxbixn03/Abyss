/**
 * Pure-logic tests for the two string helpers in `core/chat/claude/paths.ts`.
 *
 * `decodeProjectDir` converts Claude's on-disk folder names back to cwd paths:
 *   - Names that start with '-' are absolute: the leading '-' becomes '/', and
 *     the remaining dashes become '/'.
 *   - Names without a leading '-' are relative: all dashes become '/'.
 *
 * `encodeProjectDir` is the inverse: it replaces every '/' and '\' with '-'.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  decodeProjectDir,
  encodeProjectDir,
} from '@core/chat/claude/paths'

// ── decodeProjectDir ──────────────────────────────────────────────────────────

test('decodeProjectDir: absolute Unix path — leading dash becomes "/" and remaining dashes become "/"', () => {
  // '/home/user/project' is stored as '-home-user-project'
  assert.equal(decodeProjectDir('-home-user-project'), '/home/user/project')
})

test('decodeProjectDir: absolute Unix path with multiple path segments', () => {
  // '/usr/local/bin/tool' is stored as '-usr-local-bin-tool'
  assert.equal(decodeProjectDir('-usr-local-bin-tool'), '/usr/local/bin/tool')
})

test('decodeProjectDir: relative path — no leading dash, all dashes become "/"', () => {
  // 'projects/my-app' encoded without an absolute-path dash would give 'projects-my-app'
  // but that is ambiguous with a single directory named 'projects-my-app'.
  // The rule is: no leading dash → treat as relative, replace dashes with '/'.
  assert.equal(decodeProjectDir('some-relative-path'), 'some/relative/path')
})

test('decodeProjectDir: single-segment absolute path (root child)', () => {
  // '/src' is stored as '-src'
  assert.equal(decodeProjectDir('-src'), '/src')
})

test('decodeProjectDir: empty string returns empty string', () => {
  assert.equal(decodeProjectDir(''), '')
})

test('decodeProjectDir: a name with no dashes and no leading dash is returned as-is', () => {
  assert.equal(decodeProjectDir('project'), 'project')
})

test('decodeProjectDir: Windows-style path encoded as dashes (relative, no leading dash)', () => {
  // 'C:\Users\me\repo' would be encoded to 'C:-Users-me-repo' by encodeProjectDir
  // (both / and \ become -), decoded back as a relative path: 'C:/Users/me/repo'
  assert.equal(decodeProjectDir('C:-Users-me-repo'), 'C:/Users/me/repo')
})

// ── encodeProjectDir ──────────────────────────────────────────────────────────

test('encodeProjectDir: forward slashes become dashes', () => {
  assert.equal(encodeProjectDir('/home/user/project'), '-home-user-project')
})

test('encodeProjectDir: back slashes become dashes', () => {
  assert.equal(encodeProjectDir('C:\\Users\\me\\repo'), 'C:-Users-me-repo')
})

test('encodeProjectDir: mixed forward and back slashes all become dashes', () => {
  assert.equal(encodeProjectDir('/mixed\\path/here'), '-mixed-path-here')
})

test('encodeProjectDir: path with no separators is returned unchanged', () => {
  assert.equal(encodeProjectDir('nodash'), 'nodash')
})

test('encodeProjectDir: empty string returns empty string', () => {
  assert.equal(encodeProjectDir(''), '')
})

// ── round-trip ────────────────────────────────────────────────────────────────

test('round-trip: decodeProjectDir(encodeProjectDir(cwd)) === cwd for /home/user/project', () => {
  const cwd = '/home/user/project'
  assert.equal(decodeProjectDir(encodeProjectDir(cwd)), cwd)
})

test('round-trip: decodeProjectDir(encodeProjectDir(cwd)) === cwd for /usr/local/bin', () => {
  const cwd = '/usr/local/bin'
  assert.equal(decodeProjectDir(encodeProjectDir(cwd)), cwd)
})

test('round-trip: decodeProjectDir(encodeProjectDir(cwd)) === cwd for /var/www/html', () => {
  const cwd = '/var/www/html'
  assert.equal(decodeProjectDir(encodeProjectDir(cwd)), cwd)
})

test('round-trip: decodeProjectDir(encodeProjectDir(cwd)) === cwd for a single-segment root path', () => {
  const cwd = '/repo'
  assert.equal(decodeProjectDir(encodeProjectDir(cwd)), cwd)
})

test('round-trip: decodeProjectDir(encodeProjectDir(cwd)) === cwd for a deeply nested absolute Unix path', () => {
  const cwd = '/home/alice/workspaces/client/project/src'
  assert.equal(decodeProjectDir(encodeProjectDir(cwd)), cwd)
})
