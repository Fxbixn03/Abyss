/**
 * Multi-repo workspace discovery — pure types shared by `core/` (the scanner)
 * and the renderer (the Workspace page). No Node, no React.
 *
 * The scanner walks one level under a chosen root, looks for the well-known
 * project-level instruction / rules files of every supported agent, and reports
 * which repos carry which agent config — a cross-repo overview of where your AI
 * setup actually lives.
 */

/** One detected agent config / instruction file (or directory) inside a repo. */
export interface WorkspaceConfigFind {
  /** Agent the marker belongs to (drives icon + grouping). */
  agentId: string
  /** Human label for the marker, e.g. "Instructions (CLAUDE.md)". */
  label: string
  /** Path relative to the repo root, e.g. `.cursor/rules`. */
  relPath: string
  /** Absolute path on disk. */
  absPath: string
  /** True when the marker is a directory (e.g. `.cursor/rules/`). */
  isDir: boolean
  /** File size in bytes (0 for directories). */
  bytes: number
}

/** A repository (or plain folder) discovered under the scanned root. */
export interface WorkspaceRepo {
  /** Folder name. */
  name: string
  /** Absolute path. */
  path: string
  /** True when the folder contains a `.git` entry. */
  isGitRepo: boolean
  /** Detected agent config files, sorted by agent then path. */
  finds: WorkspaceConfigFind[]
}

/** Result of scanning a root directory for agent config across its repos. */
export interface WorkspaceScanResult {
  /** The absolute root that was scanned. */
  root: string
  /** Repos / folders that carry at least one detected config file. */
  repos: WorkspaceRepo[]
  /** How many candidate folders were inspected (incl. ones with no match). */
  scannedCount: number
  /** True when the root fell outside Abyss's allowed directories. */
  outOfScope?: boolean
}
