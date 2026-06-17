import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { McpServerEntry } from '@/shared/types/config'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfigCorruptBanner } from '@/shared/components/ConfigCorruptBanner'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useConfigBase,
  useProjectDir,
} from '@/features/scope/hooks/useScopedBase'
import { useMcpStore } from '../store/mcp.store'
import { McpServerList } from '../components/McpServerList'
import { McpServerForm } from '../components/McpServerForm'
import { McpDiscoverDialog } from '../components/McpDiscoverDialog'
import { McpImportDialog } from '../components/McpImportDialog'
import { McpToolTester } from '../components/McpToolTester'

/** How often periodic monitoring re-checks every server while enabled. */
const MONITOR_INTERVAL_MS = 30_000

export function McpPage() {
  const { t } = useTranslation('mcp')
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const projectDir = useProjectDir()
  const navigate = useNavigate()

  const servers = useMcpStore((s) => s.servers)
  const loading = useMcpStore((s) => s.loading)
  const parseError = useMcpStore((s) => s.parseError)
  const health = useMcpStore((s) => s.health)
  const load = useMcpStore((s) => s.load)
  const upsert = useMcpStore((s) => s.upsert)
  const remove = useMcpStore((s) => s.remove)
  const toggle = useMcpStore((s) => s.toggle)
  const test = useMcpStore((s) => s.test)
  const testAll = useMcpStore((s) => s.testAll)
  const cancelTests = useMcpStore((s) => s.cancelTests)

  const [formOpen, setFormOpen] = useState(false)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<McpServerEntry | undefined>()
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [toolTestOpen, setToolTestOpen] = useState(false)
  const [toolTestServer, setToolTestServer] = useState<McpServerEntry>()
  const [filterQuery, setFilterQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supported = agent.capabilities.mcp

  /** Running tally of online / offline / in-flight servers for the header. */
  const summary = useMemo(() => {
    let online = 0
    let offline = 0
    let checking = 0
    for (const server of servers) {
      const state = health[server.id]
      if (!state) continue
      if ('loading' in state) checking++
      else if (state.ok) online++
      else offline++
    }
    return { online, offline, checking }
  }, [servers, health])

  useEffect(() => {
    if (supported && basePath) void load(agent.id, basePath, projectDir)
  }, [supported, agent.id, basePath, projectDir, load])

  // Auto-check each server's status once (per app session) so the list shows
  // online/offline without a manual click.
  useEffect(() => {
    for (const server of servers) {
      if (!useMcpStore.getState().health[server.id]) void test(server)
    }
  }, [servers, test])

  // Periodic monitoring: while enabled, re-check every server on an interval so
  // status badges stay current without manual clicks. Cleared when toggled off
  // or on unmount.
  useEffect(() => {
    if (!autoRefresh || !supported || !basePath) return
    const id = window.setInterval(() => void testAll(), MONITOR_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, supported, basePath, testAll])

  // Abort any in-flight health checks when leaving the page so their probes
  // don't keep running in the background.
  useEffect(() => () => cancelTests(), [cancelTests])

  // Clear the "Copied!" feedback timer on unmount to avoid state updates after
  // the component has been removed from the tree.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleCopyAsJson = () => {
    type McpJsonServer =
      | { command: string; args?: string[]; env?: Record<string, string> }
      | { url: string; env?: Record<string, string> }
    const mcpServers: Record<string, McpJsonServer> = {}
    for (const server of servers) {
      if (server.type === 'stdio') {
        const entry: {
          command: string
          args?: string[]
          env?: Record<string, string>
        } = {
          command: server.command ?? '',
        }
        if (server.args !== undefined && server.args.length > 0)
          entry.args = server.args
        if (server.env !== undefined && Object.keys(server.env).length > 0)
          entry.env = server.env
        mcpServers[server.name] = entry
      } else {
        const entry: { url: string; env?: Record<string, string> } = {
          url: server.url ?? '',
        }
        if (server.env !== undefined && Object.keys(server.env).length > 0)
          entry.env = server.env
        mcpServers[server.name] = entry
      }
    }
    void navigator.clipboard
      .writeText(JSON.stringify({ mcpServers }, null, 2))
      .then(() => {
        setCopied(true)
        if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => {
          setCopied(false)
          copyTimerRef.current = null
        }, 1500)
      })
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="plug" />
        <EmptyState
          icon="plug"
          title={t('noSupportTitle', { agent: agent.displayName })}
          description={t('unsupportedDesc')}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('userScopedDesc')}
        icon="plug"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void testAll()}
              disabled={!basePath || servers.length === 0}
              title={t('recheckTitle')}
            >
              <Icon name="refresh-cw" />
              {t('actions.recheck')}
            </Button>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              onClick={() => setAutoRefresh((v) => !v)}
              disabled={!basePath || servers.length === 0}
              title={t('autoRecheck', { seconds: MONITOR_INTERVAL_MS / 1000 })}
            >
              <Icon name={autoRefresh ? 'circle-check' : 'clock'} />
              {autoRefresh ? t('autoOn') : t('autoOff')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDiscoverOpen(true)}
              disabled={!basePath}
            >
              <Icon name="globe" />
              {t('actions.discover')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={!basePath}
            >
              <Icon name="upload" />
              {t('actions.import')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyAsJson}
              disabled={servers.length === 0}
            >
              <Icon name={copied ? 'check' : 'copy'} />
              {copied ? t('actions.copied') : t('actions.copyJson')}
            </Button>
            <Button
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
              disabled={!basePath}
            >
              <Icon name="plus" />
              {t('actions.add')}
            </Button>
          </div>
        }
      />

      <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{t('connectorsNote')}</span>
        {servers.length > 0 &&
          (summary.online > 0 ||
            summary.offline > 0 ||
            summary.checking > 0) && (
            <span className="flex items-center gap-2">
              {summary.online > 0 && (
                <Badge variant="success">
                  {t('summary.online', { count: summary.online })}
                </Badge>
              )}
              {summary.offline > 0 && (
                <Badge variant="danger">
                  {t('summary.offline', { count: summary.offline })}
                </Badge>
              )}
              {summary.checking > 0 && (
                <Badge variant="muted">
                  <Spinner className="size-3" label={t('checking')} />
                  {t('summary.checking', { count: summary.checking })}
                </Badge>
              )}
            </span>
          )}
      </div>

      {!basePath ? (
        <EmptyState
          icon="folder"
          title={t('noPath.title')}
          description={t('noPath.desc')}
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              {t('actions.openSettings')}
            </Button>
          }
        />
      ) : parseError ? (
        <ConfigCorruptBanner
          info={parseError}
          onRetry={() => void load(agent.id, basePath, projectDir)}
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t('actions.loading')}</p>
      ) : servers.length === 0 ? (
        <EmptyState
          icon="plug"
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            <Button
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Icon name="plus" />
              {t('actions.add')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setFilterQuery('')
              }}
              placeholder={t('filter')}
              className="pl-9 pr-8"
            />
            {filterQuery && (
              <button
                type="button"
                aria-label={t('clearFilter')}
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon name="x" className="size-4" />
              </button>
            )}
          </div>
          <McpServerList
            servers={servers}
            health={health}
            filter={filterQuery || undefined}
            onToggle={(id) => void toggle(id)}
            onRemove={(id) => void remove(id)}
            onTest={(server) => void test(server)}
            onTestTool={(server) => {
              setToolTestServer(server)
              setToolTestOpen(true)
            }}
            onEdit={(server) => {
              setEditing(server)
              setFormOpen(true)
            }}
            onDuplicate={(server) => {
              setEditing({
                ...server,
                id: crypto.randomUUID(),
                name: `Copy of ${server.name}`,
                args: server.args ? [...server.args] : undefined,
                env: server.env ? { ...server.env } : undefined,
              })
              setFormOpen(true)
            }}
          />
        </div>
      )}

      <McpServerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={(entry) => void upsert(entry)}
      />

      <McpDiscoverDialog
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        existingNames={servers.map((s) => s.name)}
        onPick={(entry) => {
          setEditing(entry)
          setFormOpen(true)
        }}
      />

      <McpImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingNames={servers.map((s) => s.name)}
        onImport={(entries) => {
          void (async () => {
            for (const entry of entries) await upsert(entry)
          })()
        }}
      />

      <McpToolTester
        open={toolTestOpen}
        onOpenChange={setToolTestOpen}
        server={toolTestServer}
      />
    </div>
  )
}
