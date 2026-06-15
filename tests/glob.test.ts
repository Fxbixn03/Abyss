/**
 * Pure-helper tests for src/features/permissions/lib/glob.ts (node:test).
 * Covers globToRegExp, previewSpecifier, isValidRule, and SAMPLE_PATHS matching.
 * All functions are deterministic and side-effect-free — no disk access, no IPC.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  globToRegExp,
  previewSpecifier,
  isValidRule,
  parseRule,
  PATH_TOOLS,
  SAMPLE_PATHS,
} from '@/features/permissions/lib/glob'

// ── globToRegExp: * (no-slash wildcard) ───────────────────────────────────────

test('globToRegExp: * matches any sequence of non-slash characters', () => {
  const re = globToRegExp('*.ts')
  assert.ok(re.test('index.ts'))
  assert.ok(re.test('main.ts'))
  assert.ok(!re.test('src/index.ts'), '* must not cross a directory boundary')
})

test('globToRegExp: * does not match an empty segment', () => {
  const re = globToRegExp('src/*.ts')
  assert.ok(re.test('src/index.ts'))
  assert.ok(!re.test('src/nested/index.ts'))
})

test('globToRegExp: * alone matches any filename without slashes', () => {
  const re = globToRegExp('*')
  assert.ok(re.test('README.md'))
  assert.ok(re.test('.env'))
  assert.ok(!re.test('src/index.ts'))
})

// ── globToRegExp: ** (any wildcard) ───────────────────────────────────────────

test('globToRegExp: ** matches across directory boundaries', () => {
  const re = globToRegExp('src/**')
  assert.ok(re.test('src/index.ts'))
  assert.ok(re.test('src/app/main.tsx'))
  assert.ok(re.test('src/features/permissions/lib/glob.ts'))
  assert.ok(!re.test('docs/guide.md'))
})

test('globToRegExp: ** at the beginning requires a slash separator before the filename', () => {
  // **/*.md becomes /^.*\/[^/]*\.md$/ — a slash is required before the filename segment.
  const re = globToRegExp('**/*.md')
  assert.ok(!re.test('README.md'), '**/*.md requires at least one directory prefix')
  assert.ok(re.test('docs/guide.md'))
  assert.ok(re.test('a/b/c.md'))
})

test('globToRegExp: ** alone matches any path', () => {
  const re = globToRegExp('**')
  assert.ok(re.test('README.md'))
  assert.ok(re.test('src/index.ts'))
  assert.ok(re.test('src/app/main.tsx'))
  assert.ok(re.test('.git/config'))
})

// ── globToRegExp: ? (single non-slash character) ──────────────────────────────

test('globToRegExp: ? matches exactly one non-slash character', () => {
  const re = globToRegExp('?.ts')
  assert.ok(re.test('a.ts'))
  assert.ok(re.test('b.ts'))
  assert.ok(!re.test('ab.ts'), '? must match exactly one character')
  assert.ok(!re.test('.ts'), '? must match at least one character')
})

test('globToRegExp: ? does not match a slash', () => {
  const re = globToRegExp('src/?.ts')
  assert.ok(re.test('src/a.ts'))
  assert.ok(!re.test('src/ab.ts'))
  assert.ok(!re.test('src//a.ts'), '? must not match a slash')
})

test('globToRegExp: multiple ? characters each match one non-slash character', () => {
  const re = globToRegExp('??.ts')
  assert.ok(re.test('ab.ts'))
  assert.ok(!re.test('a.ts'))
  assert.ok(!re.test('abc.ts'))
})

// ── globToRegExp: regex-special characters are escaped ────────────────────────

test('globToRegExp: dot is treated as literal, not regex wildcard', () => {
  const re = globToRegExp('.env')
  assert.ok(re.test('.env'))
  // An 'x' in place of the dot must NOT match (would if dot were unescaped).
  assert.ok(!re.test('xenv'))
})

test('globToRegExp: plus sign is escaped and treated as literal', () => {
  const re = globToRegExp('a+b')
  assert.ok(re.test('a+b'))
  assert.ok(!re.test('ab'), 'unescaped + would make "b" optional')
  assert.ok(!re.test('aab'))
})

test('globToRegExp: parentheses are escaped and treated as literal', () => {
  const re = globToRegExp('func(arg)')
  assert.ok(re.test('func(arg)'))
  assert.ok(!re.test('funcarg'))
})

test('globToRegExp: caret is escaped and treated as literal', () => {
  const re = globToRegExp('^start')
  assert.ok(re.test('^start'))
  assert.ok(!re.test('start'))
})

test('globToRegExp: dollar sign is escaped and treated as literal', () => {
  const re = globToRegExp('end$')
  assert.ok(re.test('end$'))
  assert.ok(!re.test('end'))
})

test('globToRegExp: curly braces are escaped and treated as literal', () => {
  const re = globToRegExp('{a,b}')
  assert.ok(re.test('{a,b}'))
  assert.ok(!re.test('a'))
  assert.ok(!re.test('b'))
})

test('globToRegExp: square brackets are escaped and treated as literal', () => {
  const re = globToRegExp('[abc]')
  assert.ok(re.test('[abc]'))
  // A single 'a' must not match (would if [ were a regex char class).
  assert.ok(!re.test('a'))
})

test('globToRegExp: backslash is escaped and treated as literal', () => {
  const re = globToRegExp('path\\file')
  assert.ok(re.test('path\\file'))
})

test('globToRegExp: forward slash in pattern is treated as literal separator', () => {
  const re = globToRegExp('src/index.ts')
  assert.ok(re.test('src/index.ts'))
  assert.ok(!re.test('srcXindex.ts'))
})

test('globToRegExp: pipe character is escaped and treated as literal', () => {
  const re = globToRegExp('a|b')
  assert.ok(re.test('a|b'))
  // Without escaping, 'a' or 'b' alone would match in a regex alternation.
  assert.ok(!re.test('a'))
  assert.ok(!re.test('b'))
})

// ── globToRegExp: result is anchored ──────────────────────────────────────────

test('globToRegExp: result is anchored (no partial matching)', () => {
  const re = globToRegExp('*.ts')
  // The regex must be anchored so it does not match a superset.
  assert.ok(!re.test('prefix/index.ts'))
  assert.ok(!re.test('index.tsx'))
})

test('globToRegExp: anchored match does not match prefix substrings', () => {
  const re = globToRegExp('src')
  assert.ok(re.test('src'))
  assert.ok(!re.test('src/index.ts'), 'anchored regex must not match if pattern is shorter')
})

// ── SAMPLE_PATHS matching via globToRegExp ────────────────────────────────────

test('SAMPLE_PATHS: .env* glob matches .env and .env.local but not production.env', () => {
  const re = globToRegExp('.env*')
  const matches = SAMPLE_PATHS.filter((p) => re.test(p))
  assert.ok(matches.includes('.env'))
  assert.ok(matches.includes('.env.local'))
  assert.ok(matches.includes('.env.production'))
  assert.ok(!matches.includes('production.env'), 'production.env does not start with .env')
})

test('SAMPLE_PATHS: secrets/** matches all secrets/ entries', () => {
  const re = globToRegExp('secrets/**')
  const matches = SAMPLE_PATHS.filter((p) => re.test(p))
  assert.deepEqual(matches, ['secrets/key.pem', 'secrets/token.txt'])
})

test('SAMPLE_PATHS: *.md matches README.md but not docs/guide.md (no slash crossing)', () => {
  const re = globToRegExp('*.md')
  const matches = SAMPLE_PATHS.filter((p) => re.test(p))
  assert.ok(matches.includes('README.md'))
  assert.ok(!matches.includes('docs/guide.md'))
})

test('SAMPLE_PATHS: **/*.md matches docs/guide.md but not bare README.md (slash required)', () => {
  // **/*.md → /^.*\/[^/]*\.md$/ requires a directory prefix before the filename.
  const re = globToRegExp('**/*.md')
  const matches = SAMPLE_PATHS.filter((p) => re.test(p))
  assert.ok(!matches.includes('README.md'), 'README.md has no directory prefix so **/*.md skips it')
  assert.ok(matches.includes('docs/guide.md'))
})

test('SAMPLE_PATHS: .git/** matches .git/config and .git/HEAD', () => {
  const re = globToRegExp('.git/**')
  const matches = SAMPLE_PATHS.filter((p) => re.test(p))
  assert.deepEqual(matches, ['.git/config', '.git/HEAD'])
})

test('SAMPLE_PATHS: ?.env matches a path with exactly one char before .env', () => {
  // ?.env → /^[^/]\.env$/ — the ? matches exactly one non-slash character.
  // '.env' in SAMPLE_PATHS is only 4 chars; the pattern needs 5 chars (1 + '.env').
  // None of the SAMPLE_PATHS are a single char followed by '.env', so no match.
  const re = globToRegExp('?.env')
  const matches = SAMPLE_PATHS.filter((p) => re.test(p))
  assert.equal(matches.length, 0, 'no sample path is a single char + ".env"')
  // Verify the pattern does match when the input is right (e.g., "a.env").
  assert.ok(re.test('a.env'), '? must match exactly one non-slash char before .env')
  assert.ok(!re.test('.env'), '.env has no leading char so ? has nothing to match')
})

// ── isValidRule ───────────────────────────────────────────────────────────────

test('isValidRule: bare tool name is valid', () => {
  assert.ok(isValidRule('Read'))
  assert.ok(isValidRule('Bash'))
  assert.ok(isValidRule('Write'))
  assert.ok(isValidRule('Edit'))
})

test('isValidRule: tool with specifier is valid', () => {
  assert.ok(isValidRule('Read(./src/**)'))
  assert.ok(isValidRule('Bash(git push:*)'))
  assert.ok(isValidRule('Write(./output.txt)'))
})

test('isValidRule: bare tool with underscore prefix is valid', () => {
  assert.ok(isValidRule('_private_tool'))
})

test('isValidRule: MCP tool id with two segments is valid', () => {
  assert.ok(isValidRule('mcp__github__create_issue'))
  assert.ok(isValidRule('mcp__slack__send_message'))
  assert.ok(isValidRule('mcp__my-server__my_tool'))
})

test('isValidRule: MCP server id (one segment) is valid', () => {
  assert.ok(isValidRule('mcp__github'))
  assert.ok(isValidRule('mcp__my-server'))
})

test('isValidRule: empty string is invalid', () => {
  assert.ok(!isValidRule(''))
})

test('isValidRule: rule starting with a digit is invalid', () => {
  assert.ok(!isValidRule('1Read'))
  assert.ok(!isValidRule('9tool'))
})

test('isValidRule: rule with leading hyphen is invalid', () => {
  assert.ok(!isValidRule('-Bash'))
})

test('isValidRule: whitespace-only rule is invalid', () => {
  assert.ok(!isValidRule('   '))
})

test('isValidRule: rule with spaces in tool name is invalid', () => {
  assert.ok(!isValidRule('Read Write'))
})

// ── previewSpecifier: bare tool (no specifier) ────────────────────────────────

test('previewSpecifier: bare tool returns kind=tool, valid=true, non-empty note', () => {
  const result = previewSpecifier('Read', '')
  assert.equal(result.kind, 'tool')
  assert.equal(result.valid, true)
  assert.ok(result.note.length > 0, 'note must be non-empty')
  assert.deepEqual(result.matches, [])
})

test('previewSpecifier: bare Bash returns kind=tool, note mentions Bash', () => {
  const result = previewSpecifier('Bash', '')
  assert.equal(result.kind, 'tool')
  assert.equal(result.valid, true)
  assert.ok(result.note.includes('Bash'), 'note should mention the tool name')
})

test('previewSpecifier: bare unknown tool returns kind=tool, valid=true', () => {
  const result = previewSpecifier('CustomTool', '')
  assert.equal(result.kind, 'tool')
  assert.equal(result.valid, true)
  assert.ok(result.note.length > 0)
})

// ── previewSpecifier: Bash prefix rules ───────────────────────────────────────

test('previewSpecifier: Bash with :* suffix returns kind=command, note mentions "starting with"', () => {
  const result = previewSpecifier('Bash', 'git push:*')
  assert.equal(result.kind, 'command')
  assert.equal(result.valid, true)
  assert.ok(result.note.includes('starting with'), 'note should mention prefix match')
  assert.ok(result.note.includes('git push'), 'note should include the prefix')
  assert.deepEqual(result.matches, [])
})

test('previewSpecifier: Bash without :* returns kind=command, note mentions exact match', () => {
  const result = previewSpecifier('Bash', 'npm run test')
  assert.equal(result.kind, 'command')
  assert.equal(result.valid, true)
  assert.ok(result.note.includes('npm run test'), 'note should include the command')
  assert.ok(!result.note.includes('starting with'), 'should not imply prefix when no :*')
  assert.deepEqual(result.matches, [])
})

test('previewSpecifier: Bash with :* strips suffix from displayed prefix', () => {
  const result = previewSpecifier('Bash', 'docker run:*')
  assert.ok(result.note.includes('docker run'), 'note should show prefix without :*')
  assert.ok(!result.note.includes(':*'), 'note should not literally include :*')
})

test('previewSpecifier: Bash note is non-empty for both :* and plain variants', () => {
  const withSuffix = previewSpecifier('Bash', 'rm -rf:*')
  const withoutSuffix = previewSpecifier('Bash', 'echo hello')
  assert.ok(withSuffix.note.length > 0)
  assert.ok(withoutSuffix.note.length > 0)
})

// ── previewSpecifier: path globs (PATH_TOOLS) ─────────────────────────────────

test('previewSpecifier: Read with .env glob returns kind=path, matches .env entries', () => {
  const result = previewSpecifier('Read', '.env*')
  assert.equal(result.kind, 'path')
  assert.equal(result.valid, true)
  assert.ok(result.matches.length > 0, 'should match at least one sample path')
  assert.ok(result.matches.includes('.env'))
  assert.ok(result.note.length > 0)
})

test('previewSpecifier: Write with ** returns kind=path, matches all sample paths', () => {
  const result = previewSpecifier('Write', '**')
  assert.equal(result.kind, 'path')
  assert.equal(result.matches.length, SAMPLE_PATHS.length)
})

test('previewSpecifier: Edit with no-match glob returns kind=path, empty matches, non-empty note', () => {
  const result = previewSpecifier('Edit', 'nonexistent/path/that/matches/nothing.xyz')
  assert.equal(result.kind, 'path')
  assert.equal(result.matches.length, 0)
  assert.ok(result.note.length > 0, 'note must be non-empty even when no matches')
})

test('previewSpecifier: path tool strips leading ./ from glob before matching', () => {
  const withDot = previewSpecifier('Read', './.env*')
  const withoutDot = previewSpecifier('Read', '.env*')
  // Both should produce the same matches since ./ is stripped.
  assert.deepEqual(withDot.matches, withoutDot.matches)
})

test('previewSpecifier: Glob tool is in PATH_TOOLS and treated as path kind', () => {
  assert.ok(PATH_TOOLS.has('Glob'))
  const result = previewSpecifier('Glob', 'src/**')
  assert.equal(result.kind, 'path')
})

test('previewSpecifier: Grep tool is in PATH_TOOLS and treated as path kind', () => {
  assert.ok(PATH_TOOLS.has('Grep'))
  const result = previewSpecifier('Grep', '**.ts')
  assert.equal(result.kind, 'path')
})

test('previewSpecifier: MultiEdit is in PATH_TOOLS and treated as path kind', () => {
  assert.ok(PATH_TOOLS.has('MultiEdit'))
  const result = previewSpecifier('MultiEdit', 'src/**')
  assert.equal(result.kind, 'path')
})

test('previewSpecifier: secrets/** matches secrets/key.pem and secrets/token.txt', () => {
  const result = previewSpecifier('Read', 'secrets/**')
  assert.equal(result.kind, 'path')
  assert.ok(result.matches.includes('secrets/key.pem'))
  assert.ok(result.matches.includes('secrets/token.txt'))
})

// ── previewSpecifier: unknown tool with specifier ─────────────────────────────

test('previewSpecifier: unknown tool with specifier returns kind=tool, non-empty note', () => {
  const result = previewSpecifier('MyCustomTool', 'some-specifier')
  assert.equal(result.kind, 'tool')
  assert.ok(result.note.length > 0)
  assert.deepEqual(result.matches, [])
})

test('previewSpecifier: unknown tool note includes the specifier', () => {
  const result = previewSpecifier('MyCustomTool', 'my-arg')
  assert.ok(result.note.includes('my-arg'), 'note should reference the specifier for unknown tools')
})

// ── parseRule ─────────────────────────────────────────────────────────────────

test('parseRule: bare tool with no parens returns null specifier', () => {
  const parsed = parseRule('Read')
  assert.equal(parsed.tool, 'Read')
  assert.equal(parsed.specifier, null)
})

test('parseRule: tool with specifier splits correctly', () => {
  const parsed = parseRule('Bash(git push:*)')
  assert.equal(parsed.tool, 'Bash')
  assert.equal(parsed.specifier, 'git push:*')
})

test('parseRule: tool with empty parens has empty-string specifier', () => {
  const parsed = parseRule('Read()')
  assert.equal(parsed.tool, 'Read')
  assert.equal(parsed.specifier, '')
})

test('parseRule: rule with leading/trailing whitespace is trimmed', () => {
  const parsed = parseRule('  Bash(rm -rf:*)  ')
  assert.equal(parsed.tool, 'Bash')
  assert.equal(parsed.specifier, 'rm -rf:*')
})

test('parseRule: specifier containing glob chars is preserved exactly', () => {
  const parsed = parseRule('Read(./src/**/*.ts)')
  assert.equal(parsed.tool, 'Read')
  assert.equal(parsed.specifier, './src/**/*.ts')
})

test('parseRule: MCP id with no parens returns null specifier', () => {
  const parsed = parseRule('mcp__github__create_issue')
  assert.equal(parsed.tool, 'mcp__github__create_issue')
  assert.equal(parsed.specifier, null)
})
