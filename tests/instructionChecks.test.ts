/**
 * Pure-helper tests for src/shared/lib/instructionChecks.ts (node:test).
 * `checkInstructions` is deterministic and side-effect-free — no disk access,
 * no IPC, no React — so these tests are cheap and CI-safe.
 *
 * Coverage targets (per F129 spec):
 *  1. Secret patterns inside a fenced code block are NOT flagged (inFence guard)
 *  2. Each of the 8 SECRET_RULES regex patterns fires on a representative value
 *  3. A heading that appears only once is not flagged
 *  4. Three or more occurrences of the same heading each produce a separate finding
 *  5. An empty string produces no findings
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { checkInstructions } from '@/shared/lib/instructionChecks'

// ── empty input ───────────────────────────────────────────────────────────────

test('checkInstructions: empty string produces no findings', () => {
  const issues = checkInstructions('')
  assert.deepEqual(issues, [])
})

// ── fenced code block guard ───────────────────────────────────────────────────

test('checkInstructions: secret pattern inside a ``` fenced block is NOT flagged', () => {
  const content = [
    'Here is an example token:',
    '```',
    'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
    '```',
    'Do not hard-code tokens like the one above.',
  ].join('\n')
  const issues = checkInstructions(content)
  assert.equal(issues.length, 0)
})

test('checkInstructions: secret pattern inside a ~~~ fenced block is NOT flagged', () => {
  const content = [
    'Example:',
    '~~~',
    'AKIAIOSFODNN7EXAMPLE',
    '~~~',
  ].join('\n')
  const issues = checkInstructions(content)
  assert.equal(issues.length, 0)
})

test('checkInstructions: secret pattern BEFORE a fenced block IS flagged', () => {
  const content = [
    'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
    '```',
    'some code',
    '```',
  ].join('\n')
  const issues = checkInstructions(content)
  assert.ok(issues.length >= 1)
  assert.equal(issues[0].line, 1)
})

test('checkInstructions: secret pattern AFTER a closed fenced block IS flagged', () => {
  const content = [
    '```',
    'some code',
    '```',
    'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
  ].join('\n')
  const issues = checkInstructions(content)
  assert.ok(issues.length >= 1)
  assert.equal(issues[issues.length - 1].line, 4)
})

// ── all 8 SECRET_RULES fire on representative values ─────────────────────────

test('checkInstructions: rule 1 — OpenAI API key (sk-…)', () => {
  // sk- followed by 20+ alphanumeric chars
  const issues = checkInstructions('My key is sk-ABCDEFGHIJKLMNOPQRSTUV here.')
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('OpenAI API key'))
})

test('checkInstructions: rule 2 — AWS access key id (AKIA…)', () => {
  // AKIA followed by exactly 16 uppercase letters/digits
  const issues = checkInstructions('aws key: AKIAIOSFODNN7EXAMPLE')
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('AWS access key id'))
})

test('checkInstructions: rule 3 — GitHub token (ghp_…)', () => {
  // ghp_ followed by 36 alphanumeric chars
  const token = 'ghp_' + 'A'.repeat(36)
  const issues = checkInstructions(`token: ${token}`)
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('GitHub token'))
})

test('checkInstructions: rule 4 — GitHub fine-grained PAT (github_pat_…)', () => {
  // github_pat_ followed by 22+ alphanumeric/underscore chars
  const pat = 'github_pat_' + 'A'.repeat(22)
  const issues = checkInstructions(`token: ${pat}`)
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('GitHub token'))
})

test('checkInstructions: rule 5 — Google API key (AIza…)', () => {
  // AIza followed by exactly 35 alphanumeric/_/- chars
  const key = 'AIza' + 'A'.repeat(35)
  const issues = checkInstructions(`google key: ${key}`)
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('Google API key'))
})

test('checkInstructions: rule 6 — Slack token (xox…)', () => {
  // xox[baprs]- followed by 10+ alphanumeric chars
  const issues = checkInstructions('slack: xoxb-1234567890ABCD')
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('Slack token'))
})

test('checkInstructions: rule 7 — PEM private key header', () => {
  const issues = checkInstructions('-----BEGIN RSA PRIVATE KEY-----')
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('private key'))
})

test('checkInstructions: rule 8 — generic possible secret (api_key = value)', () => {
  // api_key: followed by 16+ chars
  const issues = checkInstructions('api_key: ABCDEFGHIJKLMNOP')
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('possible secret'))
})

test('checkInstructions: rule 8 — generic possible secret (password = value)', () => {
  const issues = checkInstructions('password = "supersecretpassword123!"')
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('possible secret'))
})

test('checkInstructions: rule 8 — generic possible secret (access_token: value)', () => {
  const issues = checkInstructions("access_token: 'verylongsecrettoken1234'")
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('possible secret'))
})

// ── duplicate heading detection ───────────────────────────────────────────────

test('checkInstructions: a heading that appears only once is NOT flagged', () => {
  const content = [
    '# Introduction',
    '',
    'Some text here.',
    '',
    '## Details',
    '',
    'More text.',
  ].join('\n')
  const issues = checkInstructions(content)
  assert.equal(issues.length, 0)
})

test('checkInstructions: two occurrences of the same heading produce one warning', () => {
  const content = [
    '# Setup',
    'First section.',
    '# Setup',
    'Second section.',
  ].join('\n')
  const issues = checkInstructions(content)
  const duplicates = issues.filter((i) => i.message.includes('Duplicate heading'))
  assert.equal(duplicates.length, 1)
})

test('checkInstructions: three occurrences of the same heading produce two separate findings', () => {
  const content = [
    '# Rules',
    'First.',
    '# Rules',
    'Second.',
    '# Rules',
    'Third.',
  ].join('\n')
  const issues = checkInstructions(content)
  const duplicates = issues.filter((i) => i.message.includes('Duplicate heading'))
  assert.equal(duplicates.length, 2)
})

test('checkInstructions: four occurrences produce three separate findings', () => {
  const content = [
    '# Section',
    '# Section',
    '# Section',
    '# Section',
  ].join('\n')
  const issues = checkInstructions(content)
  const duplicates = issues.filter((i) => i.message.includes('Duplicate heading'))
  assert.equal(duplicates.length, 3)
})

test('checkInstructions: duplicate heading finding references line of first occurrence', () => {
  const content = [
    '# Overview',
    'Text.',
    '# Overview',
  ].join('\n')
  const issues = checkInstructions(content)
  assert.equal(issues.length, 1)
  assert.ok(issues[0].message.includes('line 1'))
  assert.equal(issues[0].line, 3)
})

test('checkInstructions: duplicate heading comparison is case-insensitive', () => {
  const content = [
    '# introduction',
    '',
    '# Introduction',
  ].join('\n')
  const issues = checkInstructions(content)
  const duplicates = issues.filter((i) => i.message.includes('Duplicate heading'))
  assert.equal(duplicates.length, 1)
})

test('checkInstructions: different headings at different levels are not confused', () => {
  const content = [
    '# Overview',
    '## Overview',
  ].join('\n')
  // The heading text is the same ("Overview") regardless of level — the check
  // compares normalised heading text, so this IS treated as a duplicate.
  const issues = checkInstructions(content)
  const duplicates = issues.filter((i) => i.message.includes('Duplicate heading'))
  assert.equal(duplicates.length, 1)
})

test('checkInstructions: unique headings across the document produce no duplicate warnings', () => {
  const content = [
    '# Alpha',
    '## Beta',
    '### Gamma',
    '#### Delta',
  ].join('\n')
  const issues = checkInstructions(content)
  assert.equal(issues.length, 0)
})

// ── duplicate headings inside fenced blocks are ignored ───────────────────────

test('checkInstructions: repeated heading inside a fenced block is NOT flagged', () => {
  const content = [
    '# Real Heading',
    '```',
    '# Real Heading',
    '```',
  ].join('\n')
  const issues = checkInstructions(content)
  const duplicates = issues.filter((i) => i.message.includes('Duplicate heading'))
  assert.equal(duplicates.length, 0)
})

// ── severity ──────────────────────────────────────────────────────────────────

test('checkInstructions: secret finding has severity "warning"', () => {
  const issues = checkInstructions('sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'warning')
})

test('checkInstructions: duplicate heading finding has severity "warning"', () => {
  const content = ['# Foo', '# Foo'].join('\n')
  const issues = checkInstructions(content)
  assert.equal(issues[0].severity, 'warning')
})

// ── only one secret finding per line (break-after-first-match) ────────────────

test('checkInstructions: only one secret warning per line even when multiple rules match', () => {
  // This line has an OpenAI key AND a generic secret — should produce exactly one finding
  const issues = checkInstructions(
    'api_key: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
  )
  assert.equal(issues.length, 1)
})
