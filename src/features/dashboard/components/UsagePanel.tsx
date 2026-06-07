import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatUsageStats, UsageDailyPoint } from '@/shared/types/chat'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { estimateCostUsd, formatMoney } from '@/shared/lib/cost'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useScope, useProjectDir } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useUsageStore } from '../store/usage.store'

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

/** Last path segment of an absolute dir, for the scope heading. */
function basename(p: string): string {
  const parts = p.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || p
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

function QuotaBar({
  label,
  used,
  budget,
}: {
  label: string
  used: number
  budget?: number
}) {
  if (!budget || budget <= 0) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-code text-xs text-muted-foreground">
          {compact(used)} used · no budget set
        </span>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((used / budget) * 100))
  const tone =
    pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-code text-xs text-muted-foreground">
          {compact(used)} / {compact(budget)} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Tiny 7-day token trend rendered as a row of proportional bars. */
function UsageTrend({ daily }: { daily: UsageDailyPoint[] }) {
  const max = Math.max(1, ...daily.map((d) => d.tokens))
  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-medium">Tokens · last 7 days</p>
      <div className="flex h-20 items-end gap-1.5">
        {daily.map((d) => {
          const pct = Math.round((d.tokens / max) * 100)
          const weekday = new Date(`${d.date}T00:00:00Z`).toLocaleDateString(
            undefined,
            { weekday: 'short' },
          )
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${d.date} · ${compact(d.tokens)} tokens`}
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(pct, d.tokens > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {weekday}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function StatSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[60px] animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

export function UsagePanel() {
  const navigate = useNavigate()
  const agent = useActiveAgent()
  const hasChats = agent.capabilities.chats
  const { scope } = useScope()
  const projectDir = useProjectDir()
  const billingMode = useSettingsStore((s) => s.settings.billingMode)
  const showCosts = useSettingsStore((s) => s.settings.showCosts)
  const currency = useSettingsStore((s) => s.settings.currency)
  const weeklyBudget = useSettingsStore((s) => s.settings.weeklyTokenBudget)
  const sessionBudget = useSettingsStore((s) => s.settings.sessionTokenBudget)
  const costVisible = billingMode === 'api' && showCosts

  const slice = useUsageStore((s) => s.byAgent[agent.id])
  const load = useUsageStore((s) => s.load)

  useEffect(() => {
    if (!hasChats) return
    void load(agent.id, projectDir)
  }, [agent.id, hasChats, projectDir, load])

  if (!hasChats) return null

  const stats: ChatUsageStats | null = slice?.stats ?? null
  const loading = !slice || (slice.loading && !slice.stats)
  const error = slice?.error ?? false

  const scopeLabel =
    scope === 'project'
      ? projectDir
        ? basename(projectDir)
        : 'project'
      : 'global'

  const heading = (
    <h2 className="text-sm font-medium text-muted-foreground">
      Usage · {agent.displayName} · {scopeLabel}
    </h2>
  )

  if (error && !stats) {
    return (
      <section className="space-y-3">
        {heading}
        <Card className="flex items-center justify-between gap-3 p-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icon name="alert-triangle" className="size-4 shrink-0" />
            Couldn’t load usage data.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load(agent.id, projectDir, true)}
          >
            <Icon name="refresh-cw" />
            Retry
          </Button>
        </Card>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="space-y-3">
        {heading}
        <div className="h-[92px] animate-pulse rounded-lg bg-muted" />
        <StatSkeleton />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      </section>
    )
  }

  if (!stats || stats.totalSessions === 0) return null

  const sessionUsed = stats.sessionTokens
  const weeklyUsed = stats.daily.reduce((n, d) => n + d.tokens, 0)
  const showQuota = Boolean(weeklyBudget || sessionBudget)
  const estCost = stats.estCostUsd ?? estimateCostUsd(stats.inputTokens, stats.outputTokens)

  const openSession = () => navigate('/chats')

  return (
    <section className="space-y-3">
      {heading}

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Icon name="gauge" className="size-4" />
            Quota left
          </p>
          {!showQuota && (
            <button
              type="button"
              onClick={() => navigate('/settings?s=preferences')}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Set budgets →
            </button>
          )}
        </div>
        <QuotaBar
          label="5-hour session"
          used={sessionUsed}
          budget={sessionBudget}
        />
        <QuotaBar label="This week" used={weeklyUsed} budget={weeklyBudget} />
      </Card>

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
        {costVisible && (
          <Stat
            icon="circle-dollar-sign"
            label="Estimated cost"
            value={`~${formatMoney(estCost, currency)}`}
          />
        )}
      </div>

      <UsageTrend daily={stats.daily} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Recent sessions</p>
          <div className="flex flex-col gap-1">
            {stats.recent.map((s) => (
              <button
                key={`${s.agentId}-${s.id}`}
                type="button"
                onClick={openSession}
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
        </Card>

        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Top projects</p>
          <div className="flex flex-col gap-1.5">
            {stats.topProjects.map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-sm">
                <Icon
                  name="folder"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="truncate">{p.label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {compact(p.messageCount)} msg
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  )
}
