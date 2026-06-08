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
import {
  configureProfiles,
  saveProfile,
  listProfiles,
  readProfile,
} from '@core/profiles'
import { createBackup, listBackups } from '@core/backup'
import { compareSurface } from '@core/sync'
import {
  isWellFormedPath,
  isInsideRoot,
  resolveScopedPath,
} from '@core/path-scope'
import type { McpServerEntry } from '@/shared/types/config'
import type { OsEnv } from '@/shared/types/agent'

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
