import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { formatMoney } from '@/shared/lib/cost'
import type { ProjectRollup } from '../lib/aggregate'

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

export function ProjectCards({
  projects,
  currency,
  maxShown = 6,
}: {
  projects: ProjectRollup[]
  currency: 'usd' | 'eur'
  maxShown?: number
}) {
  if (projects.length === 0) return null
  const shown = projects.slice(0, maxShown)
  const maxTokens = Math.max(1, ...shown.map((p) => p.tokens))

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((p) => (
        <Card key={p.cwd || p.label} className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <Icon name="folder" className="size-4 shrink-0 text-primary" />
            <span className="truncate font-medium" title={p.cwd || p.label}>
              {p.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold">{compact(p.tokens)}</span>
            <span className="text-xs text-muted-foreground">tokens</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(p.tokens / maxTokens) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{p.sessions} sessions</span>
            <span>{compact(p.messages)} msgs</span>
            <span>~{formatMoney(p.estCostUsd, currency)}</span>
            <span className="ml-auto">{relativeTime(p.lastActivityAt)}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
