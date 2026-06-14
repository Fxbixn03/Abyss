/**
 * Pure-helper tests for core/doctor.ts (node:test). These functions are
 * deterministic, side-effect-free classifiers — no disk access, no process
 * spawning, so they're cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isRiskyAllow, isPlaceholderEnvValue } from '@core/doctor'

// ── isRiskyAllow ──────────────────────────────────────────────────────────────

test('isRiskyAllow: bare wildcard "*" is risky', () => {
  assert.equal(isRiskyAllow('*'), true)
})

test('isRiskyAllow: bare "Bash" with no specifier is risky', () => {
  assert.equal(isRiskyAllow('Bash'), true)
})

test('isRiskyAllow: canonical "Bash(*)" is risky', () => {
  assert.equal(isRiskyAllow('Bash(*)'), true)
})

test('isRiskyAllow: "Shell" is risky', () => {
  assert.equal(isRiskyAllow('Shell'), true)
})

test('isRiskyAllow: "Shell(*)" is risky', () => {
  assert.equal(isRiskyAllow('Shell(*)'), true)
})

test('isRiskyAllow: whitespace variants of Bash(*) are risky', () => {
  // Spaces around the * inside the parens must still match.
  assert.equal(isRiskyAllow('Bash( *)'), true)
  assert.equal(isRiskyAllow('Bash(* )'), true)
  assert.equal(isRiskyAllow('Bash( * )'), true)
  assert.equal(isRiskyAllow('Bash(  *  )'), true)
})

test('isRiskyAllow: leading/trailing whitespace on the rule is trimmed', () => {
  // trim() removes outer whitespace before lookup — all these are risky.
  assert.equal(isRiskyAllow('  Bash  '), true)
  assert.equal(isRiskyAllow('  Bash'), true)
  assert.equal(isRiskyAllow('Bash  '), true)
  assert.equal(isRiskyAllow('  *  '), true)
  assert.equal(isRiskyAllow('  Bash(*)  '), true)
  assert.equal(isRiskyAllow('  Bash( * )  '), true)
})

test('isRiskyAllow: scoped Bash rules are not risky', () => {
  assert.equal(isRiskyAllow('Bash(git:*)'), false)
  assert.equal(isRiskyAllow('Bash(git status:*)'), false)
  assert.equal(isRiskyAllow('Bash(rm -rf:*)'), false)
  assert.equal(isRiskyAllow('Bash(echo hello)'), false)
})

test('isRiskyAllow: Read and Write tool rules are not risky', () => {
  assert.equal(isRiskyAllow('Read(*)'), false)
  assert.equal(isRiskyAllow('Write(*)'), false)
  assert.equal(isRiskyAllow('Edit(*)'), false)
})

test('isRiskyAllow: empty string is not risky', () => {
  assert.equal(isRiskyAllow(''), false)
})

test('isRiskyAllow: mcp wildcard patterns are not risky (different classifier)', () => {
  assert.equal(isRiskyAllow('mcp__github__*'), false)
  assert.equal(isRiskyAllow('mcp__*'), false)
})

// ── isPlaceholderEnvValue ─────────────────────────────────────────────────────

test('isPlaceholderEnvValue: values ending in _HERE are placeholders', () => {
  assert.equal(isPlaceholderEnvValue('YOUR_KEY_HERE'), true)
  assert.equal(isPlaceholderEnvValue('CHANGE_ME_HERE'), true)
  assert.equal(isPlaceholderEnvValue('TOKEN_HERE'), true)
  assert.equal(isPlaceholderEnvValue('your_key_here'), true) // case-insensitive
  assert.equal(isPlaceholderEnvValue('PUT_SECRET_HERE'), true)
})

test('isPlaceholderEnvValue: values starting with "<" are placeholders', () => {
  assert.equal(isPlaceholderEnvValue('<token>'), true)
  assert.equal(isPlaceholderEnvValue('<your-api-key>'), true)
  assert.equal(isPlaceholderEnvValue('<SECRET_VALUE>'), true)
  assert.equal(isPlaceholderEnvValue('<>'), true)
  assert.equal(isPlaceholderEnvValue('<'), true)
})

test('isPlaceholderEnvValue: CHANGE_ME (exact, case-insensitive) is a placeholder', () => {
  assert.equal(isPlaceholderEnvValue('CHANGE_ME'), true)
  assert.equal(isPlaceholderEnvValue('change_me'), true)
  assert.equal(isPlaceholderEnvValue('Change_Me'), true)
})

test('isPlaceholderEnvValue: TODO (exact, case-insensitive) is a placeholder', () => {
  assert.equal(isPlaceholderEnvValue('TODO'), true)
  assert.equal(isPlaceholderEnvValue('todo'), true)
  assert.equal(isPlaceholderEnvValue('Todo'), true)
})

test('isPlaceholderEnvValue: real-looking values are not placeholders', () => {
  assert.equal(isPlaceholderEnvValue('ghp_abc123realtoken'), false)
  assert.equal(isPlaceholderEnvValue('sk-ant-api03-realkey'), false)
  assert.equal(isPlaceholderEnvValue('production'), false)
  assert.equal(isPlaceholderEnvValue('https://api.example.com'), false)
  assert.equal(isPlaceholderEnvValue('true'), false)
  assert.equal(isPlaceholderEnvValue('1'), false)
})

test('isPlaceholderEnvValue: empty string is not a placeholder', () => {
  assert.equal(isPlaceholderEnvValue(''), false)
})

test('isPlaceholderEnvValue: partial matches do not trigger false positives', () => {
  // Does NOT end in _HERE, so should not be a placeholder.
  assert.equal(isPlaceholderEnvValue('SOMEWHERE'), false)
  assert.equal(isPlaceholderEnvValue('HERE_IS_MY_TOKEN'), false)
  // CHANGE_ME must be exact — longer strings that contain it are not caught.
  assert.equal(isPlaceholderEnvValue('CHANGE_ME_NOW'), false)
  assert.equal(isPlaceholderEnvValue('DONT_CHANGE_ME'), false)
  // TODO must be exact — longer strings are not caught.
  assert.equal(isPlaceholderEnvValue('TODOS'), false)
  assert.equal(isPlaceholderEnvValue('TODO_LIST'), false)
  // Does not start with "<" — an angle bracket inside is not caught.
  assert.equal(isPlaceholderEnvValue('value<token>'), false)
})
