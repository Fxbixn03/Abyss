import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useProjectDir } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useSessionsStore } from '../store/sessions.store'
import { ProjectCards } from '../components/ProjectCards'
import { SessionTable } from '../components/SessionTable'
import { SessionDetail } from '../components/SessionDetail'
import { rollupByProject, sortSessions, type SessionSortKey } from '../lib/aggregate'

export function SessionsPage() {
  const agent = useActiveAgent()
  const supported = agent.capabilities.chats
  const projectDir = useProjectDir()
  const currency = useSettingsStore((s) => s.settings.currency)

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

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Sessions" icon="files" />
        <EmptyState
          icon="files"
          title={`${agent.displayName} has no session history`}
          description="Switch to an agent that records chat sessions to explore them here."
        />
      </div>
    )
  }

  // Detail view: one session's transcript, tool frequency and role tallies.
  if (selected) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Session Explorer" icon="files" />
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
        title="Session Explorer"
        description={`Browse, compare and inspect ${agent.displayName} sessions`}
        icon="files"
        actions={
          <Button
            variant="outline"
            onClick={() => void load(agent.id, projectDir)}
            disabled={loading}
          >
            <Icon name={loading ? 'loader' : 'refresh-cw'} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon="files"
          title="No sessions yet"
          description="Once you've chatted with this agent, its sessions show up here to explore."
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
                placeholder="Filter by title or project…"
                className="pl-8"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {sessions.length}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <SessionTable
              sessions={filtered}
              sortKey={sortKey}
              sortDir={sortDir}
              currency={currency}
              onSort={onSort}
              onOpen={(id) => void open(id)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
