import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatSessionMeta } from '@/shared/types/chat'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useAgentStore } from '@/features/agents/store/agent.store'

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon name={icon} className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}

export function UsagePanel() {
  const navigate = useNavigate()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const chatAgents = useAllAgents().filter((a) => a.capabilities.chats)

  const [sessions, setSessions] = useState<ChatSessionMeta[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all(
      chatAgents.map((a) => ipc.chatListSessions(a.id).catch(() => [])),
    ).then((lists) => {
      if (!active) return
      setSessions(lists.flat())
      setLoaded(true)
    })
    return () => {
      active = false
    }
    // chatAgents is derived from the (stable) registry; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(() => {
    const totalMessages = sessions.reduce((n, s) => n + s.messageCount, 0)
    const inputTokens = sessions.reduce((n, s) => n + (s.inputTokens ?? 0), 0)
    const outputTokens = sessions.reduce((n, s) => n + (s.outputTokens ?? 0), 0)
    const recent = [...sessions]
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      .slice(0, 6)
    const projects = new Map<string, number>()
    for (const s of sessions) {
      projects.set(
        s.projectLabel,
        (projects.get(s.projectLabel) ?? 0) + s.messageCount,
      )
    }
    const topProjects = [...projects.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    return {
      totalSessions: sessions.length,
      totalMessages,
      inputTokens,
      outputTokens,
      recent,
      topProjects,
    }
  }, [sessions])

  if (loaded && sessions.length === 0) return null

  const openSession = (s: ChatSessionMeta) => {
    setActiveAgent(s.agentId)
    navigate('/chats')
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Usage</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon="messages-square"
          label="Sessions"
          value={compact(stats.totalSessions)}
        />
        <Stat
          icon="file-text"
          label="Messages"
          value={compact(stats.totalMessages)}
        />
        <Stat
          icon="cpu"
          label="Input tokens"
          value={stats.inputTokens ? compact(stats.inputTokens) : '—'}
        />
        <Stat
          icon="sparkles"
          label="Output tokens"
          value={stats.outputTokens ? compact(stats.outputTokens) : '—'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Recent sessions</p>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1">
              {stats.recent.map((s) => (
                <button
                  key={`${s.agentId}-${s.id}`}
                  type="button"
                  onClick={() => openSession(s)}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon
                      name="messages-square"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{s.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(s.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Top projects</p>
          <div className="flex flex-col gap-1.5">
            {stats.topProjects.map(([label, count]) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <Icon
                  name="folder"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="truncate">{label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {compact(count)} msg
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  )
}
