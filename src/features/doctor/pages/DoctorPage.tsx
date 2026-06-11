import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DoctorAgentInput, DoctorSeverity } from '@/shared/types/doctor'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
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

  const inputsKey = inputs.map((i) => `${i.agentId}:${i.basePath}`).join('|')

  useEffect(() => {
    void scan(inputs)
    // inputsKey captures the meaningful identity of `inputs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsKey])

  const counts = report?.counts
  const healthy = report && report.findings.length === 0

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Doctor"
        description="One-click health check across every enabled agent"
        icon="stethoscope"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void scan(inputs)}
            disabled={scanning}
          >
            <Icon
              name={scanning ? 'loader' : 'refresh-cw'}
              className={scanning ? 'animate-spin' : ''}
            />
            Rescan
          </Button>
        }
      />

      {counts && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={counts.error ? 'danger' : 'muted'}>
            <Icon name="circle-x" className="size-3.5" />
            {counts.error} error{counts.error === 1 ? '' : 's'}
          </Badge>
          <Badge variant={counts.warning ? 'warning' : 'muted'}>
            <Icon name="triangle-alert" className="size-3.5" />
            {counts.warning} warning{counts.warning === 1 ? '' : 's'}
          </Badge>
          <Badge variant="muted">
            <Icon name="info" className="size-3.5" />
            {counts.info} info
          </Badge>
          <span className="text-xs text-muted-foreground">
            {report?.agentCount} agent
            {report?.agentCount === 1 ? '' : 's'} scanned
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {scanning && !report ? (
          <p className="text-sm text-muted-foreground">Running checks…</p>
        ) : healthy ? (
          <EmptyState
            icon="shield-check"
            title="Everything looks healthy"
            description="No problems found in your agents' MCP servers, hooks or permissions. Nice and tidy."
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
                      Open
                    </Button>
                  )}
                  {f.fix && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void fix(f, inputs)}
                      disabled={busy}
                    >
                      <Icon
                        name={busy ? 'loader' : 'wand-sparkles'}
                        className={busy ? 'animate-spin' : ''}
                      />
                      Fix
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
