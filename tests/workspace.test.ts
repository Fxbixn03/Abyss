/**
 * Multi-repo workspace scanner tests (node:test). Builds a throwaway folder
 * tree in the OS temp dir and asserts the cross-repo config discovery.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { scanWorkspace } from '@core/workspace-scan'

/** Create `<root>/<rel>` (a file) and any parent dirs. */
async function writeFile(root: string, rel: string, body = ''): Promise<void> {
  const abs = path.join(root, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, body)
}

test('scanWorkspace discovers agent config across repos', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-ws-'))
  try {
    // repo-a: a git repo with Claude + Cursor config.
    await fs.mkdir(path.join(root, 'repo-a', '.git'), { recursive: true })
    await writeFile(root, 'repo-a/CLAUDE.md', '# hello')
    await fs.mkdir(path.join(root, 'repo-a', '.cursor', 'rules'), {
      recursive: true,
    })

    // repo-b: a plain folder (no git) with shared AGENTS.md + copilot.
    await writeFile(root, 'repo-b/AGENTS.md', 'agents')
    await writeFile(root, 'repo-b/.github/copilot-instructions.md', 'copilot')

    // repo-c: nothing relevant — must be excluded from results.
    await writeFile(root, 'repo-c/index.js', 'noop')

    // node_modules: must be skipped entirely even though it has a marker.
    await writeFile(root, 'node_modules/pkg/CLAUDE.md', 'should be skipped')

    const res = await scanWorkspace(root)

    assert.equal(res.repos.length, 2)
    assert.ok(!res.repos.some((r) => r.name === 'repo-c'))
    assert.ok(!res.repos.some((r) => r.name === 'node_modules'))

    // Git repos sort before plain folders.
    assert.equal(res.repos[0].name, 'repo-a')
    assert.ok(res.repos[0].isGitRepo)

    const a = res.repos[0]
    assert.ok(
      a.finds.some((f) => f.relPath === 'CLAUDE.md' && f.agentId === 'claude'),
    )
    const cursorDir = a.finds.find((f) => f.relPath === '.cursor/rules')
    assert.ok(cursorDir && cursorDir.isDir && cursorDir.agentId === 'cursor')

    const b = res.repos.find((r) => r.name === 'repo-b')
    assert.ok(b && !b.isGitRepo)
    assert.ok(b.finds.some((f) => f.agentId === 'copilot'))
    assert.ok(b.finds.some((f) => f.relPath === 'AGENTS.md'))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scanWorkspace also detects config in the root folder itself', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-ws-'))
  try {
    await writeFile(root, 'GEMINI.md', '# gemini')
    const res = await scanWorkspace(root)
    const self = res.repos.find((r) => r.path === path.resolve(root))
    assert.ok(self)
    assert.ok(self.finds.some((f) => f.agentId === 'gemini'))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
