import type { PermissionRules } from '@/shared/types/config'

/**
 * Permission presets — quick starting points so users don't hand-type every
 * rule. Security presets define a whole posture (replace all three columns);
 * topic presets add a themed set of rules for a domain (merge into existing).
 */
export interface PermissionPreset {
  id: string
  label: string
  description: string
  icon: string
  rules: PermissionRules
}

const empty = (): PermissionRules => ({ allow: [], deny: [], ask: [] })

/** Whole-posture presets — applying one replaces the current rules. */
export const SECURITY_PRESETS: PermissionPreset[] = [
  {
    id: 'paranoid',
    label: 'Paranoid',
    description: 'Everything except Read needs approval. Secrets are denied.',
    icon: 'lock',
    rules: {
      allow: ['Read(./**)'],
      ask: ['Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch'],
      deny: ['Read(./.env)', 'Read(./.env.*)', 'Read(./.git/**)'],
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Local tests run freely; destructive commands ask first.',
    icon: 'shield-check',
    rules: {
      allow: [
        'Read(./**)',
        'Edit',
        'Write',
        'Bash(npm run test:*)',
        'Bash(npm test:*)',
        'Bash(git status:*)',
        'Bash(git diff:*)',
      ],
      ask: [
        'Bash(rm:*)',
        'Bash(git push:*)',
        'Bash(git commit:*)',
        'Bash(sudo:*)',
      ],
      deny: ['Read(./.env)', 'Read(./.env.*)'],
    },
  },
  {
    id: 'yolo',
    label: 'YOLO',
    description: 'Allow everything, no prompts. Use with care.',
    icon: 'zap',
    rules: {
      allow: ['Bash', 'Edit', 'Write', 'Read', 'WebFetch', 'WebSearch', 'Glob', 'Grep'],
      ask: [],
      deny: [],
    },
  },
]

/** Domain presets — applying one merges its rules into the current set. */
export const TOPIC_PRESETS: PermissionPreset[] = [
  {
    id: 'csharp',
    label: 'C# / .NET',
    description: 'dotnet build/test/run and edits to .cs files.',
    icon: 'braces',
    rules: {
      allow: [
        'Bash(dotnet build:*)',
        'Bash(dotnet test:*)',
        'Bash(dotnet run:*)',
        'Edit(**/*.cs)',
      ],
      ask: [],
      deny: [],
    },
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Read/write markdown docs.',
    icon: 'file-text',
    rules: {
      allow: ['Read(**/*.md)', 'Edit(**/*.md)', 'Write(**/*.md)'],
      ask: [],
      deny: [],
    },
  },
  {
    id: 'git',
    label: 'Git',
    description: 'Read-only git is free; history-rewriting commands ask.',
    icon: 'git-branch',
    rules: {
      allow: [
        'Bash(git status:*)',
        'Bash(git diff:*)',
        'Bash(git log:*)',
        'Bash(git add:*)',
      ],
      ask: ['Bash(git push:*)', 'Bash(git commit:*)', 'Bash(git reset:*)'],
      deny: [],
    },
  },
  {
    id: 'shell',
    label: 'Shell',
    description: 'Common read-only shell tools; mutating ones ask.',
    icon: 'terminal',
    rules: {
      allow: [
        'Bash(ls:*)',
        'Bash(cat:*)',
        'Bash(grep:*)',
        'Bash(find:*)',
      ],
      ask: ['Bash(rm:*)', 'Bash(mv:*)', 'Bash(chmod:*)'],
      deny: [],
    },
  },
  {
    id: 'system',
    label: 'System',
    description: 'Privileged/system commands ask or are blocked.',
    icon: 'cpu',
    rules: {
      allow: [],
      ask: ['Bash(sudo:*)', 'Bash(systemctl:*)', 'Bash(apt:*)'],
      deny: ['Bash(shutdown:*)', 'Bash(reboot:*)', 'Bash(mkfs:*)'],
    },
  },
]

/** Merge two rule sets, de-duplicating within each column. Keeps the base's
 * mode and additional directories (presets only define the three columns). */
export function mergeRules(
  base: PermissionRules,
  add: PermissionRules,
): PermissionRules {
  const uniq = (xs: string[]): string[] => Array.from(new Set(xs))
  const merged = empty()
  merged.allow = uniq([...base.allow, ...add.allow])
  merged.ask = uniq([...base.ask, ...add.ask])
  merged.deny = uniq([...base.deny, ...add.deny])
  merged.defaultMode = base.defaultMode
  merged.additionalDirectories = base.additionalDirectories
  return merged
}
