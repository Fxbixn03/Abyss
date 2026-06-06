/**
 * Curated catalog of well-known MCP servers for one-click install. Pure data —
 * the MCP page turns a chosen entry into a prefilled {@link McpServerEntry}.
 *
 * `envKeys` lists environment variables the user must fill in (e.g. API tokens);
 * they are added empty so the form prompts for them.
 */

export interface McpCatalogEntry {
  id: string
  name: string
  description: string
  homepage?: string
  command: string
  args: string[]
  /** Env vars the user needs to provide (added as empty keys). */
  envKeys?: string[]
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  {
    id: 'filesystem',
    name: 'filesystem',
    description: 'Read/write access to a directory you allow.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
  },
  {
    id: 'git',
    name: 'git',
    description: 'Inspect and operate on a local Git repository.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
  },
  {
    id: 'github',
    name: 'github',
    description: 'GitHub repos, issues and PRs via the GitHub API.',
    homepage: 'https://github.com/github/github-mcp-server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envKeys: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
  },
  {
    id: 'fetch',
    name: 'fetch',
    description: 'Fetch a URL and convert it to clean markdown.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  },
  {
    id: 'memory',
    name: 'memory',
    description: 'A persistent knowledge-graph memory for the agent.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    id: 'sequential-thinking',
    name: 'sequential-thinking',
    description: 'Structured step-by-step reasoning tool.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  },
  {
    id: 'puppeteer',
    name: 'puppeteer',
    description: 'Drive a headless browser to scrape and screenshot.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
  },
  {
    id: 'postgres',
    name: 'postgres',
    description: 'Read-only SQL access to a PostgreSQL database.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    envKeys: ['DATABASE_URL'],
  },
  {
    id: 'brave-search',
    name: 'brave-search',
    description: 'Web search via the Brave Search API.',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    envKeys: ['BRAVE_API_KEY'],
  },
]
