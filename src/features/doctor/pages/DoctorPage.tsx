import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { DoctorAgentInput, DoctorSeverity } from '@/shared/types/doctor'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useDoctorStore } from '../store/doctor.store'

const SEVERITY: Record<
  DoctorSeverity,
  { icon: string; color: string; badge: 'danger' | 'warning' | 'muted' }
> = {
  error: { icon: 'circle-x', color: 'text-destructive', badge: 'danger' },
  warning: {
    icon: 'triangle-alert',
    color: 'text-warning',
    badge: 'warning',
  },
  info: { icon: 'info', color: 'text-muted-foreground', badge: 'muted' },
}

const CATEGORY_ICON: Record<string, string> = {
  mcp: 'plug',
  hooks: 'webhook',
  permissions: 'shield',
  settings: 'file-json',
  general: 'circle-help',
}

export function DoctorPage() {
  const { t } = useTranslation('doctor')
  const navigate = useNavigate()
  const agents = useAllAgents()
  const getBasePath = useSettingsStore((s) => s.getBasePath)
  const report = useDoctorStore((s) => s.report)
  const scanning = useDoctorStore((s) => s.scanning)
  const fixing = useDoctorStore((s) => s.fixing)
  const scan = useDoctorStore((s) => s.scan)
  const fix = useDoctorStore((s) => s.fix)

  // What each enabled agent contributes to the scan: its global base + which
  // surfaces it actually has, so the doctor only runs applicable checks.
  const inputs = useMemo<DoctorAgentInput[]>(
    () =>
      agents.map((a) => ({
        agentId: a.id,
        displayName: a.displayName,
        basePath: getBasePath(a.id),
        caps: {
          mcp: a.capabilities.mcp,
          hooks: a.capabilities.hooks,
          permissions: a.capabilities.permissions,
          rawSettings: a.capabilities.rawSettings,
        },
      })),
    [agents, getBasePath],
  )

  useEffect(() => {
    void useDoctorStore.getState().scan(inputs)
    // `inputs` comes from useMemo and is referentially stable between renders;
    // it only changes when agents or getBasePath changes — the same conditions
    // that would change inputsKey.
  }, [inputs])

  const counts = report?.counts
  const healthy = report && report.findings.length === 0

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon="stethoscope"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void scan(inputs)}
            disabled={scanning}
          >
            {scanning ? (
              <Spinner label={t('scanning')} />
            ) : (
              <Icon name="refresh-cw" />
            )}
            {t('rescan')}
          </Button>
        }
      />

      {counts && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={counts.error ? 'danger' : 'muted'}>
            <Icon name="circle-x" className="size-3.5" />
            {t('counts.error', { count: counts.error })}
          </Badge>
          <Badge variant={counts.warning ? 'warning' : 'muted'}>
            <Icon name="triangle-alert" className="size-3.5" />
            {t('counts.warning', { count: counts.warning })}
          </Badge>
          <Badge variant="muted">
            <Icon name="info" className="size-3.5" />
            {t('counts.info', { count: counts.info })}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('counts.agentsScanned', { count: report?.agentCount ?? 0 })}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {scanning && !report ? (
          <p className="text-sm text-muted-foreground">{t('running')}</p>
        ) : healthy ? (
          <EmptyState
            icon="shield-check"
            title={t('healthy.title')}
            description={t('healthy.desc')}
          />
        ) : (
          report?.findings.map((f) => {
            const sev = SEVERITY[f.severity]
            const busy = fixing[f.id]
            return (
              <Card key={f.id} className="flex items-start gap-3 p-3.5">
                <Icon
                  name={sev.icon}
                  className={`mt-0.5 size-5 shrink-0 ${sev.color}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{f.title}</p>
                    <Badge variant="muted" className="gap-1">
                      <Icon
                        name={CATEGORY_ICON[f.category] ?? 'circle-help'}
                        className="size-3"
                      />
                      {f.agentName}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{f.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {f.route && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(f.route!)}
                    >
                      <Icon name="arrow-right" />
                      {t('open')}
                    </Button>
                  )}
                  {f.fix && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void fix(f, inputs)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Spinner label={t('fixing')} />
                      ) : (
                        <Icon name="wand-sparkles" />
                      )}
                      {t('fix')}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
