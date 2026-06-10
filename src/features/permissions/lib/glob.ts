/**
 * Permission-rule parsing and glob preview.
 *
 * A rule is `Tool`, `Tool(specifier)`, or an MCP tool `mcp__server__tool`. For
 * file tools the specifier is a glob path; for Bash it's a command prefix. The
 * preview matches a glob against a small representative corpus so the user gets
 * instant "this would match …" feedback without touching the real filesystem.
 */

export interface ParsedRule {
  tool: string
  specifier: string | null
}

/** Splits a rule into its tool and optional specifier. */
export function parseRule(rule: string): ParsedRule {
  const m = rule.trim().match(/^([A-Za-z_][\w-]*)\((.*)\)$/)
  if (m) return { tool: m[1], specifier: m[2] }
  return { tool: rule.trim(), specifier: null }
}

/** A rule is valid if it's a bare/parametrised tool or an MCP tool id. */
export function isValidRule(rule: string): boolean {
  const trimmed = rule.trim()
  return (
    /^[A-Za-z_][\w]*(\(.*\))?$/.test(trimmed) ||
    /^mcp__[\w-]+(__[\w-]+)?$/.test(trimmed)
  )
}

/** File tools whose specifier is a glob path (vs. a command prefix). */
export const PATH_TOOLS = new Set([
  'Read',
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
  'Glob',
  'Grep',
])

/** Compiles a glob (`*`, `**`, `?`) into an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i += 1
      } else {
        re += '[^/]*'
      }
      continue
    }
    if (c === '?') {
      re += '[^/]'
      continue
    }
    if ('.+^${}()|[]\\/'.includes(c)) {
      re += `\\${c}`
      continue
    }
    re += c
  }
  return new RegExp(`^${re}$`)
}

/** Representative project paths used to illustrate what a glob would match. */
export const SAMPLE_PATHS = [
  '.env',
  '.env.local',
  'production.env',
  '.env.production',
  'src/index.ts',
  'src/app/main.tsx',
  'README.md',
  'docs/guide.md',
  'package.json',
  '.git/config',
  '.git/HEAD',
  'secrets/key.pem',
  'secrets/token.txt',
  'config/database.yml',
  'test/unit.test.ts',
  'node_modules/lib/index.js',
]

export interface RulePreview {
  /** Human-readable summary of what the specifier targets. */
  kind: 'path' | 'command' | 'tool'
  /** Sample paths the glob would match (only for path specifiers). */
  matches: string[]
  /** Whether the rule parses cleanly. */
  valid: boolean
  /** A one-line explanation. */
  note: string
}

/** Builds a live preview for a tool + specifier as the user types. */
export function previewSpecifier(tool: string, specifier: string): RulePreview {
  const spec = specifier.trim()
  const rule = spec ? `${tool}(${spec})` : tool
  const valid = isValidRule(rule)

  if (!spec) {
    return {
      kind: 'tool',
      matches: [],
      valid,
      note: `Applies to every ${tool} call.`,
    }
  }

  if (tool === 'Bash') {
    const prefix = spec.replace(/:\*$/, '').trim()
    return {
      kind: 'command',
      matches: [],
      valid,
      note: spec.endsWith(':*')
        ? `Matches any command starting with “${prefix}”.`
        : `Matches the exact command “${prefix}”.`,
    }
  }

  if (PATH_TOOLS.has(tool)) {
    const glob = spec.replace(/^\.\//, '')
    let re: RegExp
    try {
      re = globToRegExp(glob)
    } catch {
      return { kind: 'path', matches: [], valid: false, note: 'Invalid pattern.' }
    }
    const matches = SAMPLE_PATHS.filter((p) => re.test(p))
    return {
      kind: 'path',
      matches,
      valid,
      note: matches.length
        ? `Matches: ${matches.join(', ')}`
        : 'No sample paths match — double-check the pattern.',
    }
  }

  return { kind: 'tool', matches: [], valid, note: `Specifier: ${spec}` }
}
