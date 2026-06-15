/**
 * Pure-helper tests for src/features/hooks/lib/hookChecks.ts (node:test).
 * Covers checkHook, extractScriptPath, resolveScriptPath, and matcherMatches.
 * All functions are deterministic and side-effect-free — no disk access, no IPC.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  checkHook,
  extractScriptPath,
  resolveScriptPath,
  matcherMatches,
} from '@/features/hooks/lib/hookChecks'
import type { HookEntry } from '@/shared/types/hooks'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<HookEntry> = {}): HookEntry {
  return {
    id: 'test-id',
    event: 'PreToolUse',
    matcher: '',
    command: 'echo hello',
    ...overrides,
  }
}

// ── checkHook: empty command → error ─────────────────────────────────────────

test('checkHook: empty command produces an error', () => {
  const issues = checkHook(makeEntry({ command: '' }))
  assert.ok(issues.some((i) => i.severity === 'error'))
  assert.ok(issues.some((i) => i.message.includes('empty')))
})

test('checkHook: whitespace-only command produces an error', () => {
  const issues = checkHook(makeEntry({ command: '   ' }))
  assert.ok(issues.some((i) => i.severity === 'error'))
})

// ── checkHook: destructive command → warning ──────────────────────────────────

test('checkHook: rm -rf command produces a warning', () => {
  const issues = checkHook(makeEntry({ command: 'rm -rf /tmp/build' }))
  assert.ok(issues.some((i) => i.severity === 'warning'))
  assert.ok(
    issues.some(
      (i) => i.message.includes('destructive') || i.message.includes('rm'),
    ),
  )
})

test('checkHook: git reset --hard produces a warning', () => {
  const issues = checkHook(makeEntry({ command: 'git reset --hard HEAD' }))
  assert.ok(issues.some((i) => i.severity === 'warning'))
})

test('checkHook: git push --force produces a warning', () => {
  const issues = checkHook(makeEntry({ command: 'git push --force origin main' }))
  assert.ok(issues.some((i) => i.severity === 'warning'))
})

// ── checkHook: invalid matcher regex → error ──────────────────────────────────

test('checkHook: invalid regex in matcher on a matcher event produces an error', () => {
  // PreToolUse uses a matcher, so invalid regex should be flagged.
  const issues = checkHook(
    makeEntry({ event: 'PreToolUse', matcher: '(unclosed' }),
  )
  assert.ok(issues.some((i) => i.severity === 'error'))
  assert.ok(
    issues.some(
      (i) =>
        i.message.includes('valid regular expression') ||
        i.message.includes('Matcher'),
    ),
  )
})

test('checkHook: valid regex in matcher on a matcher event produces no regex error', () => {
  const issues = checkHook(
    makeEntry({ event: 'PreToolUse', matcher: 'Edit|Write' }),
  )
  assert.ok(
    !issues.some((i) => i.message.includes('valid regular expression')),
  )
})

// ── checkHook: matcher on non-matcher event → warning ────────────────────────

test('checkHook: matcher on Stop event (non-matcher) produces a warning', () => {
  const issues = checkHook(makeEntry({ event: 'Stop', matcher: 'Bash' }))
  assert.ok(issues.some((i) => i.severity === 'warning'))
  assert.ok(
    issues.some(
      (i) => i.message.includes('ignores matchers') || i.message.includes('no effect'),
    ),
  )
})

test('checkHook: matcher on UserPromptSubmit (non-matcher) produces a warning', () => {
  const issues = checkHook(
    makeEntry({ event: 'UserPromptSubmit', matcher: 'Edit' }),
  )
  assert.ok(issues.some((i) => i.severity === 'warning'))
})

test('checkHook: empty matcher on Stop event produces no warning', () => {
  const issues = checkHook(makeEntry({ event: 'Stop', matcher: '' }))
  assert.ok(
    !issues.some(
      (i) => i.message.includes('ignores matchers') || i.message.includes('no effect'),
    ),
  )
})

// ── checkHook: bad timeout → warning ─────────────────────────────────────────

test('checkHook: timeout of 0 produces a warning', () => {
  const issues = checkHook(makeEntry({ timeout: 0 }))
  assert.ok(issues.some((i) => i.severity === 'warning'))
  assert.ok(issues.some((i) => i.message.includes('Timeout')))
})

test('checkHook: negative timeout produces a warning', () => {
  const issues = checkHook(makeEntry({ timeout: -5 }))
  assert.ok(issues.some((i) => i.severity === 'warning'))
})

test('checkHook: NaN timeout produces a warning', () => {
  const issues = checkHook(makeEntry({ timeout: NaN }))
  assert.ok(issues.some((i) => i.severity === 'warning'))
})

test('checkHook: positive timeout produces no timeout warning', () => {
  const issues = checkHook(makeEntry({ timeout: 30 }))
  assert.ok(!issues.some((i) => i.message.includes('Timeout')))
})

test('checkHook: undefined timeout produces no timeout warning', () => {
  const issues = checkHook(makeEntry({ timeout: undefined }))
  assert.ok(!issues.some((i) => i.message.includes('Timeout')))
})

// ── checkHook: clean entry → no issues ───────────────────────────────────────

test('checkHook: valid entry with no matcher, no timeout produces no issues', () => {
  const issues = checkHook(
    makeEntry({ event: 'Stop', matcher: '', command: 'echo done' }),
  )
  assert.equal(issues.length, 0)
})

test('checkHook: valid PreToolUse entry with valid regex matcher produces no issues', () => {
  const issues = checkHook(
    makeEntry({ event: 'PreToolUse', matcher: 'Edit|Write', command: 'echo hook' }),
  )
  assert.equal(issues.length, 0)
})

test('checkHook: valid entry with positive timeout produces no issues', () => {
  const issues = checkHook(
    makeEntry({ event: 'PostToolUse', matcher: '*', command: 'echo done', timeout: 60 }),
  )
  assert.equal(issues.length, 0)
})

// ── extractScriptPath: returns null for bare words ───────────────────────────

test('extractScriptPath: bare word without path chars returns null', () => {
  assert.equal(extractScriptPath('echo'), null)
})

test('extractScriptPath: command with no script extension returns null', () => {
  assert.equal(extractScriptPath('git commit -m "fix"'), null)
})

test('extractScriptPath: bare word with known extension but no path returns null', () => {
  // "node.js" has the .js extension but no slash or $ prefix — should not match.
  assert.equal(extractScriptPath('node.js'), null)
})

// ── extractScriptPath: extracts $-prefixed tokens ────────────────────────────

test('extractScriptPath: $-prefixed token with .sh extension is extracted', () => {
  const result = extractScriptPath(
    '$CLAUDE_PROJECT_DIR/.claude/hooks/guard.sh --flag',
  )
  assert.equal(result, '$CLAUDE_PROJECT_DIR/.claude/hooks/guard.sh')
})

test('extractScriptPath: $HOME/.scripts/run.py is extracted', () => {
  const result = extractScriptPath('$HOME/.scripts/run.py arg1')
  assert.equal(result, '$HOME/.scripts/run.py')
})

// ── extractScriptPath: extracts path-like tokens ────────────────────────────

test('extractScriptPath: absolute unix path with .sh extension is extracted', () => {
  const result = extractScriptPath('/usr/local/bin/hook.sh --verbose')
  assert.equal(result, '/usr/local/bin/hook.sh')
})

test('extractScriptPath: relative path ./hooks/run.sh is extracted', () => {
  const result = extractScriptPath('./hooks/run.sh arg')
  assert.equal(result, './hooks/run.sh')
})

test('extractScriptPath: returns the first script-like token', () => {
  // Only the first matching token should be returned.
  const result = extractScriptPath(
    '$CLAUDE_PROJECT_DIR/.claude/hooks/a.sh /other/b.sh',
  )
  assert.equal(result, '$CLAUDE_PROJECT_DIR/.claude/hooks/a.sh')
})

test('extractScriptPath: .ts script with path prefix is extracted', () => {
  const result = extractScriptPath('./scripts/check.ts --strict')
  assert.equal(result, './scripts/check.ts')
})

// ── resolveScriptPath: maps $CLAUDE_PROJECT_DIR paths ────────────────────────

test('resolveScriptPath: maps $CLAUDE_PROJECT_DIR/.claude/hooks/x.sh to <basePath>/hooks/x.sh', () => {
  const result = resolveScriptPath(
    '$CLAUDE_PROJECT_DIR/.claude/hooks/x.sh',
    '/home/user/.claude',
    'claude',
  )
  assert.equal(result, '/home/user/.claude/hooks/x.sh')
})

test('resolveScriptPath: handles basePath without trailing slash', () => {
  const result = resolveScriptPath(
    '$CLAUDE_PROJECT_DIR/.claude/hooks/run.py',
    '/home/user/.claude',
    'claude',
  )
  assert.ok(result?.startsWith('/home/user/.claude/'))
  assert.ok(result?.endsWith('run.py'))
})

test('resolveScriptPath: handles basePath with trailing slash', () => {
  const result = resolveScriptPath(
    '$CLAUDE_PROJECT_DIR/.claude/hooks/run.sh',
    '/home/user/.claude/',
    'claude',
  )
  // Must not produce double slashes.
  assert.ok(!result?.includes('//'))
  assert.ok(result?.endsWith('run.sh'))
})

// ── resolveScriptPath: passes absolute paths through ─────────────────────────

test('resolveScriptPath: absolute path without env prefix is returned as-is', () => {
  const result = resolveScriptPath(
    '/usr/local/bin/hook.sh',
    '/home/user/.claude',
    'claude',
  )
  assert.equal(result, '/usr/local/bin/hook.sh')
})

test('resolveScriptPath: empty basePath returns null', () => {
  const result = resolveScriptPath(
    '$CLAUDE_PROJECT_DIR/.claude/hooks/x.sh',
    '',
    'claude',
  )
  assert.equal(result, null)
})

// ── resolveScriptPath: returns null for un-mappable tokens ───────────────────

test('resolveScriptPath: $-prefixed token without agent marker returns null', () => {
  // A $-prefixed path that has no .claude/ (or agent) segment cannot be mapped.
  const result = resolveScriptPath(
    '$SOME_OTHER_VAR/run.sh',
    '/home/user/.claude',
    'claude',
  )
  assert.equal(result, null)
})

test('resolveScriptPath: bare word returns null', () => {
  const result = resolveScriptPath('run.sh', '/home/user/.claude', 'claude')
  assert.equal(result, null)
})

// ── matcherMatches: empty / * matches everything ─────────────────────────────

test('matcherMatches: empty string matches any tool name', () => {
  assert.equal(matcherMatches('', 'Bash'), true)
  assert.equal(matcherMatches('', 'Edit'), true)
  assert.equal(matcherMatches('', ''), true)
})

test('matcherMatches: * matches any tool name', () => {
  assert.equal(matcherMatches('*', 'Bash'), true)
  assert.equal(matcherMatches('*', 'Read'), true)
  assert.equal(matcherMatches('*', 'Write'), true)
})

test('matcherMatches: * with surrounding whitespace matches any tool', () => {
  assert.equal(matcherMatches('  *  ', 'Bash'), true)
})

// ── matcherMatches: anchored regex alternation ───────────────────────────────

test('matcherMatches: exact tool name matches itself', () => {
  assert.equal(matcherMatches('Bash', 'Bash'), true)
})

test('matcherMatches: exact tool name does not match a different tool', () => {
  assert.equal(matcherMatches('Bash', 'Edit'), false)
})

test('matcherMatches: alternation matches any of the listed tools', () => {
  assert.equal(matcherMatches('Edit|Write', 'Edit'), true)
  assert.equal(matcherMatches('Edit|Write', 'Write'), true)
})

test('matcherMatches: alternation does not match unlisted tool', () => {
  assert.equal(matcherMatches('Edit|Write', 'Bash'), false)
})

test('matcherMatches: match is anchored (no partial match)', () => {
  // 'Bash' matcher should not match 'BashLong'.
  assert.equal(matcherMatches('Bash', 'BashLong'), false)
  // Similarly, 'Edit' should not match 'MultiEdit'.
  assert.equal(matcherMatches('Edit', 'MultiEdit'), false)
})

// ── matcherMatches: invalid regex returns false ───────────────────────────────

test('matcherMatches: invalid regex returns false', () => {
  assert.equal(matcherMatches('(unclosed', 'Bash'), false)
})

test('matcherMatches: another invalid regex returns false', () => {
  assert.equal(matcherMatches('[invalid', 'Edit'), false)
})
