import { useEffect, useMemo, useState } from 'react'
import type { UsageAnalytics } from '@/shared/types/chat'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { formatMoney } from '@/shared/lib/cost'
import { reportError } from '@/shared/lib/errors'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useScope, useProjectDir } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { UsageTimeline } from '../components/UsageTimeline'
import { UsageHeatmap } from '../components/UsageHeatmap'
import { analyticsToCsv } from '../lib/csv'

const WINDOWS = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' },
]

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function relativeTime(iso?: string): string {
  if (!iso) return 'never'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function basename(p: string): string {
  const parts = p
    .replace(/[/\\]+$/, '')
    .split(/[/\\]/)
    .filter(Boolean)
  return parts[parts.length - 1] || p
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon name={icon} className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  )
}

/** Horizontal bar used in the per-agent / per-project breakdown tables. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function UsagePage() {
  const agents = useAllAgents()
  const chatAgents = useMemo(
    () => agents.filter((a) => a.capabilities.chats),
    [agents],
  )
  const { scope } = useScope()
  const projectDir = useProjectDir()
  const currency = useSettingsStore((s) => s.settings.currency)

  const [days, setDays] = useState(30)
  const [data, setData] = useState<UsageAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  const agentIds = useMemo(() => chatAgents.map((a) => a.id), [chatAgents])
  const idsKey = agentIds.join(',')

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        const res = await ipc.chatUsageAnalytics(agentIds, {
          cwd: projectDir,
          days,
        })
        if (active) setData(res)
      } catch (err) {
        if (active) setData(null)
        reportError(err, { title: "Couldn't load usage analytics" })
      } finally {
        if (active) setLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
    // idsKey stands in for agentIds (stable string), projectDir/days/reload retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, projectDir, days, reload])

  const nameOf = (id: string) =>
    chatAgents.find((a) => a.id === id)?.displayName ?? id
  const iconOf = (id: string) =>
    chatAgents.find((a) => a.id === id)?.icon ?? 'box'

  const exportCsv = async () => {
    if (!data) return
    try {
      await ipc.saveTextFile(analyticsToCsv(data), {
        defaultName: `abyss-usage-${data.days}d.csv`,
        title: 'Export usage analytics',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
    } catch (err) {
      reportError(err, { title: "Couldn't export analytics" })
    }
  }

  const hasData = data && data.totalSessions > 0
  const maxAgentTokens = data
    ? Math.max(1, ...data.byAgent.map((a) => a.inputTokens + a.outputTokens))
    : 1
  const maxProjectTokens = data
    ? Math.max(1, ...data.projects.map((p) => p.inputTokens + p.outputTokens))
    : 1

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Analytics"
        description={
          scope === 'project' && projectDir
            ? `Token & cost usage in ${basename(projectDir)}`
            : 'Token & cost usage across your agents'
        }
        icon="bar-chart-3"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  type="button"
                  onClick={() => setDays(w.days)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    days === w.days
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportCsv()}
              disabled={!hasData}
            >
              <Icon name="download" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReload((n) => n + 1)}
              disabled={loading}
            >
              <Icon
                name={loading ? 'loader' : 'refresh-cw'}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {loading && !data ? (
          <p className="text-sm text-muted-foreground">Crunching usage…</p>
        ) : !hasData ? (
          <EmptyState
            icon="bar-chart-3"
            title="No usage recorded yet"
            description="Once your agents have chat history, token use, cost estimates and an activity calendar show up here."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                icon="circle-dollar-sign"
                label="estimated cost"
                value={`~${formatMoney(data.estCostUsd, currency)}`}
                hint="Sonnet-class estimate"
              />
              <Stat
                icon="cpu"
                label="total tokens"
                value={compact(data.inputTokens + data.outputTokens)}
                hint={`${compact(data.inputTokens)} in · ${compact(data.outputTokens)} out`}
              />
              <Stat
                icon="messages-square"
                label="sessions"
                value={compact(data.totalSessions)}
                hint={`${compact(data.totalMessages)} messages`}
              />
              <Stat
                icon="clock"
                label="last activity"
                value={relativeTime(data.lastActivityAt)}
              />
            </div>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Tokens per day · last {data.days} days
              </h2>
              <Card className="p-4">
                <UsageTimeline daily={data.daily} />
              </Card>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Activity calendar
              </h2>
              <Card className="p-4">
                <UsageHeatmap daily={data.daily} />
              </Card>
            </section>

            {data.byAgent.length > 1 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  By agent
                </h2>
                <Card className="divide-y divide-border">
                  {data.byAgent.map((a) => {
                    const tokens = a.inputTokens + a.outputTokens
                    return (
                      <div
                        key={a.agentId}
                        className="flex items-center gap-3 p-3"
                      >
                        <Icon
                          name={iconOf(a.agentId)}
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <div className="w-28 shrink-0 truncate text-sm font-medium">
                          {nameOf(a.agentId)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Bar value={tokens} max={maxAgentTokens} />
                        </div>
                        <div className="w-16 shrink-0 text-right font-code text-xs">
                          {compact(tokens)}
                        </div>
                        <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                          ~{formatMoney(a.estCostUsd, currency)}
                        </div>
                      </div>
                    )
                  })}
                </Card>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Top projects
              </h2>
              <Card className="divide-y divide-border">
                {data.projects.map((p) => {
                  const tokens = p.inputTokens + p.outputTokens
                  return (
                    <div key={p.cwd} className="flex items-center gap-3 p-3">
                      <Icon
                        name="folder"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <div
                        className="w-40 shrink-0 truncate text-sm font-medium"
                        title={p.cwd}
                      >
                        {p.label}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Bar value={tokens} max={maxProjectTokens} />
                      </div>
                      <div className="w-16 shrink-0 text-right font-code text-xs">
                        {compact(tokens)}
                      </div>
                      <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        ~{formatMoney(p.estCostUsd, currency)}
                      </div>
                    </div>
                  )
                })}
              </Card>
            </section>

            <p className="pb-2 text-xs text-muted-foreground">
              Costs are rough estimates from token counts at a single
              Sonnet-class rate — treat them as ballpark, not billing.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
