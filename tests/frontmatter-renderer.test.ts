/**
 * Pure-helper tests for src/features/collections/lib/frontmatter.ts (node:test).
 * Covers parseFrontmatter, serializeFrontmatter, and round-trip stability.
 * All functions are deterministic and side-effect-free — no disk access, no IPC.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseFrontmatter,
  serializeFrontmatter,
} from '@/features/collections/lib/frontmatter'

// ── parseFrontmatter: plain key: value ────────────────────────────────────────

test('parseFrontmatter: plain key: value is parsed correctly', () => {
  const input = '---\nname: my-command\n---\n'
  const { data, body } = parseFrontmatter(input)
  assert.equal(data['name'], 'my-command')
  assert.equal(body, '')
})

test('parseFrontmatter: multiple plain key: value pairs are all parsed', () => {
  const input = '---\nname: foo\ndescription: bar\nmodel: opus\n---\n'
  const { data, body } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
  assert.equal(data['description'], 'bar')
  assert.equal(data['model'], 'opus')
  assert.equal(body, '')
})

test('parseFrontmatter: value with a colon is parsed up to the first colon', () => {
  const input = '---\nname: some: value\n---\n'
  const { data } = parseFrontmatter(input)
  // key is 'name', value is 'some: value' (everything after first colon, trimmed)
  assert.equal(data['name'], 'some: value')
})

test('parseFrontmatter: body content after closing --- is returned correctly', () => {
  const input = '---\nname: foo\n---\nThis is the body.\nSecond line.\n'
  const { data, body } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
  assert.equal(body, 'This is the body.\nSecond line.\n')
})

// ── parseFrontmatter: quoted values ───────────────────────────────────────────

test('parseFrontmatter: double-quoted value has quotes stripped', () => {
  const input = '---\nname: "my command"\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], 'my command')
})

test('parseFrontmatter: single-quoted value has quotes stripped', () => {
  const input = "---\nname: 'my command'\n---\n"
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], 'my command')
})

test('parseFrontmatter: double-quoted value containing special chars is unquoted', () => {
  const input = '---\ndescription: "value: with colon and #hash"\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['description'], 'value: with colon and #hash')
})

test('parseFrontmatter: single-quoted empty value is parsed as empty string', () => {
  const input = "---\nname: ''\n---\n"
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], '')
})

test('parseFrontmatter: double-quoted empty value is parsed as empty string', () => {
  const input = '---\nname: ""\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], '')
})

// ── parseFrontmatter: block scalars (| and >) ─────────────────────────────────

test('parseFrontmatter: pipe block scalar | collects indented lines joined with spaces', () => {
  const input = '---\ndescription: |\n  first line\n  second line\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['description'], 'first line second line')
})

test('parseFrontmatter: folded block scalar > collects indented lines joined with spaces', () => {
  const input = '---\ndescription: >\n  folded\n  text here\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['description'], 'folded text here')
})

test('parseFrontmatter: block scalar followed by blank lines then indented lines merges all', () => {
  const input = '---\ndescription: |\n  line one\n\n  line two\n---\n'
  const { data } = parseFrontmatter(input)
  // blank lines are included, trimmed to '' then merged with spaces, collapsed
  const result = data['description']
  assert.ok(result.includes('line one'))
  assert.ok(result.includes('line two'))
})

test('parseFrontmatter: block scalar stops at the next non-indented key', () => {
  const input = '---\ndescription: |\n  block content\nname: stop-here\n---\n'
  const { data } = parseFrontmatter(input)
  assert.ok(data['description'].includes('block content'))
  assert.equal(data['name'], 'stop-here')
})

// ── parseFrontmatter: blank lines ─────────────────────────────────────────────

test('parseFrontmatter: blank lines between keys are skipped', () => {
  const input = '---\nname: foo\n\ndescription: bar\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
  assert.equal(data['description'], 'bar')
})

test('parseFrontmatter: leading blank line in frontmatter block is skipped', () => {
  const input = '---\n\nname: foo\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
})

// ── parseFrontmatter: indented child lines ────────────────────────────────────

test('parseFrontmatter: indented lines without a preceding block scalar are skipped', () => {
  const input = '---\n  indented: skipped\nname: real\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], 'real')
  // The indented 'indented: skipped' line should be skipped (not parsed as a key)
  assert.equal(Object.keys(data).length, 1)
})

test('parseFrontmatter: tab-indented lines are treated as child lines (skipped at top level)', () => {
  const input = '---\nname: root\n\tchild: value\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], 'root')
  assert.equal(Object.keys(data).length, 1)
})

// ── parseFrontmatter: missing --- delimiters ──────────────────────────────────

test('parseFrontmatter: content without opening --- returns empty data, whole content as body', () => {
  const input = 'name: foo\ndescription: bar\n'
  const { data, body } = parseFrontmatter(input)
  assert.deepEqual(data, {})
  assert.equal(body, input)
})

test('parseFrontmatter: content without closing --- returns empty data, whole content as body', () => {
  const input = '---\nname: foo\n'
  const { data, body } = parseFrontmatter(input)
  assert.deepEqual(data, {})
  assert.equal(body, input)
})

test('parseFrontmatter: empty string returns empty data and empty body', () => {
  const { data, body } = parseFrontmatter('')
  assert.deepEqual(data, {})
  assert.equal(body, '')
})

test('parseFrontmatter: only delimiters with no keys — regex requires content between them, returns no match', () => {
  // The regex requires at least one character (a newline) between the two --- lines.
  // '---\n---\n' does not match, so the whole input is returned as the body.
  const input = '---\n---\n'
  const { data, body } = parseFrontmatter(input)
  assert.deepEqual(data, {})
  assert.equal(body, input)
})

// ── parseFrontmatter: CRLF line endings ───────────────────────────────────────

test('parseFrontmatter: CRLF line endings are handled correctly', () => {
  const input = '---\r\nname: foo\r\ndescription: bar\r\n---\r\n'
  const { data, body } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
  assert.equal(data['description'], 'bar')
  assert.equal(body, '')
})

test('parseFrontmatter: CRLF body after closing delimiter is preserved', () => {
  const input = '---\r\nname: foo\r\n---\r\nbody content\r\n'
  const { data, body } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
  assert.equal(body, 'body content\r\n')
})

test('parseFrontmatter: mixed CRLF and LF line endings are tolerated', () => {
  const input = '---\r\nname: foo\ndescription: bar\r\n---\n'
  const { data } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
  assert.equal(data['description'], 'bar')
})

// ── serializeFrontmatter: KEY_ORDER ───────────────────────────────────────────

test('serializeFrontmatter: known keys appear before unknown keys in output', () => {
  const data = { 'unknown-key': 'z', name: 'foo', description: 'bar' }
  const out = serializeFrontmatter(data, '')
  const nameIdx = out.indexOf('name:')
  const descIdx = out.indexOf('description:')
  const unknownIdx = out.indexOf('unknown-key:')
  assert.ok(nameIdx < unknownIdx, 'name (in KEY_ORDER) must appear before unknown-key')
  assert.ok(descIdx < unknownIdx, 'description (in KEY_ORDER) must appear before unknown-key')
})

test('serializeFrontmatter: KEY_ORDER name before description before argument-hint', () => {
  const data = { 'argument-hint': 'hint', description: 'desc', name: 'n' }
  const out = serializeFrontmatter(data, '')
  const nameIdx = out.indexOf('name:')
  const descIdx = out.indexOf('description:')
  const hintIdx = out.indexOf('argument-hint:')
  assert.ok(nameIdx < descIdx)
  assert.ok(descIdx < hintIdx)
})

test('serializeFrontmatter: model appears after allowed-tools in KEY_ORDER', () => {
  const data = { model: 'opus', 'allowed-tools': 'Read,Write', name: 'x' }
  const out = serializeFrontmatter(data, '')
  const toolsIdx = out.indexOf('allowed-tools:')
  const modelIdx = out.indexOf('model:')
  assert.ok(toolsIdx < modelIdx, 'allowed-tools appears before model in KEY_ORDER')
})

// ── serializeFrontmatter: drops empty values ──────────────────────────────────

test('serializeFrontmatter: empty string value is dropped from output', () => {
  const data = { name: 'foo', description: '' }
  const out = serializeFrontmatter(data, '')
  assert.ok(!out.includes('description:'), 'empty description must not appear')
  assert.ok(out.includes('name:'))
})

test('serializeFrontmatter: whitespace-only value is dropped from output', () => {
  const data = { name: '  ', description: 'real' }
  const out = serializeFrontmatter(data, '')
  assert.ok(!out.includes('name:'), 'whitespace-only name must not appear')
  assert.ok(out.includes('description:'))
})

test('serializeFrontmatter: null-ish coercion — key with undefined is dropped', () => {
  // Frontmatter type is Record<string, string>, but test graceful coercion via cast
  const data: Record<string, string> = { name: 'good' }
  // Simulate undefined via explicit assignment to satisfy type
  ;(data as Record<string, string | undefined>)['model'] = undefined
  const out = serializeFrontmatter(data as Record<string, string>, '')
  assert.ok(out.includes('name:'))
  assert.ok(!out.includes('model:'))
})

// ── serializeFrontmatter: quoting ─────────────────────────────────────────────

test('serializeFrontmatter: value containing colon is quoted', () => {
  const data = { description: 'key: value pair' }
  const out = serializeFrontmatter(data, '')
  // The value must be double-quoted in the output
  assert.ok(out.includes('"key: value pair"'), 'value with colon must be quoted')
})

test('serializeFrontmatter: value containing hash is quoted', () => {
  const data = { description: 'has #comment char' }
  const out = serializeFrontmatter(data, '')
  assert.ok(out.includes('"has #comment char"'), 'value with # must be quoted')
})

test('serializeFrontmatter: value starting with > is quoted', () => {
  const data = { description: '>folded scalar indicator' }
  const out = serializeFrontmatter(data, '')
  assert.ok(out.includes('"'), 'value starting with > must be quoted')
})

test('serializeFrontmatter: value starting with | is quoted', () => {
  const data = { description: '|block indicator' }
  const out = serializeFrontmatter(data, '')
  assert.ok(out.includes('"'), 'value starting with | must be quoted')
})

test('serializeFrontmatter: value starting with * is quoted', () => {
  const data = { description: '*alias' }
  const out = serializeFrontmatter(data, '')
  assert.ok(out.includes('"'), 'value starting with * must be quoted')
})

test('serializeFrontmatter: plain value without special chars is not quoted', () => {
  const data = { name: 'simple-name' }
  const out = serializeFrontmatter(data, '')
  assert.ok(!out.includes('"'), 'plain value must not be quoted')
  assert.ok(out.includes('name: simple-name'))
})

test('serializeFrontmatter: value with leading whitespace is trimmed before emit (not quoted)', () => {
  // serializeFrontmatter trims the value via data[k].trim() before calling emit(),
  // so a leading space is stripped and the resulting value does not require quoting.
  const data = { name: ' leading-space' }
  const out = serializeFrontmatter(data, '')
  // After trimming, 'leading-space' needs no quoting
  assert.ok(out.includes('name: leading-space'), 'trimmed value emitted without quotes')
})

// ── serializeFrontmatter: no non-empty keys → body alone ──────────────────────

test('serializeFrontmatter: no keys → returns body without frontmatter block', () => {
  const out = serializeFrontmatter({}, 'just the body\n')
  assert.equal(out, 'just the body\n')
  assert.ok(!out.includes('---'))
})

test('serializeFrontmatter: all empty values → returns body without frontmatter block', () => {
  const data = { name: '', description: '   ' }
  const out = serializeFrontmatter(data, 'body here\n')
  assert.equal(out, 'body here\n')
  assert.ok(!out.includes('---'))
})

test('serializeFrontmatter: empty data with empty body returns empty string', () => {
  const out = serializeFrontmatter({}, '')
  assert.equal(out, '')
})

// ── serializeFrontmatter: body handling ───────────────────────────────────────

test('serializeFrontmatter: emits --- delimiters with body when keys are present', () => {
  const data = { name: 'cmd' }
  const out = serializeFrontmatter(data, 'body text')
  assert.ok(out.startsWith('---\n'))
  assert.ok(out.includes('\n---\n'))
  assert.ok(out.includes('body text'))
})

test('serializeFrontmatter: leading newlines are stripped from body', () => {
  const data = { name: 'cmd' }
  const out = serializeFrontmatter(data, '\n\nbody text')
  assert.ok(!out.includes('---\n\n\n'), 'leading newlines must be stripped from body')
  assert.ok(out.endsWith('body text'))
})

test('serializeFrontmatter: blank body when keys are present emits frontmatter only', () => {
  const data = { name: 'cmd' }
  const out = serializeFrontmatter(data, '')
  assert.ok(out.startsWith('---\n'))
  assert.ok(out.endsWith('---\n\n'))
})

// ── round-trip: parse then serialize is stable ────────────────────────────────

test('round-trip: realistic CLAUDE.md-style command frontmatter is stable', () => {
  const original = [
    '---',
    'name: run-tests',
    'description: Run the project test suite and report results',
    'argument-hint: <test-pattern>',
    'allowed-tools: Bash,Read',
    'model: claude-opus-4-5',
    '---',
    '',
    'Run `pnpm test` and capture the output.',
    '',
    'If a test-pattern argument is supplied, pass it to the test runner.',
    '',
  ].join('\n')

  const { data, body } = parseFrontmatter(original)
  const reserialized = serializeFrontmatter(data, body)
  const { data: data2, body: body2 } = parseFrontmatter(reserialized)

  assert.deepEqual(data2, data, 'second parse must yield same data as first parse')
  assert.equal(body2, body2, 'body must be stable across the round-trip')
})

test('round-trip: data with quoted values round-trips correctly', () => {
  const original = '---\nname: "value: with colon"\ndescription: plain\n---\nbody\n'
  const { data, body } = parseFrontmatter(original)
  const reserialized = serializeFrontmatter(data, body)
  const { data: data2 } = parseFrontmatter(reserialized)
  assert.deepEqual(data2, data)
})

test('round-trip: body-only content (no frontmatter) is returned unchanged', () => {
  const original = '# Just markdown\n\nNo frontmatter here.\n'
  const { data, body } = parseFrontmatter(original)
  const reserialized = serializeFrontmatter(data, body)
  // Since no keys, serializeFrontmatter returns the body (trimmed of leading newlines)
  assert.equal(reserialized, original)
})

test('round-trip: second serialize from re-parsed data equals first serialize', () => {
  const input = '---\nname: cmd\ndescription: A useful command\nmodel: opus\n---\nDo something.\n'
  const { data, body } = parseFrontmatter(input)
  const first = serializeFrontmatter(data, body)
  const { data: data2, body: body2 } = parseFrontmatter(first)
  const second = serializeFrontmatter(data2, body2)
  assert.equal(second, first, 'second serialize must equal first (idempotent)')
})

test('round-trip: empty frontmatter block — regex requires content between delimiters', () => {
  // '---\n---\nJust a body.\n' does not match the regex (no content between delimiters),
  // so parseFrontmatter returns the whole string as the body with empty data.
  const input = '---\n---\nJust a body.\n'
  const { data, body } = parseFrontmatter(input)
  assert.deepEqual(data, {})
  assert.equal(body, input)
  // Since no keys, serializeFrontmatter returns the body unchanged.
  const out = serializeFrontmatter(data, body)
  assert.equal(out, input)
})

test('round-trip: CRLF input parses and re-serializes to LF output', () => {
  const input = '---\r\nname: foo\r\ndescription: bar\r\n---\r\nbody text\r\n'
  const { data, body } = parseFrontmatter(input)
  assert.equal(data['name'], 'foo')
  assert.equal(data['description'], 'bar')
  const out = serializeFrontmatter(data, body)
  // Serialized output uses LF; re-parsing it must yield same data
  const { data: data2 } = parseFrontmatter(out)
  assert.deepEqual(data2, data)
})
