import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DiscoveryResult } from '@/shared/discovery/types'
import type { McpInstallSpec } from '@/shared/mcp/discovery'
import { installSpecToEntry } from '@/shared/mcp/discovery'
import { sourcesForKind } from '@/shared/discovery/sources'
import { ipc } from '@/shared/ipc/ipc.client'
import { genId } from '@/shared/lib/id'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useConfigBase,
  useProjectDir,
} from '@/features/scope/hooks/useScopedBase'
import { useMcpStore } from '@/features/mcp/store/mcp.store'

const WEBSITE_SOURCES = sourcesForKind('mcp').filter(
  (s) => s.mode === 'website',
)

export function MarketplacePage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const projectDir = useProjectDir()
  const navigate = useNavigate()

  const servers = useMcpStore((s) => s.servers)
  const loadServers = useMcpStore((s) => s.load)
  const upsert = useMcpStore((s) => s.upsert)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DiscoveryResult[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ran, setRan] = useState(false)
  const [justInstalled, setJustInstalled] = useState<Set<string>>(new Set())

  const supported = agent.capabilities.mcp
  const existingNames = useMemo(
    () => new Set(servers.map((s) => s.name)),
    [servers],
  )

  // Keep the active agent's server list loaded so install targets and the
  // "installed" state are accurate.
  useEffect(() => {
    if (supported && basePath) void loadServers(agent.id, basePath, projectDir)
  }, [supported, agent.id, basePath, projectDir, loadServers])

  const runSearch = async (q: string, more = false) => {
    if (more) setLoadingMore(true)
    else {
      setLoading(true)
      setError(null)
    }
    const requestId = genId()
    try {
      const res = await ipc.discoverySearch({
        kind: 'mcp',
        sourceId: 'mcp-official',
        query: q.trim(),
        cursor: more ? cursor : undefined,
        requestId,
      })
      setRan(true)
      setError(res.error ?? null)
      setResults((prev) => (more ? [...prev, ...res.results] : res.results))
      setCursor(res.nextCursor)
    } catch {
      setError('Could not reach the registry. Check your connection.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Initial load: the registry's top servers (empty query).
  useEffect(() => {
    const run = async () => {
      await runSearch('')
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const install = async (result: DiscoveryResult) => {
    const entry = installSpecToEntry(
      result.payload as McpInstallSpec,
      result.name,
      [...existingNames],
    )
    await upsert(entry)
    setJustInstalled((s) => new Set(s).add(result.id))
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="MCP Marketplace" icon="store" />
        <EmptyState
          icon="plug"
          title={`${agent.displayName} has no MCP support`}
          description="Switch to an agent that supports the Model Context Protocol to browse and install servers."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="MCP Marketplace"
        description={`Browse the official registry and install into ${agent.displayName} with one click`}
        icon="store"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/mcp')}>
            <Icon name="plug" />
            Manage servers
          </Button>
        }
      />

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void runSearch(query)
        }}
      >
        <div className="relative flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search MCP servers — e.g. github, postgres, slack…"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading}>
          <Icon
            name={loading ? 'loader' : 'search'}
            className={loading ? 'animate-spin' : ''}
          />
          Search
        </Button>
      </form>

      {!basePath && (
        <p className="text-xs text-warning">
          No config location set for {agent.displayName} — installs are disabled.
          Set a path in Settings first.
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {loading && results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Searching the registry…</p>
        ) : error && results.length === 0 ? (
          <EmptyState icon="cloud-off" title="Registry unavailable" description={error} />
        ) : ran && results.length === 0 ? (
          <EmptyState
            icon="search-x"
            title="No servers found"
            description="Try a different search term, or browse one of the community directories below."
          />
        ) : (
          <>
            {results.map((result) => {
              const installed =
                existingNames.has(result.name) || justInstalled.has(result.id)
              return (
                <Card key={result.id} className="flex items-start gap-3 p-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon name="plug" className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-code text-sm font-medium">
                        {result.name}
                      </span>
                      {result.badges?.map((b, i) => (
                        <Badge
                          key={`${b.label}-${i}`}
                          variant={b.variant === 'warning' ? 'warning' : 'muted'}
                          className="font-code"
                        >
                          {b.label}
                        </Badge>
                      ))}
                      {result.url && (
                        <button
                          type="button"
                          title="Open repository"
                          onClick={() => void ipc.openExternal(result.url!)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Icon name="external-link" className="size-3.5" />
                        </button>
                      )}
                    </div>
                    {result.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {result.description}
                      </p>
                    )}
                  </div>
                  {installed ? (
                    <Badge variant="success" className="mt-1 shrink-0">
                      <Icon name="check" className="size-3.5" />
                      Installed
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => void install(result)}
                      disabled={!result.installable || !basePath}
                      title={
                        result.installable
                          ? undefined
                          : 'No installable package found'
                      }
                    >
                      <Icon name="download" />
                      Install
                    </Button>
                  )}
                </Card>
              )
            })}

            {cursor && (
              <Button
                variant="outline"
                className="self-center"
                onClick={() => void runSearch(query, true)}
                disabled={loadingMore}
              >
                <Icon
                  name={loadingMore ? 'loader' : 'chevron-down'}
                  className={loadingMore ? 'animate-spin' : ''}
                />
                Load more
              </Button>
            )}

            {WEBSITE_SOURCES.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <span>More directories:</span>
                {WEBSITE_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void ipc.openExternal(s.url)}
                    className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                  >
                    <Icon name="external-link" className="size-3" />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
