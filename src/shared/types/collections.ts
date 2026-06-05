/**
 * Markdown "collections" shared by Claude Code: subagents, slash commands and
 * skills. They all live as markdown files (skills under a per-skill folder) with
 * YAML frontmatter, so one mechanism powers all three.
 */

export type CollectionKind = 'agents' | 'commands' | 'skills'

export interface CollectionItem {
  /** Filename without extension (agents/commands) or folder name (skills). */
  id: string
  /** Frontmatter `name`, falling back to the id. */
  name: string
  /** Frontmatter `description`. */
  description: string
  /** Frontmatter `model`, if present (agents). */
  model?: string
  /** Frontmatter `tools`, if present (agents). */
  tools?: string
  /** Absolute path of the underlying file. */
  path: string
}

/** How to react when an imported skill's folder name already exists on disk. */
export type SkillCollisionMode = 'fail' | 'suffix'

/**
 * Result of importing a downloaded `.skill` archive. `imported` means files were
 * written; `collision` means a same-named skill already exists and the caller
 * must confirm before re-importing with {@link SkillCollisionMode} `'suffix'`.
 */
export type SkillImportResult =
  | { status: 'imported'; id: string; name: string; path: string }
  | { status: 'collision'; existingId: string; suggestedId: string }

export const COLLECTION_LABELS: Record<
  CollectionKind,
  { singular: string; plural: string }
> = {
  agents: { singular: 'Agent', plural: 'Agents' },
  commands: { singular: 'Command', plural: 'Commands' },
  skills: { singular: 'Skill', plural: 'Skills' },
}
