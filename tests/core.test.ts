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
import { blocksFromAnthropicContent } from '@core/chat/normalize'
import { parseFrontmatter } from '@core/frontmatter'
import type { McpServerEntry } from '@/shared/types/config'

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

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
  const read = await readCollectionItem('cursor', base, 'skills', 'dotnet/efcore')
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
