import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UsageAnalytics } from '@/shared/types/chat'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
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

type RelKey =
  | 'relative.never'
  | 'relative.now'
  | 'relative.minutes'
  | 'relative.hours'
  | 'relative.days'

function relativeTime(iso?: string): { key: RelKey; count: number } {
  if (!iso) return { key: 'relative.never', count: 0 }
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return { key: 'relative.now', count: 0 }
  if (min < 60) return { key: 'relative.minutes', count: min }
  const h = Math.round(min / 60)
  if (h < 24) return { key: 'relative.hours', count: h }
  return { key: 'relative.days', count: Math.round(h / 24) }
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

/**
 * Weekly token-budget gauge: progress of the past-7-days token total against the
 * user's configured budget. Color steps success → warning (≥75%) → destructive
 * (≥100%), with an inline over-budget warning.
 */
function WeeklyBudgetGauge({
  used,
  budget,
  alertPercent,
}: {
  used: number
  budget: number
  alertPercent?: number
}) {
  const { t } = useTranslation('usage')
  const ratio = budget > 0 ? used / budget : 0
  const pct = Math.round(ratio * 100)
  const barColor =
    ratio >= 1 ? 'bg-destructive' : ratio >= 0.75 ? 'bg-warning' : 'bg-success'
  // Custom alert threshold fires below 100% (the over-budget message covers ≥100%).
  const alertHit =
    alertPercent !== undefined &&
    alertPercent > 0 &&
    pct >= alertPercent &&
    ratio < 1
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Icon name="gauge" className="size-4 text-muted-foreground" />
          {t('weeklyBudget')}
        </span>
        <span className="font-code text-xs text-muted-foreground">
          {t('budget.usage', {
            used: compact(used),
            budget: compact(budget),
            pct,
          })}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {ratio >= 1 ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <Icon name="triangle-alert" className="size-3.5" />
          {t('budgetExceeded')}
        </p>
      ) : (
        alertHit && (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <Icon name="triangle-alert" className="size-3.5" />
            {t('budget.alert', { percent: alertPercent })}
          </p>
        )
      )}
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
  const { t } = useTranslation('usage')
  const agents = useAllAgents()
  const chatAgents = useMemo(
    () => agents.filter((a) => a.capabilities.chats),
    [agents],
  )
  const { scope } = useScope()
  const projectDir = useProjectDir()
  const currency = useSettingsStore((s) => s.settings.currency)
  const weeklyBudget = useSettingsStore((s) => s.settings.weeklyTokenBudget)
  const budgetAlertPercent = useSettingsStore(
    (s) => s.settings.budgetAlertPercent,
  )

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
  // Tokens consumed over the most recent 7 calendar days (daily is oldest first).
  const weeklyTokens = data
    ? data.daily.slice(-7).reduce((sum, d) => sum + d.tokens, 0)
    : 0
  const maxAgentTokens = data
    ? Math.max(1, ...data.byAgent.map((a) => a.inputTokens + a.outputTokens))
    : 1
  const maxProjectTokens = data
    ? Math.max(1, ...data.projects.map((p) => p.inputTokens + p.outputTokens))
    : 1
  const rel = relativeTime(data?.lastActivityAt)

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={
          scope === 'project' && projectDir
            ? t('description.project', { project: basename(projectDir) })
            : t('description.all')
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
              {t('csv')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReload((n) => n + 1)}
              disabled={loading}
            >
              {loading ? (
                <Spinner label={t('refreshing')} />
              ) : (
                <Icon name="refresh-cw" />
              )}
              {t('refresh')}
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {loading && !data ? (
          <p className="text-sm text-muted-foreground">{t('crunching')}</p>
        ) : !hasData ? (
          <EmptyState
            icon="bar-chart-3"
            title={t('empty.title')}
            description={t('empty.desc')}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                icon="circle-dollar-sign"
                label={t('stats.estimatedCost')}
                value={`~${formatMoney(data.estCostUsd, currency)}`}
                hint={t('statHints.sonnet')}
              />
              <Stat
                icon="cpu"
                label={t('stats.totalTokens')}
                value={compact(data.inputTokens + data.outputTokens)}
                hint={t('statHints.inOut', {
                  in: compact(data.inputTokens),
                  out: compact(data.outputTokens),
                })}
              />
              <Stat
                icon="messages-square"
                label={t('stats.sessions')}
                value={compact(data.totalSessions)}
                hint={t('statHints.messages', {
                  value: compact(data.totalMessages),
                })}
              />
              <Stat
                icon="clock"
                label={t('stats.lastActivity')}
                value={t(rel.key, { count: rel.count })}
              />
            </div>

            {weeklyBudget !== undefined && weeklyBudget > 0 && (
              <WeeklyBudgetGauge
                used={weeklyTokens}
                budget={weeklyBudget}
                alertPercent={budgetAlertPercent}
              />
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t('tokensPerDay', { count: data.days })}
              </h2>
              <Card className="p-4">
                <UsageTimeline daily={data.daily} />
              </Card>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t('sections.calendar')}
              </h2>
              <Card className="p-4">
                <UsageHeatmap daily={data.daily} />
              </Card>
            </section>

            {data.byAgent.length > 1 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t('sections.byAgent')}
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
                {t('sections.topProjects')}
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

            <p className="pb-2 text-xs text-muted-foreground">{t('costNote')}</p>
          </>
        )}
      </div>
    </div>
  )
}
