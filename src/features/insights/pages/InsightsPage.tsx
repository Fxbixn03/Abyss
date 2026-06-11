import { useEffect, useState } from 'react'
import type { InsightsReport, SessionFriction } from '@/shared/types/chat'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useProjectDir } from '@/features/scope/hooks/useScopedBase'

function scoreTone(score: number): { label: string; variant: 'success' | 'warning' | 'danger' } {
  if (score < 20) return { label: 'smooth', variant: 'success' }
  if (score < 50) return { label: 'some friction', variant: 'warning' }
  return { label: 'rough', variant: 'danger' }
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
        <Icon name={icon} className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}

function DistributionBar({ buckets }: { buckets: InsightsReport['buckets'] }) {
  const total = Math.max(1, buckets.smooth + buckets.some + buckets.high)
  const seg = (n: number) => `${(n / total) * 100}%`
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        <div className="bg-success" style={{ width: seg(buckets.smooth) }} title={`${buckets.smooth} smooth`} />
        <div className="bg-warning" style={{ width: seg(buckets.some) }} title={`${buckets.some} some friction`} />
        <div className="bg-destructive" style={{ width: seg(buckets.high) }} title={`${buckets.high} rough`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" /> {buckets.smooth} smooth
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" /> {buckets.some} some friction
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-destructive" /> {buckets.high} rough
        </span>
      </div>
    </div>
  )
}

function TrendChart({ daily }: { daily: InsightsReport['daily'] }) {
  if (daily.length === 0) return null
  return (
    <div className="flex h-24 items-end gap-1">
      {daily.map((d) => {
        const tone = scoreTone(d.score)
        const color =
          tone.variant === 'success'
            ? 'bg-success'
            : tone.variant === 'warning'
              ? 'bg-warning'
              : 'bg-destructive'
        return (
          <div
            key={d.date}
            className="flex flex-1 flex-col items-center justify-end"
            title={`${d.date}: avg ${d.score} · ${d.sessions} session(s)`}
          >
            <div
              className={`w-full rounded-t ${color}`}
              style={{ height: `${Math.max(4, d.score)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

function FrictionRow({ f }: { f: SessionFriction }) {
  const tone = scoreTone(f.score)
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums">
        {f.score}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={f.title}>
          {f.title || 'Untitled session'}
        </p>
        <p className="truncate font-code text-xs text-muted-foreground">
          {f.projectLabel}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {f.corrections > 0 && (
          <Badge variant="muted" title="User corrections">
            <Icon name="rotate-ccw" className="size-3" />
            {f.corrections}
          </Badge>
        )}
        {f.toolErrors > 0 && (
          <Badge variant="danger" title="Tool errors">
            <Icon name="circle-alert" className="size-3" />
            {f.toolErrors}
          </Badge>
        )}
        {f.redundantCalls > 0 && (
          <Badge variant="muted" title="Repeated tool calls">
            <Icon name="copy" className="size-3" />
            {f.redundantCalls}
          </Badge>
        )}
        <Badge variant={tone.variant}>{tone.label}</Badge>
      </div>
    </li>
  )
}

export function InsightsPage() {
  const agent = useActiveAgent()
  const supported = agent.capabilities.chats
  const projectDir = useProjectDir()

  const [report, setReport] = useState<InsightsReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const r = await ipc.chatInsights(agent.id, { cwd: projectDir })
        if (!cancelled) setReport(r)
      } catch (err) {
        if (!cancelled) reportError(err, { title: "Couldn't compute insights" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [supported, agent.id, projectDir])

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Insights" icon="gauge" />
        <EmptyState
          icon="gauge"
          title={`${agent.displayName} has no session history`}
          description="Switch to an agent that records chat sessions to see friction insights."
        />
      </div>
    )
  }

  const hasData = report && report.sessionsAnalyzed > 0

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Insights"
        description={`Friction signals across recent ${agent.displayName} sessions`}
        icon="gauge"
      />

      {loading && !report ? (
        <p className="text-sm text-muted-foreground">Analyzing transcripts…</p>
      ) : !hasData ? (
        <EmptyState
          icon="gauge"
          title="Nothing to analyze yet"
          description="Once this agent has a few sessions, friction signals (tool errors, corrections, repeated calls) show up here."
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon="gauge"
              label="avg friction (0–100)"
              value={String(report.avgScore)}
            />
            <Stat
              icon="scroll-text"
              label="sessions analyzed"
              value={String(report.sessionsAnalyzed)}
            />
            <Stat
              icon="rotate-ccw"
              label="user corrections"
              value={String(report.totalCorrections)}
            />
            <Stat
              icon="circle-alert"
              label="tool errors"
              value={String(report.totalToolErrors)}
            />
          </div>

          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium">Friction distribution</p>
            <DistributionBar buckets={report.buckets} />
          </Card>

          {report.daily.length > 1 && (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-medium">Friction trend</p>
              <TrendChart daily={report.daily} />
            </Card>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Roughest sessions</p>
            {report.topFriction.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notable friction — all analyzed sessions ran smoothly.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.topFriction.map((f) => (
                  <FrictionRow key={f.sessionId} f={f} />
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Friction is a heuristic from measurable signals (tool errors, user
            corrections, repeated tool calls) over the {report.sessionsAnalyzed}{' '}
            most recent sessions — not a judgement of answer quality.
          </p>
        </div>
      )}
    </div>
  )
}
