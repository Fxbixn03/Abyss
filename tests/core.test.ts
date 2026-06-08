/**
 * Core unit tests (node:test). Run with `pnpm test`. They use temp dirs or pure
 * functions, so they're deterministic and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { writeZip, readZip } from '@core/zip'
import { uniqueTempPath } from '@core/tmp-path'
import { readMcpServers, writeMcpServers } from '@core/mcp'
import {
  writeCollectionItem,
  readCollectionItem,
  renameCollectionItem,
  duplicateCollectionItem,
  exportCollectionItem,
  listCollection,
} from '@core/collections'
import {
  listGeminiCommands,
  writeGeminiCommand,
  renameGeminiCommand,
} from '@core/gemini-commands'
import { readHooks, writeHooks } from '@core/hooks'
import {
  configureSnapshots,
  recordSnapshot,
  listSnapshots,
  restoreSnapshot,
} from '@core/snapshots'
import {
  blocksFromAnthropicContent,
  firstTextSnippet,
  projectLabelFromCwd,
} from '@core/chat/normalize'
import { parseFrontmatter } from '@core/frontmatter'
import { readJsonFile } from '@core/json-file'
import { ConfigParseError } from '@core/config-error'
import { SettingsStore } from '@core/settings-store'
import {
  readPermissions,
  writePermissions,
  readModelEnv,
  writeModelEnv,
} from '@core/claude-settings'
import { exportBundle, applyBundle } from '@core/bundle'
import { redactBundleSecrets, REDACTED_PLACEHOLDER } from '@core/bundle-redact'
import {
  configureProfiles,
  saveProfile,
  listProfiles,
  readProfile,
} from '@core/profiles'
import { createBackup, listBackups } from '@core/backup'
import { compareSurface } from '@core/sync'
import { readClaudeSession, readSessionMeta } from '@core/chat/claude/parse'
import { readCodexSession, readCodexMeta } from '@core/chat/codex/parse'
import { mcpOfficialProvider } from '@core/discovery/mcp-official.provider'
import {
  parseRule,
  isValidRule,
  globToRegExp,
  previewSpecifier,
} from '@/features/permissions/lib/glob'
import {
  isWellFormedPath,
  isInsideRoot,
  resolveScopedPath,
  assertScopedPath,
  PathScopeError,
} from '@core/path-scope'
import type { McpServerEntry } from '@/shared/types/config'
import type { McpInstallSpec } from '@/shared/mcp/discovery'
import type { OsEnv } from '@/shared/types/agent'
import type { ExportBundle } from '@/shared/types/bundle'

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

test('readJsonFile throws a typed ConfigParseError on corrupt JSON', async () => {
  const base = await tmp('abyss-corrupt-')
  const file = path.join(base, 'broken.json')
  await fs.writeFile(file, '{ "a": 1, oops', 'utf8')
  await assert.rejects(readJsonFile(file, {}), (err: unknown) => {
    assert.ok(err instanceof ConfigParseError)
    assert.equal((err as ConfigParseError).code, 'CONFIG_PARSE_ERROR')
    assert.equal((err as ConfigParseError).filePath, file)
    return true
  })
  await fs.rm(base, { recursive: true, force: true })
})

test('SettingsStore degrades a partly-corrupt settings file to defaults', async () => {
  const base = await tmp('abyss-settings-')
  const file = path.join(base, 'settings.json')
  // confirmDiffBeforeSave has the wrong type; backupKeep is valid.
  await fs.writeFile(
    file,
    JSON.stringify({ confirmDiffBeforeSave: 'nope', backupKeep: 7 }),
    'utf8',
  )
  const settings = await new SettingsStore(file).read()
  assert.equal(settings.confirmDiffBeforeSave, true) // fell back to default
  assert.equal(settings.backupKeep, 7) // valid value preserved
  await fs.rm(base, { recursive: true, force: true })
})

test('zip writer/reader round-trip (STORED)', () => {
  const buf = writeZip([
    { path: 'a/SKILL.md', data: Buffer.from('# hello\n') },
    { path: 'a/x.txt', data: Buffer.from('data') },
  ])
  const entries = readZip(buf).filter((e) => !e.isDirectory)
  assert.equal(entries.length, 2)
  assert.equal(
    entries.find((e) => e.path === 'a/SKILL.md')?.data.toString(),
    '# hello\n',
  )
})

test('zip reader rejects an entry whose data runs past the buffer', () => {
  const buf = writeZip([{ path: 'a.txt', data: Buffer.from('hi') }])
  // One STORED entry: local block is 30 + nameLen(5) + dataLen(2) = 37 bytes,
  // so the central-directory header starts at 37 and its compressed-size field
  // sits at +20. Point it past the buffer and the reader must refuse it.
  buf.writeUInt32LE(0xffffffff, 37 + 20)
  assert.throws(() => readZip(buf), /out of bounds/)
})

test('uniqueTempPath yields distinct names for the same target', () => {
  const target = '/tmp/abyss-x.json'
  const a = uniqueTempPath(target)
  const b = uniqueTempPath(target)
  assert.notEqual(a, b)
  assert.ok(a.startsWith(`${target}.abyss-tmp-`))
  assert.ok(b.startsWith(`${target}.abyss-tmp-`))
})

test('cursor MCP json round-trip', async () => {
  const base = await tmp('abyss-mcp-')
  const entry: McpServerEntry = {
    id: '1',
    name: 'srv',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'pkg'],
    env: { K: 'v' },
    enabled: true,
  }
  await writeMcpServers('cursor', base, [entry])
  const back = await readMcpServers('cursor', base)
  assert.equal(back.length, 1)
  assert.equal(back[0].name, 'srv')
  assert.equal(back[0].command, 'npx')
  assert.deepEqual(back[0].args, ['-y', 'pkg'])
  await fs.rm(base, { recursive: true, force: true })
})

test('copilot MCP json round-trip maps stdio to "local"', async () => {
  const base = await tmp('abyss-copilot-')
  await writeMcpServers('copilot', base, [
    {
      id: '1',
      name: 'srv',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'pkg'],
      env: { K: 'v' },
      enabled: true,
    },
  ])
  // On disk the stdio server must use Copilot's "local" transport token.
  const raw = JSON.parse(
    await fs.readFile(path.join(base, 'mcp-config.json'), 'utf8'),
  )
  assert.equal(raw.mcpServers.srv.type, 'local')
  // Reading back normalizes "local" → "stdio".
  const back = await readMcpServers('copilot', base)
  assert.equal(back.length, 1)
  assert.equal(back[0].type, 'stdio')
  assert.equal(back[0].command, 'npx')
  await fs.rm(base, { recursive: true, force: true })
})

test('windsurf MCP json round-trip uses mcp_config.json', async () => {
  const base = await tmp('abyss-windsurf-')
  await writeMcpServers('windsurf', base, [
    {
      id: '1',
      name: 'srv',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'pkg'],
      env: {},
      enabled: true,
    },
  ])
  const raw = JSON.parse(
    await fs.readFile(path.join(base, 'mcp_config.json'), 'utf8'),
  )
  assert.equal(raw.mcpServers.srv.command, 'npx')
  const back = await readMcpServers('windsurf', base)
  assert.equal(back.length, 1)
  assert.equal(back[0].command, 'npx')
  await fs.rm(base, { recursive: true, force: true })
})

test('codex MCP toml round-trip preserves other keys', async () => {
  const base = await tmp('abyss-codex-')
  await fs.writeFile(
    path.join(base, 'config.toml'),
    'model = "o3"\n[mcp_servers.keep]\ncommand = "x"\n',
    'utf8',
  )
  await writeMcpServers('codex', base, [
    {
      id: '1',
      name: 'added',
      type: 'stdio',
      command: 'uvx',
      args: ['s'],
      env: {},
      enabled: true,
    },
  ])
  const raw = await fs.readFile(path.join(base, 'config.toml'), 'utf8')
  assert.ok(raw.includes('model = "o3"'))
  assert.ok(raw.includes('[mcp_servers.added]'))
  const back = await readMcpServers('codex', base)
  assert.equal(back.length, 1)
  await fs.rm(base, { recursive: true, force: true })
})

test('collections rename + duplicate + export', async () => {
  const base = await tmp('abyss-col-')
  await writeCollectionItem(
    'claude',
    base,
    'commands',
    'foo',
    '---\nname: foo\n---\nbody\n',
  )
  await renameCollectionItem('claude', base, 'commands', 'foo', 'bar')
  await duplicateCollectionItem('claude', base, 'commands', 'bar', 'bar-copy')
  const ids = (await listCollection('claude', base, 'commands'))
    .map((i) => i.id)
    .sort()
  assert.deepEqual(ids, ['bar', 'bar-copy'])
  const exp = await exportCollectionItem('claude', base, 'commands', 'bar')
  assert.equal(exp.fileName, 'bar.md')
  assert.ok(exp.data.toString().includes('body'))
  await fs.rm(base, { recursive: true, force: true })
})

test('collections rules use the .mdc extension', async () => {
  const base = await tmp('abyss-rules-')
  const body =
    '---\ndescription: EF Core rules\nglobs: src/**/*.cs\nalwaysApply: false\n---\n\n- Use AsNoTracking\n'
  const { path: written } = await writeCollectionItem(
    'cursor',
    base,
    'rules',
    'efcore',
    body,
  )
  assert.ok(written.endsWith(path.join('rules', 'efcore.mdc')))

  const items = await listCollection('cursor', base, 'rules')
  assert.equal(items.length, 1)
  assert.equal(items[0].id, 'efcore')
  assert.equal(items[0].globs, 'src/**/*.cs')
  assert.equal(items[0].alwaysApply, false)

  const exp = await exportCollectionItem('cursor', base, 'rules', 'efcore')
  assert.equal(exp.fileName, 'efcore.mdc')
  await fs.rm(base, { recursive: true, force: true })
})

test('collections skills scan nested category folders', async () => {
  const base = await tmp('abyss-skills-')
  // Flat skill + a skill nested under a category folder.
  await fs.mkdir(path.join(base, 'skills', 'flat'), { recursive: true })
  await fs.writeFile(
    path.join(base, 'skills', 'flat', 'SKILL.md'),
    '---\nname: flat\n---\nflat body\n',
  )
  await fs.mkdir(path.join(base, 'skills', 'dotnet', 'efcore'), {
    recursive: true,
  })
  await fs.writeFile(
    path.join(base, 'skills', 'dotnet', 'efcore', 'SKILL.md'),
    '---\nname: efcore\n---\nnested body\n',
  )
  // A support file inside a skill must NOT be mistaken for a nested skill.
  await fs.mkdir(path.join(base, 'skills', 'dotnet', 'efcore', 'scripts'), {
    recursive: true,
  })
  await fs.writeFile(
    path.join(base, 'skills', 'dotnet', 'efcore', 'scripts', 'run.sh'),
    'echo hi\n',
  )

  const ids = (await listCollection('cursor', base, 'skills'))
    .map((i) => i.id)
    .sort()
  assert.deepEqual(ids, ['dotnet/efcore', 'flat'])

  // The nested skill is addressable by its POSIX id.
  const read = await readCollectionItem(
    'cursor',
    base,
    'skills',
    'dotnet/efcore',
  )
  assert.ok(read.content.includes('nested body'))
  await fs.rm(base, { recursive: true, force: true })
})

test('gemini commands: grouped TOML list + rename', async () => {
  const base = await tmp('abyss-gcmd-')
  await writeGeminiCommand(
    base,
    'git/commit',
    'name = "git:commit"\ndescription = "Commit"\nprompt = "Do it"\n',
  )
  const list = await listGeminiCommands(base)
  assert.equal(list.length, 1)
  assert.equal(list[0].id, 'git/commit')
  assert.equal(list[0].name, 'git:commit')
  assert.equal(list[0].description, 'Commit')

  await renameGeminiCommand(base, 'git/commit', 'git/amend')
  const after = await listGeminiCommands(base)
  assert.equal(after[0].id, 'git/amend')
  assert.ok(after[0].path.endsWith(path.join('commands', 'git', 'amend.toml')))
  await fs.rm(base, { recursive: true, force: true })
})

test('flat hooks round-trip preserves sibling keys', async () => {
  const base = await tmp('abyss-fhooks-')
  // Pre-seed Gemini's hooks.json with an unrelated key Abyss must keep.
  await fs.mkdir(path.join(base, 'hooks'), { recursive: true })
  await fs.writeFile(
    path.join(base, 'hooks', 'hooks.json'),
    JSON.stringify({ note: 'keep me', hooks: [] }, null, 2),
  )

  await writeHooks('gemini', base, [
    {
      id: 'x',
      event: 'PostToolUse',
      matcher: 'write_file',
      command: 'dotnet format',
    },
    { id: 'y', event: 'Stop', matcher: '', command: 'echo done' },
  ])

  const raw = JSON.parse(
    await fs.readFile(path.join(base, 'hooks', 'hooks.json'), 'utf8'),
  )
  assert.equal(raw.note, 'keep me')
  assert.equal(raw.hooks.length, 2)
  assert.equal(raw.hooks[0].tool, 'write_file')
  assert.equal(raw.hooks[1].tool, undefined) // Stop has no matcher → no tool key

  const back = await readHooks('gemini', base)
  assert.equal(back.length, 2)
  assert.equal(back[0].matcher, 'write_file')
  assert.equal(back[1].matcher, '')
  await fs.rm(base, { recursive: true, force: true })
})

test('snapshots record + restore is reversible', async () => {
  const root = await tmp('abyss-snap-')
  configureSnapshots({ root, exclude: [] })
  const target = path.join(root, '..', `snap-target-${Date.now()}.txt`)
  await fs.writeFile(target, 'v1', 'utf8')
  await recordSnapshot(target, 'v1')
  await fs.writeFile(target, 'v2', 'utf8')
  const snaps = await listSnapshots(target)
  assert.ok(snaps.length >= 1)
  const result = await restoreSnapshot(snaps[snaps.length - 1].id)
  assert.equal(result?.path, target)
  assert.equal(await fs.readFile(target, 'utf8'), 'v1')
  await fs.rm(root, { recursive: true, force: true })
  await fs.rm(target, { force: true })
})

test('chat normalize: anthropic content → blocks', () => {
  const blocks = blocksFromAnthropicContent([
    { type: 'text', text: 'hi' },
    { type: 'tool_use', id: 't1', name: 'Bash', input: { cmd: 'ls' } },
    { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
  ])
  assert.equal(blocks.length, 3)
  assert.equal(blocks[0].kind, 'text')
  assert.equal(blocks[1].kind, 'tool_use')
  assert.equal(blocks[2].kind, 'tool_result')
})

test('frontmatter parse', () => {
  const { data, body } = parseFrontmatter(
    '---\nname: demo\ndescription: d\n---\nbody text\n',
  )
  assert.equal(data.name, 'demo')
  assert.equal(data.description, 'd')
  assert.ok(body.includes('body text'))
})

function testEnv(home: string, appData: string): OsEnv {
  return { home, appData, platform: process.platform as OsEnv['platform'] }
}

test('claude permissions round-trip preserves model/env siblings', async () => {
  const base = await tmp('abyss-perms-')
  await writeModelEnv(base, { model: 'opus', env: { FOO: 'bar' } })
  await writePermissions(base, {
    allow: ['Read(*)'],
    deny: ['Read(./.env)'],
    ask: [],
  })
  const perms = await readPermissions(base)
  assert.deepEqual(perms.allow, ['Read(*)'])
  assert.deepEqual(perms.deny, ['Read(./.env)'])
  // Writing permissions must not clobber the model/env written earlier.
  const me = await readModelEnv(base)
  assert.equal(me.model, 'opus')
  assert.deepEqual(me.env, { FOO: 'bar' })
  await fs.rm(base, { recursive: true, force: true })
})

test('bundle export → apply round-trips an instruction file', async () => {
  const src = await tmp('abyss-bundle-src-')
  const dest = await tmp('abyss-bundle-dest-')
  const env = testEnv(
    await tmp('abyss-bundle-home-'),
    await tmp('abyss-bundle-app-'),
  )
  // Cline has only an instructions surface, so export touches no MCP/perms.
  await fs.writeFile(path.join(src, 'instructions.md'), '# my rules\n', 'utf8')

  const bundle = await exportBundle(env, {
    agentIds: ['cline'],
    basePaths: { cline: src },
  })
  assert.equal(bundle.agents[0].files.instructions, '# my rules\n')

  const changes = await applyBundle(bundle, { basePaths: { cline: dest } })
  assert.ok(changes.some((c) => c.changed))
  assert.equal(
    await fs.readFile(path.join(dest, 'instructions.md'), 'utf8'),
    '# my rules\n',
  )
  for (const d of [src, dest, env.home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('redactBundleSecrets masks secret MCP env values, keeps the rest', () => {
  const bundle: ExportBundle = {
    $schema: 'abyss-bundle/v1',
    version: 1,
    exportedAt: new Date().toISOString(),
    agents: [
      {
        agentId: 'claude',
        basePath: '/home/u/.claude',
        files: {},
        mcpServers: [
          {
            id: 'gh-0',
            name: 'github',
            type: 'stdio',
            command: 'npx',
            enabled: true,
            env: {
              GITHUB_TOKEN: 'ghp_realsecret',
              BRAVE_API_KEY: 'abc123',
              NODE_ENV: 'production',
              EMPTY_SECRET_KEY: '',
            },
          },
        ],
      },
    ],
  }

  const { bundle: redacted, redactedCount } = redactBundleSecrets(bundle)
  const env = redacted.agents[0].mcpServers?.[0].env
  assert.equal(redactedCount, 2)
  assert.equal(env?.GITHUB_TOKEN, REDACTED_PLACEHOLDER)
  assert.equal(env?.BRAVE_API_KEY, REDACTED_PLACEHOLDER)
  // Non-secret keys and empty values are untouched.
  assert.equal(env?.NODE_ENV, 'production')
  assert.equal(env?.EMPTY_SECRET_KEY, '')
  // The source bundle is not mutated.
  assert.equal(
    bundle.agents[0].mcpServers?.[0].env?.GITHUB_TOKEN,
    'ghp_realsecret',
  )
})

test('profiles save → read round-trip', async () => {
  const src = await tmp('abyss-prof-src-')
  const dir = await tmp('abyss-prof-')
  const env = testEnv(
    await tmp('abyss-prof-home-'),
    await tmp('abyss-prof-app-'),
  )
  configureProfiles(dir)
  await fs.writeFile(
    path.join(src, 'instructions.md'),
    '# profile rules\n',
    'utf8',
  )
  const bundle = await exportBundle(env, {
    agentIds: ['cline'],
    basePaths: { cline: src },
  })

  const meta = await saveProfile('My Profile', bundle, { description: 'd' })
  const list = await listProfiles()
  assert.ok(list.some((p) => p.id === meta.id && p.name === 'My Profile'))
  const read = await readProfile(meta.id)
  assert.equal(read?.bundle.agents[0].files.instructions, '# profile rules\n')
  for (const d of [src, dir, env.home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('backup creates and lists a config snapshot', async () => {
  const dir = await tmp('abyss-backup-')
  const env = testEnv(
    await tmp('abyss-backup-home-'),
    await tmp('abyss-backup-app-'),
  )
  const info = await createBackup(env, dir, 3)
  assert.ok(info.name.endsWith('.json'))
  const list = await listBackups(dir)
  assert.equal(list.length, 1)
  // The backup is a valid Abyss bundle.
  const parsed = JSON.parse(await fs.readFile(info.path, 'utf8'))
  assert.equal(parsed.$schema, 'abyss-bundle/v1')
  for (const d of [dir, env.home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('sync compareSurface detects equal vs differing instructions', async () => {
  const home = await tmp('abyss-sync-home-')
  const appData = await tmp('abyss-sync-app-')
  const env = testEnv(home, appData)
  await fs.mkdir(path.join(home, '.claude'), { recursive: true })
  await fs.mkdir(path.join(home, '.codex'), { recursive: true })
  await fs.writeFile(path.join(home, '.claude', 'CLAUDE.md'), 'same\n', 'utf8')
  await fs.writeFile(path.join(home, '.codex', 'AGENTS.md'), 'same\n', 'utf8')

  const equal = await compareSurface(env, 'instructions', 'claude', 'codex')
  assert.equal(equal.equal, true)

  await fs.writeFile(
    path.join(home, '.codex', 'AGENTS.md'),
    'different\n',
    'utf8',
  )
  const diff = await compareSurface(env, 'instructions', 'claude', 'codex')
  assert.equal(diff.equal, false)
  for (const d of [home, appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('chat normalize: snippet + project label helpers', () => {
  assert.equal(
    firstTextSnippet([{ type: 'text', text: '  hello   world  ' }]),
    'hello world',
  )
  assert.equal(projectLabelFromCwd('/home/u/my-proj/'), 'my-proj')
  assert.equal(projectLabelFromCwd('C:\\\\dev\\\\thing'), 'thing')
})

// --- Chat transcript parsers ------------------------------------------------
// Drive the real parsers over synthetic JSONL fixtures laid out exactly the way
// each CLI writes them on disk, so we exercise the fragile parse paths without
// any process or network access.

/** Write a Claude transcript at ~/.claude/projects/<encodedCwd>/<id>.jsonl. */
async function seedClaudeSession(
  home: string,
  cwd: string,
  sessionId: string,
  lines: unknown[],
): Promise<void> {
  const encoded = cwd.replace(/[/\\]/g, '-')
  const dir = path.join(home, '.claude', 'projects', encoded)
  await fs.mkdir(dir, { recursive: true })
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  await fs.writeFile(path.join(dir, `${sessionId}.jsonl`), body, 'utf8')
}

test('claude parse: readClaudeSession normalizes messages, blocks and skips meta', async () => {
  const home = await tmp('abyss-claude-parse-')
  const env = testEnv(home, await tmp('abyss-claude-app-'))
  const cwd = '/home/u/proj'
  await seedClaudeSession(home, cwd, 'sess-1', [
    { type: 'summary', summary: 'Nice title' },
    {
      type: 'user',
      uuid: 'u1',
      timestamp: '2024-01-01T00:00:00.000Z',
      cwd,
      gitBranch: 'main',
      message: { role: 'user', content: 'first question' },
    },
    // isMeta lines must be ignored entirely.
    {
      type: 'user',
      uuid: 'meta',
      isMeta: true,
      message: { role: 'user', content: 'sidebar noise' },
    },
    {
      type: 'assistant',
      uuid: 'a1',
      timestamp: '2024-01-01T00:00:05.000Z',
      message: {
        role: 'assistant',
        model: 'claude-3',
        content: [
          { type: 'text', text: 'answer' },
          { type: 'tool_use', id: 't1', name: 'Bash', input: { cmd: 'ls' } },
        ],
        usage: { input_tokens: 10, output_tokens: 4 },
      },
    },
  ])

  const transcript = await readClaudeSession(env, 'sess-1')
  assert.equal(transcript.id, 'sess-1')
  assert.equal(transcript.agentId, 'claude')
  assert.equal(transcript.title, 'Nice title') // summary wins over first user text
  assert.equal(transcript.cwd, cwd)
  assert.equal(transcript.gitBranch, 'main')
  assert.equal(transcript.messageCount, 2) // meta line dropped
  assert.equal(transcript.messages[0].role, 'user')
  assert.equal(transcript.messages[1].role, 'assistant')
  assert.equal(transcript.messages[1].model, 'claude-3')
  const blocks = transcript.messages[1].blocks
  assert.equal(blocks[0].kind, 'text')
  assert.equal(blocks[1].kind, 'tool_use')

  const meta = await readSessionMeta(transcript.filePath, '')
  assert.ok(meta)
  assert.equal(meta?.title, 'Nice title')
  assert.equal(meta?.messageCount, 2)
  assert.equal(meta?.inputTokens, 10)
  assert.equal(meta?.outputTokens, 4)

  for (const d of [home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

test('claude parse: readSessionMeta returns null for a transcript with no messages', async () => {
  const home = await tmp('abyss-claude-empty-')
  const env = testEnv(home, await tmp('abyss-claude-empty-app-'))
  await seedClaudeSession(home, '/home/u/p', 'sess-empty', [
    { type: 'summary', summary: 'only a summary' },
  ])
  const files = path.join(
    home,
    '.claude',
    'projects',
    '-home-u-p',
    'sess-empty.jsonl',
  )
  const meta = await readSessionMeta(files, '')
  assert.equal(meta, null)
  for (const d of [home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

/** Write a Codex rollout at ~/.codex/sessions/<y>/<m>/<d>/<id>.jsonl. */
async function seedCodexSession(
  home: string,
  sessionId: string,
  lines: unknown[],
): Promise<void> {
  const dir = path.join(home, '.codex', 'sessions', '2024', '01', '02')
  await fs.mkdir(dir, { recursive: true })
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  await fs.writeFile(path.join(dir, `${sessionId}.jsonl`), body, 'utf8')
}

test('codex parse: readCodexSession handles payload-wrapped + plain message shapes', async () => {
  const home = await tmp('abyss-codex-parse-')
  const env = testEnv(home, await tmp('abyss-codex-app-'))
  await seedCodexSession(home, 'rollout-abc', [
    // cwd lives on a payload wrapper here.
    { type: 'session_meta', payload: { cwd: '/work/repo' } },
    // payload-wrapped user message with array content.
    {
      timestamp: '2024-01-02T10:00:00Z',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'text', text: 'hello   codex' }],
      },
    },
    // a non-message item that must be skipped.
    { payload: { type: 'reasoning', text: 'ignored' } },
    // plain assistant message with string content.
    {
      ts: '2024-01-02T10:00:03Z',
      type: 'message',
      role: 'assistant',
      content: 'sure thing',
    },
  ])

  const transcript = await readCodexSession(env, 'rollout-abc')
  assert.equal(transcript.id, 'rollout-abc')
  assert.equal(transcript.agentId, 'codex')
  assert.equal(transcript.cwd, '/work/repo')
  assert.equal(transcript.messageCount, 2)
  assert.equal(transcript.messages[0].role, 'user')
  assert.equal(transcript.messages[0].blocks[0].kind, 'text')
  assert.equal(transcript.messages[1].role, 'assistant')
  assert.equal(transcript.title, 'hello codex') // first user text, whitespace-collapsed

  const meta = await readCodexMeta(transcript.filePath)
  assert.ok(meta)
  assert.equal(meta?.messageCount, 2)
  assert.equal(meta?.cwd, '/work/repo')
  assert.equal(meta?.title, 'hello codex')

  for (const d of [home, env.appData])
    await fs.rm(d, { recursive: true, force: true })
})

// --- Permission rule / glob preview (renderer lib, pure string matching) -----

test('permissions glob: parseRule + isValidRule', () => {
  assert.deepEqual(parseRule('Read(./.env)'), {
    tool: 'Read',
    specifier: './.env',
  })
  assert.deepEqual(parseRule('Bash'), { tool: 'Bash', specifier: null })
  assert.equal(isValidRule('Read(*)'), true)
  assert.equal(isValidRule('mcp__github__search'), true)
  assert.equal(isValidRule('mcp__github'), true)
  assert.equal(isValidRule('1bad'), false)
})

test('permissions glob: globToRegExp respects *, ** and ?', () => {
  // single star does not cross a path separator
  assert.equal(globToRegExp('*.ts').test('index.ts'), true)
  assert.equal(globToRegExp('*.ts').test('src/index.ts'), false)
  // double star crosses separators
  assert.equal(globToRegExp('**/*.ts').test('src/app/index.ts'), true)
  // ? matches exactly one non-separator char
  assert.equal(globToRegExp('?.env').test('a.env'), true)
  assert.equal(globToRegExp('?.env').test('ab.env'), false)
})

test('permissions glob: previewSpecifier classifies path / command / tool', () => {
  const pathPreview = previewSpecifier('Read', '.env*')
  assert.equal(pathPreview.kind, 'path')
  assert.equal(pathPreview.valid, true)
  assert.ok(pathPreview.matches.includes('.env'))
  assert.ok(pathPreview.matches.includes('.env.local'))
  assert.ok(!pathPreview.matches.includes('src/index.ts'))

  const cmd = previewSpecifier('Bash', 'git status:*')
  assert.equal(cmd.kind, 'command')
  assert.ok(cmd.note.includes('git status'))

  const bare = previewSpecifier('Edit', '')
  assert.equal(bare.kind, 'tool')
  assert.ok(bare.note.includes('Edit'))
})

// --- Discovery: official MCP registry provider ------------------------------
// The provider's only public surface is `search`, which calls global `fetch`.
// The mapping/normalization helpers (toResult/buildStdio/dedupeLatest) are
// module-private, so we exercise them through `search` with a stubbed `fetch` —
// fully deterministic and offline (no real network call).

interface FetchStub {
  status: number
  json: unknown
}

async function withStubbedFetch<T>(
  stub: FetchStub | Error,
  run: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    if (stub instanceof Error) throw stub
    return {
      ok: stub.status >= 200 && stub.status < 300,
      status: stub.status,
      json: async () => stub.json,
    } as Response
  }) as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

test('discovery mcp: maps an npm stdio package to an npx install spec', async () => {
  const res = await withStubbedFetch(
    {
      status: 200,
      json: {
        servers: [
          {
            server: {
              name: 'com.acme/Slack',
              description: '  Slack server  ',
              version: '1.2.0',
              repository: { url: 'https://example.com/repo' },
              packages: [
                {
                  registryType: 'npm',
                  identifier: '@acme/slack-mcp',
                  transport: { type: 'stdio' },
                  packageArguments: [{ type: 'positional', value: '--flag' }],
                  environmentVariables: [
                    { name: 'SLACK_TOKEN', isRequired: true },
                    { name: 'OPTIONAL', value: 'def' },
                  ],
                },
              ],
            },
            _meta: {
              'io.modelcontextprotocol.registry/official': { isLatest: true },
            },
          },
        ],
      },
    },
    () =>
      mcpOfficialProvider.search(
        { kind: 'mcp', sourceId: 'mcp-official', query: 'slack' },
        undefined,
      ),
  )

  assert.equal(res.error, undefined)
  assert.equal(res.results.length, 1)
  const r = res.results[0]
  assert.equal(r.name, 'slack') // reverse-DNS tail, slugified + lowercased
  assert.equal(r.description, 'Slack server') // trimmed
  assert.equal(r.installable, true)
  const spec = r.payload as McpInstallSpec
  assert.equal(spec.transport, 'stdio')
  assert.equal(spec.command, 'npx')
  // npx gets a leading -y, then identifier, then package args.
  assert.deepEqual(spec.args, ['-y', '@acme/slack-mcp', '--flag'])
  assert.deepEqual(
    spec.env.map((e) => e.name),
    ['SLACK_TOKEN', 'OPTIONAL'],
  )
  // Required env surfaces as a warning badge.
  assert.ok(
    r.badges?.some((b) => b.label === 'SLACK_TOKEN' && b.variant === 'warning'),
  )
})

test('discovery mcp: dedupes by name preferring isLatest, falls back to remote', async () => {
  const res = await withStubbedFetch(
    {
      status: 200,
      json: {
        servers: [
          {
            server: { name: 'com.acme/dup', version: '1.0.0', remotes: [] },
            _meta: {
              'io.modelcontextprotocol.registry/official': { isLatest: false },
            },
          },
          {
            server: {
              name: 'com.acme/dup',
              version: '2.0.0',
              remotes: [{ type: 'sse', url: 'https://acme.test/sse' }],
            },
            _meta: {
              'io.modelcontextprotocol.registry/official': { isLatest: true },
            },
          },
        ],
        metadata: { nextCursor: 'next' },
      },
    },
    () =>
      mcpOfficialProvider.search(
        { kind: 'mcp', sourceId: 'mcp-official', query: '' },
        undefined,
      ),
  )

  assert.equal(res.results.length, 1) // de-duplicated by name
  assert.equal(res.nextCursor, 'next')
  const r = res.results[0]
  assert.equal(r.id, 'com.acme/dup@2.0.0') // the isLatest one won
  const spec = r.payload as McpInstallSpec
  assert.equal(spec.transport, 'sse')
  assert.equal(spec.url, 'https://acme.test/sse')
})

test('discovery mcp: surfaces HTTP errors and network failures without throwing', async () => {
  const httpErr = await withStubbedFetch({ status: 503, json: {} }, () =>
    mcpOfficialProvider.search(
      { kind: 'mcp', sourceId: 'mcp-official', query: 'x' },
      undefined,
    ),
  )
  assert.deepEqual(httpErr.results, [])
  assert.ok(httpErr.error?.includes('503'))

  const netErr = await withStubbedFetch(new Error('boom'), () =>
    mcpOfficialProvider.search(
      { kind: 'mcp', sourceId: 'mcp-official', query: 'x' },
      undefined,
    ),
  )
  assert.deepEqual(netErr.results, [])
  assert.ok(netErr.error && netErr.error.length > 0)
})

test('path-scope: well-formedness rejects empty / NUL-byte paths', () => {
  assert.equal(isWellFormedPath('/home/u/.claude'), true)
  assert.equal(isWellFormedPath(''), false)
  assert.equal(isWellFormedPath('/home/u/\0evil'), false)
})

test('path-scope: isInsideRoot confines to a root and blocks traversal', () => {
  const root = path.resolve('/home/user/.config')
  assert.equal(isInsideRoot(path.join(root, 'agent', 'x.json'), root), true)
  assert.equal(isInsideRoot(root, root), true)
  // `../` escape resolves outside the root.
  assert.equal(isInsideRoot(path.join(root, '..', '..', 'etc'), root), false)
  // Sibling that shares a prefix is not inside.
  assert.equal(isInsideRoot('/home/user/.config-evil', root), false)
})

test('path-scope: resolveScopedPath allows roots, rejects escapes', () => {
  const env: OsEnv = {
    home: path.resolve('/home/user'),
    appData: path.resolve('/home/user/.config'),
    platform: 'linux',
  }
  const userData = path.resolve('/home/user/.config/Abyss')

  // Inside home (an agent config dir) is allowed.
  assert.equal(
    resolveScopedPath(
      path.join(env.home, '.claude', 'settings.json'),
      env,
      userData,
    ),
    path.join(env.home, '.claude', 'settings.json'),
  )
  // userData itself is allowed.
  assert.equal(resolveScopedPath(userData, env, userData), userData)
  // A path well outside any root is rejected.
  assert.equal(resolveScopedPath('/etc/passwd', env, userData), null)
  // A traversal that climbs out of home is rejected.
  assert.equal(
    resolveScopedPath(
      path.join(env.home, '..', '..', 'etc', 'passwd'),
      env,
      userData,
    ),
    null,
  )
  // Malformed input is rejected.
  assert.equal(resolveScopedPath('', env, userData), null)
})

test('path-scope: assertScopedPath returns in-scope paths, throws on escape', () => {
  const env: OsEnv = {
    home: path.resolve('/home/user'),
    appData: path.resolve('/home/user/.config'),
    platform: 'linux',
  }
  const userData = path.resolve('/home/user/.config/Abyss')
  const inScope = path.join(env.home, '.claude', 'settings.json')

  // In-scope path is returned (resolved) unchanged.
  assert.equal(assertScopedPath(inScope, env, userData), inScope)

  // Escapes throw a typed PathScopeError carrying the offending path + code.
  assert.throws(
    () => assertScopedPath('/etc/passwd', env, userData),
    (err: unknown) => {
      if (!(err instanceof PathScopeError)) return false
      assert.equal(err.code, 'PATH_OUT_OF_SCOPE')
      assert.equal(err.filePath, '/etc/passwd')
      return true
    },
  )
})
