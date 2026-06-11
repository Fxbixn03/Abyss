import type { UsageDailyPoint } from '@/shared/types/chat'

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function shortDay(date: string): string {
  // YYYY-MM-DD → "Jun 3"
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Daily-token bar chart drawn with plain divs and semantic color tokens (no
 * charting dependency). The tallest day fills the track; empty days render a
 * faint baseline so gaps in activity stay visible.
 */
export function UsageTimeline({ daily }: { daily: UsageDailyPoint[] }) {
  const max = Math.max(1, ...daily.map((d) => d.tokens))
  // With long windows, label only a handful of evenly-spaced days.
  const labelEvery = Math.max(1, Math.ceil(daily.length / 8))

  return (
    <div className="space-y-2">
      <div className="flex h-40 items-end gap-px">
        {daily.map((d) => {
          const pct = d.tokens > 0 ? Math.max(4, (d.tokens / max) * 100) : 0
          return (
            <div
              key={d.date}
              className="group flex h-full flex-1 items-end"
              title={`${shortDay(d.date)} — ${compact(d.tokens)} tokens`}
            >
              {pct > 0 ? (
                <div
                  className="w-full rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary"
                  style={{ height: `${pct}%` }}
                />
              ) : (
                <div className="h-px w-full bg-border" />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-px text-[10px] text-muted-foreground">
        {daily.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % labelEvery === 0 ? shortDay(d.date) : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
