import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentId } from '@/shared/types/agent'
import type { PlanUsage, PlanUsageResult, PlanUsageWindow } from '@/shared/types/chat'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { ipc } from '@/shared/ipc/ipc.client'
import { cn } from '@/shared/lib/utils'
import { formatResetIn, relativeTime } from '../lib/format'

/** Bar fill colour escalates as a window approaches its limit. */
function barColor(utilization: number): string {
  if (utilization >= 0.9) return 'bg-destructive'
  if (utilization >= 0.75) return 'bg-warning'
  return 'bg-primary'
}

function UsageRow({
  label,
  window,
}: {
  label: string
  window: PlanUsageWindow
}) {
  const { t } = useTranslation('chats')
  const pct = Math.round(window.utilization * 100)
  const reset = formatResetIn(window.resetsAt, t)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {t('planUsage.percentUsed', { pct })}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            barColor(window.utilization),
          )}
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
      {reset && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon name="clock" className="size-3" />
          {reset}
        </p>
      )}
    </div>
  )
}

function UsageBody({ usage }: { usage: PlanUsage }) {
  const { t } = useTranslation('chats')
  const hasWeekly =
    usage.weeklyAllModels || usage.weeklySonnet || usage.weeklyOpus
  const hasAny = usage.session || hasWeekly
  return (
    <div className="space-y-3">
      {usage.session && (
        <UsageRow label={t('planUsage.session')} window={usage.session} />
      )}
      {hasWeekly && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('planUsage.weekly')}
          </p>
          {usage.weeklyAllModels && (
            <UsageRow
              label={t('planUsage.allModels')}
              window={usage.weeklyAllModels}
            />
          )}
          {usage.weeklySonnet && (
            <UsageRow
              label={t('planUsage.sonnetOnly')}
              window={usage.weeklySonnet}
            />
          )}
          {usage.weeklyOpus && (
            <UsageRow
              label={t('planUsage.opusOnly')}
              window={usage.weeklyOpus}
            />
          )}
        </div>
      )}
      {!hasAny && (
        <p className="text-sm text-muted-foreground">{t('planUsage.empty')}</p>
      )}
    </div>
  )
}

export function PlanUsagePanel({ agentId }: { agentId: AgentId }) {
  const { t } = useTranslation('chats')
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<PlanUsageResult | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async (force = false) => {
    setLoading(true)
    try {
      setResult(await ipc.chatPlanUsage(agentId, force))
    } catch (err) {
      setResult({
        status: 'unavailable',
        reason: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !result) void load()
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" title={t('planUsage.tooltip')}>
          <Icon name="gauge" />
          {t('planUsage.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{t('planUsage.title')}</span>
          {result?.status === 'ok' && result.usage.subscriptionType && (
            <Badge variant="muted" className="uppercase">
              {result.usage.subscriptionType}
            </Badge>
          )}
        </div>

        {loading && !result ? (
          <div className="flex items-center justify-center py-6">
            <Spinner label={t('planUsage.loading')} />
          </div>
        ) : result?.status === 'ok' ? (
          <UsageBody usage={result.usage} />
        ) : result?.status === 'unauthenticated' ? (
          <p className="py-2 text-sm text-muted-foreground">
            {t('planUsage.unauthenticated')}
          </p>
        ) : result?.status === 'unsupported' ? (
          <p className="py-2 text-sm text-muted-foreground">
            {t('planUsage.unsupported')}
          </p>
        ) : (
          <div className="space-y-2 py-1">
            <p className="text-sm text-muted-foreground">
              {t('planUsage.error')}
            </p>
            {result?.status === 'unavailable' && result.reason && (
              <p className="truncate font-code text-xs text-muted-foreground/70">
                {result.reason}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">
            {result?.status === 'ok'
              ? t('planUsage.updated', {
                  when: relativeTime(result.usage.fetchedAt, t),
                })
              : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => void load(true)}
            disabled={loading}
          >
            <Icon
              name="refresh-cw"
              className={cn('size-3.5', loading && 'animate-spin')}
            />
            {t('planUsage.refresh')}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
