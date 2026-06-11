/**
 * Multi-repo workspace scanner. Node-only.
 *
 * Given a root directory (e.g. `~/code`), it inspects the root itself and each
 * immediate sub-folder, looking for the well-known project-level instruction /
 * rules files of every supported agent. The result is a cross-repo map of where
 * your AI config actually lives — the gap a single "active project" view can't
 * cover.
 *
 * Deliberately shallow (one level deep) and bounded: this is an at-a-glance
 * overview, not a recursive crawl. The path it scans is validated against
 * Abyss's allowed roots by the caller (see `workspace.ipc.ts`).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  WorkspaceConfigFind,
  WorkspaceRepo,
  WorkspaceScanResult,
} from '@/shared/types/workspace'

/** A well-known project-level config marker for one agent. */
interface ProjectMarker {
  agentId: string
  /** Shown in the UI, e.g. "Instructions (CLAUDE.md)". */
  label: string
  /** Repo-relative path of the file or directory to probe. */
  rel: string
}

/**
 * The project-scoped on-disk markers we look for, per agent. Each marker maps
 * to exactly one agent so grouping/icons stay unambiguous; `AGENTS.md` is the
 * cross-agent standard, attributed once and labelled as shared.
 */
const PROJECT_MARKERS: ProjectMarker[] = [
  { agentId: 'claude', label: 'Instructions (CLAUDE.md)', rel: 'CLAUDE.md' },
  { agentId: 'claude', label: 'Local instructions (CLAUDE.local.md)', rel: 'CLAUDE.local.md' },
  { agentId: 'claude', label: 'Project config (.claude/)', rel: '.claude' },
  { agentId: 'codex', label: 'Shared instructions (AGENTS.md)', rel: 'AGENTS.md' },
  { agentId: 'gemini', label: 'Instructions (GEMINI.md)', rel: 'GEMINI.md' },
  { agentId: 'gemini', label: 'Project config (.gemini/)', rel: '.gemini' },
  { agentId: 'cursor', label: 'Rules (.cursor/rules/)', rel: '.cursor/rules' },
  { agentId: 'cursor', label: 'Legacy rules (.cursorrules)', rel: '.cursorrules' },
  {
    agentId: 'copilot',
    label: 'Instructions (.github/copilot-instructions.md)',
    rel: '.github/copilot-instructions.md',
  },
  { agentId: 'windsurf', label: 'Rules (.windsurf/rules/)', rel: '.windsurf/rules' },
  { agentId: 'windsurf', label: 'Legacy rules (.windsurfrules)', rel: '.windsurfrules' },
  { agentId: 'cline', label: 'Rules (.clinerules)', rel: '.clinerules' },
  { agentId: 'continue', label: 'Project config (.continue/)', rel: '.continue' },
  { agentId: 'continue', label: 'Rules (.continuerules)', rel: '.continuerules' },
  { agentId: 'aider', label: 'Conventions (CONVENTIONS.md)', rel: 'CONVENTIONS.md' },
  { agentId: 'aider', label: 'Config (.aider.conf.yml)', rel: '.aider.conf.yml' },
]

/** Folder names never worth treating as a repo candidate. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.cache',
  'target',
  'vendor',
  'coverage',
])

/** Hard cap on candidate folders, so a pathological root can't hang the scan. */
const MAX_CANDIDATES = 500

/** Probe one marker in one folder; returns a find when it exists on disk. */
async function probe(
  dir: string,
  marker: ProjectMarker,
): Promise<WorkspaceConfigFind | null> {
  const absPath = path.join(dir, marker.rel)
  try {
    const st = await fs.stat(absPath)
    return {
      agentId: marker.agentId,
      label: marker.label,
      relPath: marker.rel,
      absPath,
      isDir: st.isDirectory(),
      bytes: st.isDirectory() ? 0 : st.size,
    }
  } catch {
    return null // not present (ENOENT) or unreadable — simply not a find
  }
}

/** Inspect one candidate folder for git + agent config markers. */
async function inspect(dir: string, name: string): Promise<WorkspaceRepo> {
  const isGitRepo = await fs
    .stat(path.join(dir, '.git'))
    .then(() => true)
    .catch(() => false)

  const found = await Promise.all(PROJECT_MARKERS.map((m) => probe(dir, m)))
  const finds = found
    .filter((f): f is WorkspaceConfigFind => f !== null)
    .sort(
      (a, b) =>
        a.agentId.localeCompare(b.agentId) || a.relPath.localeCompare(b.relPath),
    )

  return { name, path: dir, isGitRepo, finds }
}

/**
 * Scan `root` (assumed already resolved + in-scope) and its immediate
 * sub-folders for agent config files. Returns only folders with at least one
 * find, git repos first, then alphabetical.
 */
export async function scanWorkspace(root: string): Promise<WorkspaceScanResult> {
  const absRoot = path.resolve(root)

  // Candidates: the root itself plus its immediate sub-directories.
  const candidates: { dir: string; name: string }[] = [
    { dir: absRoot, name: path.basename(absRoot) || absRoot },
  ]
  const entries = await fs
    .readdir(absRoot, { withFileTypes: true })
    .catch(() => [])
  for (const entry of entries) {
    if (candidates.length >= MAX_CANDIDATES) break
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    if (SKIP_DIRS.has(entry.name)) continue
    candidates.push({ dir: path.join(absRoot, entry.name), name: entry.name })
  }

  const inspected = await Promise.all(
    candidates.map((c) => inspect(c.dir, c.name)),
  )
  const repos = inspected
    .filter((r) => r.finds.length > 0)
    .sort(
      (a, b) =>
        Number(b.isGitRepo) - Number(a.isGitRepo) ||
        a.name.localeCompare(b.name),
    )

  return { root: absRoot, repos, scannedCount: candidates.length }
}
