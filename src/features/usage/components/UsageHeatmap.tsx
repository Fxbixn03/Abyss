import type { UsageDailyPoint } from '@/shared/types/chat'

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/** Map a token count to one of five intensity buckets, relative to the busiest day. */
function bucket(tokens: number, max: number): number {
  if (tokens <= 0) return 0
  return Math.min(4, Math.ceil((tokens / max) * 4))
}

const LEVELS = [
  'bg-muted',
  'bg-primary/25',
  'bg-primary/45',
  'bg-primary/70',
  'bg-primary',
]

const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

/**
 * GitHub-style activity calendar: one column per week, one cell per day, shaded
 * by token volume. Built purely from the daily series so it shares the analytics
 * window with the timeline. Weeks run Sunday→Saturday top to bottom.
 */
export function UsageHeatmap({ daily }: { daily: UsageDailyPoint[] }) {
  if (daily.length === 0) return null
  const max = Math.max(1, ...daily.map((d) => d.tokens))
  const byDate = new Map(daily.map((d) => [d.date, d.tokens]))

  // Pad the start so the first column begins on a Sunday.
  const first = new Date(`${daily[0].date}T00:00:00Z`)
  const lead = first.getUTCDay() // 0 = Sun
  const start = new Date(first)
  start.setUTCDate(start.getUTCDate() - lead)

  const last = new Date(`${daily[daily.length - 1].date}T00:00:00Z`)
  const weeks: { date: string; tokens: number | null }[][] = []
  const cursor = new Date(start)
  while (cursor <= last) {
    const week: { date: string; tokens: number | null }[] = []
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().slice(0, 10)
      const inRange = iso >= daily[0].date && iso <= daily[daily.length - 1].date
      week.push({ date: iso, tokens: inRange ? (byDate.get(iso) ?? 0) : null })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push(week)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto">
        <div className="flex flex-col gap-1 pr-1 text-[10px] text-muted-foreground">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="flex h-3 items-center leading-none">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) =>
              cell.tokens === null ? (
                <div key={di} className="size-3" />
              ) : (
                <div
                  key={di}
                  className={`size-3 rounded-sm ${LEVELS[bucket(cell.tokens, max)]}`}
                  title={`${cell.date} — ${compact(cell.tokens)} tokens`}
                />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        {LEVELS.map((c, i) => (
          <div key={i} className={`size-3 rounded-sm ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
