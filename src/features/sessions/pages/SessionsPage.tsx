import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useProjectDir } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { ipc } from '@/shared/ipc/ipc.client'
import type { ChatExportFormat } from '@/shared/types/ipc'
import type { ChatTranscript } from '@/shared/types/chat'
import { reportError } from '@/shared/lib/errors'
import { useSessionsStore } from '../store/sessions.store'
import { ProjectCards } from '../components/ProjectCards'
import { SessionTable } from '../components/SessionTable'
import { SessionDetail } from '../components/SessionDetail'
import { rollupByProject, sortSessions, type SessionSortKey } from '../lib/aggregate'
import { bulkExportContent } from '../lib/export-format'

export function SessionsPage() {
  const { t } = useTranslation('sessions')
  const agent = useActiveAgent()
  const supported = agent.capabilities.chats
  const projectDir = useProjectDir()
  const currency = useSettingsStore((s) => s.settings.currency)

  const agentId = useSessionsStore((s) => s.agentId)
  const sessions = useSessionsStore((s) => s.sessions)
  const loading = useSessionsStore((s) => s.loading)
  const selectedId = useSessionsStore((s) => s.selectedId)
  const transcript = useSessionsStore((s) => s.transcript)
  const transcriptLoading = useSessionsStore((s) => s.transcriptLoading)
  const load = useSessionsStore((s) => s.load)
  const open = useSessionsStore((s) => s.open)
  const close = useSessionsStore((s) => s.close)

  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SessionSortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportFormat, setExportFormat] = useState<ChatExportFormat>('markdown')
  const [exporting, setExporting] = useState(false)
  const [groupByProject, setGroupByProject] = useState(false)

  useEffect(() => {
    if (supported) void load(agent.id, projectDir)
  }, [supported, agent.id, projectDir, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.projectLabel.toLowerCase().includes(q) ||
            s.cwd.toLowerCase().includes(q),
        )
      : sessions
    return sortSessions(base, sortKey, sortDir)
  }, [sessions, query, sortKey, sortDir])

  const projects = useMemo(() => rollupByProject(sessions), [sessions])
  const selected = sessions.find((s) => s.id === selectedId)

  const onSort = (key: SessionSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const onToggle = useCallback((sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }, [])

  const onToggleRange = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (let i = fromIndex; i <= toIndex; i++) {
          const id = filtered[i]?.id
          if (id !== undefined) next.add(id)
        }
        return next
      })
    },
    [filtered],
  )

  const handleBulkExport = useCallback(async () => {
    if (selectedIds.size === 0 || !agentId) return
    setExporting(true)
    try {
      const ids = [...selectedIds]
      const transcripts: ChatTranscript[] = await Promise.all(
        ids.map((id) => ipc.chatReadSession(agentId, id)),
      )
      const content = bulkExportContent(transcripts, exportFormat)
      const ext = exportFormat === 'markdown' ? 'md' : 'json'
      await ipc.saveTextFile(content, {
        title: 'Export Sessions',
        defaultName: `sessions-export.${ext}`,
        filters: [
          exportFormat === 'markdown'
            ? { name: 'Markdown', extensions: ['md'] }
            : { name: 'JSON', extensions: ['json'] },
        ],
      })
    } catch (err) {
      reportError(err, { title: "Couldn't export sessions" })
    } finally {
      setExporting(false)
    }
  }, [selectedIds, agentId, exportFormat])

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="files" />
        <EmptyState
          icon="files"
          title={t('noHistoryTitle', { agent: agent.displayName })}
          description={t('unsupportedDesc')}
        />
      </div>
    )
  }

  // Detail view: one session's transcript, tool frequency and role tallies.
  if (selected) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('explorerTitle')} icon="files" />
        <div className="min-h-0 flex-1 rounded-lg border border-border bg-card/40 p-4">
          <SessionDetail
            session={selected}
            messages={transcript}
            loading={transcriptLoading}
            agentName={agent.displayName}
            onBack={close}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('explorerTitle')}
        description={t('headerDescription', { agent: agent.displayName })}
        icon="files"
        actions={
          <Button
            variant="outline"
            onClick={() => void load(agent.id, projectDir)}
            disabled={loading}
          >
            {loading ? (
              <Spinner label={t('refreshing')} />
            ) : (
              <Icon name="refresh-cw" />
            )}
            {t('refresh')}
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon="files"
          title={t('empty.title')}
          description={t('empty.desc')}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <ProjectCards projects={projects} currency={currency} />

          <div className="flex items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <Icon
                name="search"
                className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('filter')}
                className="pl-8"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {t('count', { shown: filtered.length, total: sessions.length })}
            </span>
            <Button
              variant={groupByProject ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupByProject((v) => !v)}
              title={t('groupByTitle')}
            >
              <Icon name="layers" />
              {t('groupBy')}
            </Button>
            {selectedIds.size > 0 && (
              <>
                <div className="flex items-center rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setExportFormat('markdown')}
                    className={`rounded-l-md px-2 py-1 text-xs transition-colors ${
                      exportFormat === 'markdown'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('md')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`rounded-r-md px-2 py-1 text-xs transition-colors ${
                      exportFormat === 'json'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('json')}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleBulkExport()}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Spinner label={t('exporting')} />
                  ) : (
                    <Icon name="download" />
                  )}
                  {t('exportN', { count: selectedIds.size })}
                </Button>
              </>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <SessionTable
              sessions={filtered}
              sortKey={sortKey}
              sortDir={sortDir}
              currency={currency}
              onSort={onSort}
              onOpen={(id) => void open(id)}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onToggleRange={onToggleRange}
              groupByProject={groupByProject}
            />
          </div>
        </div>
      )}
    </div>
  )
}
