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
  renameCollectionItem,
  duplicateCollectionItem,
  exportCollectionItem,
  listCollection,
} from '@core/collections'
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
    base,
    'commands',
    'foo',
    '---\nname: foo\n---\nbody\n',
  )
  await renameCollectionItem(base, 'commands', 'foo', 'bar')
  await duplicateCollectionItem(base, 'commands', 'bar', 'bar-copy')
  const ids = (await listCollection(base, 'commands')).map((i) => i.id).sort()
  assert.deepEqual(ids, ['bar', 'bar-copy'])
  const exp = await exportCollectionItem(base, 'commands', 'bar')
  assert.equal(exp.fileName, 'bar.md')
  assert.ok(exp.data.toString().includes('body'))
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
