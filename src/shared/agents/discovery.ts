/**
 * Discovered-agent payload + conversion into a local subagent markdown file.
 * Pure (no Node): the core providers produce a {@link DiscoveredAgentSpec} as a
 * discovery result's payload; the renderer turns a chosen one into a subagent
 * file (frontmatter + body) saved in the `agents` collection.
 *
 * Note: these are *external* AI agents (A2A services, directory listings), not
 * Abyss's own coding agents. Saving one creates a local subagent stub the user
 * can flesh out — a place to keep what the agent does and how to reach it.
 */

export interface DiscoveredAgentSpec {
  name: string
  description: string
  /** Primary endpoint (A2A) or product website. */
  url?: string
  homepage?: string
  documentationUrl?: string
  provider?: string
  category?: string
  skills?: string[]
  /** Origin registry, e.g. 'a2a' | 'directory'. */
  source: string
}

/**
 * Collapse external text into one line that is safe as an *unquoted* YAML
 * frontmatter scalar — so it stays valid for real YAML parsers (the coding
 * agent reads these files) while displaying cleanly in Abyss's reader.
 * Neutralizes plain-scalar breakers: `: ` (mapping), ` #` (comment), and a
 * leading indicator character.
 */
function frontmatterScalar(text: string, max = 200): string {
  let s = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/:\s/g, ' — ')
    .replace(/\s#/g, ' ')
    .replace(/^[-?:,[\]{}#&*!|>'"%@`]+\s*/, '')
    .trim()
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`
  return s || 'agent'
}

/** kebab-case slug suitable for a collection item id / filename. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'agent'
}

function uniqueId(base: string, existingIds: string[]): string {
  let id = base
  let i = 1
  while (existingIds.includes(id)) id = `${base}-${++i}`
  return id
}

/** Build a subagent markdown file (id + content) from a discovered agent. */
export function agentSpecToSubagent(
  spec: DiscoveredAgentSpec,
  existingIds: string[],
): { id: string; content: string } {
  const id = uniqueId(slugify(spec.name), existingIds)

  const front = [
    '---',
    `name: ${frontmatterScalar(spec.name, 80)}`,
    `description: ${frontmatterScalar(spec.description || spec.name)}`,
    'model: sonnet',
    '---',
    '',
  ]

  const refs: string[] = []
  if (spec.url) refs.push(`- Endpoint: ${spec.url}`)
  if (spec.homepage) refs.push(`- Homepage: ${spec.homepage}`)
  if (spec.documentationUrl) refs.push(`- Docs: ${spec.documentationUrl}`)
  if (spec.provider) refs.push(`- Provider: ${spec.provider}`)
  if (spec.category) refs.push(`- Category: ${spec.category}`)
  if (spec.skills?.length) refs.push(`- Skills: ${spec.skills.join(', ')}`)

  const body = [
    `${spec.name} — discovered via the ${spec.source} registry.`,
    '',
    spec.description || '',
    ...(refs.length ? ['', '## Reference', ...refs] : []),
    '',
    "Describe when the main agent should delegate to this agent, and how it should be used.",
    '',
  ]

  return { id, content: front.join('\n') + body.join('\n') }
}
