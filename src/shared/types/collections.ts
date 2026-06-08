/**
 * Markdown "collections" shared by AI agents: subagents, slash commands, skills
 * and Cursor's always-on `rules`. They all live as files with YAML frontmatter
 * (skills under a per-skill folder; rules use the `.mdc` extension), so one
 * mechanism powers them all.
 */

export type CollectionKind = 'agents' | 'commands' | 'skills' | 'rules'

export interface CollectionItem {
  /**
   * Filename without extension (agents/commands/rules) or folder POSIX path for
   * skills (e.g. `dotnet/efcore-patterns` when nested under a category).
   */
  id: string
  /** Frontmatter `name`, falling back to the id. */
  name: string
  /** Frontmatter `description`. */
  description: string
  /** Frontmatter `model`, if present (agents). */
  model?: string
  /** Frontmatter `tools`, if present (agents). */
  tools?: string
  /** Frontmatter `globs`, if present (rules). */
  globs?: string
  /** Frontmatter `alwaysApply`, if present (rules). */
  alwaysApply?: boolean
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
  rules: { singular: 'Rule', plural: 'Rules' },
}
