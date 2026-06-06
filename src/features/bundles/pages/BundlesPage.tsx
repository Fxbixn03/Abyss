import { useState } from 'react'
import type { ApplyChange, ExportBundle } from '@/shared/types/bundle'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import { PageHeader } from '@/shared/components/PageHeader'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'

type Notice = { type: 'success' | 'error'; message: string }

function AgentToggles({
  ids,
  selected,
  onToggle,
}: {
  ids: string[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  const agents = useAllAgents().filter((a) => ids.includes(a.id))
  return (
    <div className="flex flex-wrap gap-2">
      {agents.map((agent) => {
        const on = selected.has(agent.id)
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => onToggle(agent.id)}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
              on
                ? 'border-primary/50 bg-accent'
                : 'border-border text-muted-foreground hover:bg-accent/60',
            )}
          >
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded border',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border',
              )}
            >
              {on && <Icon name="check" className="size-3" />}
            </span>
            <AgentGlyph agent={agent} className="size-4 rounded-[3px]" />
            {agent.displayName}
          </button>
        )
      })}
    </div>
  )
}

function bundleSummary(bundle: ExportBundle): string {
  return bundle.agents
    .map((a) => {
      const parts = [`${Object.keys(a.files).length} file(s)`]
      if (a.mcpServers) parts.push(`${a.mcpServers.length} MCP`)
      if (a.permissions) {
        const n =
          a.permissions.allow.length +
          a.permissions.deny.length +
          a.permissions.ask.length
        parts.push(`${n} rules`)
      }
      return `${a.agentId}: ${parts.join(', ')}`
    })
    .join(' · ')
}

export function BundlesPage() {
  const allAgents = useAllAgents()
  const allIds = allAgents.map((a) => a.id)

  const [exportSel, setExportSel] = useState<Set<string>>(new Set(allIds))
  const [preview, setPreview] = useState<ExportBundle | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [loaded, setLoaded] = useState<{
    bundle: ExportBundle
    path: string
  } | null>(null)
  const [applySel, setApplySel] = useState<Set<string>>(new Set())
  const [changes, setChanges] = useState<ApplyChange[] | null>(null)
  const [confirmApply, setConfirmApply] = useState(false)

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const doPreview = async () => {
    setBusy(true)
    setNotice(null)
    try {
      setPreview(await ipc.bundlePreview([...exportSel]))
    } finally {
      setBusy(false)
    }
  }

  const doExport = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const { path } = await ipc.bundleExportFile([...exportSel])
      if (path) setNotice({ type: 'success', message: `Exported to ${path}` })
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Export failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const doLoad = async () => {
    setNotice(null)
    setChanges(null)
    const { bundle, path } = await ipc.bundleLoadFile()
    if (!bundle || !path) {
      if (path) {
        setNotice({ type: 'error', message: 'Not a valid Abyss bundle file.' })
      }
      return
    }
    setLoaded({ bundle, path })
    setApplySel(new Set(bundle.agents.map((a) => a.agentId)))
  }

  const doApply = async (dryRun: boolean) => {
    if (!loaded) return
    setBusy(true)
    setConfirmApply(false)
    try {
      const result = await ipc.bundleApply(loaded.bundle, dryRun, [...applySel])
      setChanges(result)
      if (!dryRun) {
        const n = result.filter((c) => c.changed).length
        setNotice({
          type: 'success',
          message: `Applied — ${n} file(s) changed.`,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Bundles"
        description="Export your config and apply it on another machine"
        icon="package"
      />

      {notice && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm',
            notice.type === 'success'
              ? 'border-primary/40 bg-accent'
              : 'border-destructive/40 bg-destructive/10 text-destructive',
          )}
        >
          <span className="flex items-center gap-2">
            <Icon
              name={notice.type === 'success' ? 'circle-check' : 'circle-alert'}
              className="size-4 shrink-0"
            />
            <span className="truncate font-code text-xs">{notice.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      <Tabs
        defaultValue="export"
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList className="self-start">
          <TabsTrigger value="export">
            <Icon name="upload" className="size-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="apply">
            <Icon name="download" className="size-4" />
            Apply
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Agents to include</p>
              <AgentToggles
                ids={allIds}
                selected={exportSel}
                onToggle={(id) => setExportSel((s) => toggle(s, id))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void doPreview()}
                disabled={busy || exportSel.size === 0}
              >
                <Icon name="eye" />
                Preview
              </Button>
              <Button
                onClick={() => void doExport()}
                disabled={busy || exportSel.size === 0}
              >
                <Icon name="upload" />
                Export to file…
              </Button>
            </div>

            {preview && (
              <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
                <p className="mb-2 font-medium">
                  Bundle preview
                  <Badge variant="muted" className="ml-2">
                    {preview.agents.length} agent(s)
                  </Badge>
                </p>
                <p className="font-code text-xs text-muted-foreground">
                  {bundleSummary(preview)}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="apply" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void doLoad()}
            >
              <Icon name="folder-open" />
              Load bundle file…
            </Button>

            {loaded && (
              <>
                <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
                  <p className="truncate font-code text-xs text-muted-foreground">
                    {loaded.path}
                  </p>
                  <p className="mt-1 font-code text-xs">
                    {bundleSummary(loaded.bundle)}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Agents to apply</p>
                  <AgentToggles
                    ids={loaded.bundle.agents.map((a) => a.agentId)}
                    selected={applySel}
                    onToggle={(id) => setApplySel((s) => toggle(s, id))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void doApply(true)}
                    disabled={busy || applySel.size === 0}
                  >
                    <Icon name="eye" />
                    Dry run
                  </Button>
                  <Button
                    onClick={() => setConfirmApply(true)}
                    disabled={busy || applySel.size === 0}
                  >
                    <Icon name="download" />
                    Apply
                  </Button>
                </div>

                {changes && (
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <p className="mb-2 text-sm font-medium">
                      {changes.filter((c) => c.changed).length} of{' '}
                      {changes.length} target(s) differ
                    </p>
                    <div className="flex flex-col gap-1">
                      {changes.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Badge variant="muted">{c.kind}</Badge>
                            <span className="truncate font-code text-muted-foreground">
                              {c.target}
                            </span>
                          </span>
                          <Badge
                            variant={c.changed ? 'warning' : 'success'}
                            className="shrink-0"
                          >
                            {c.changed ? 'changes' : 'same'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        title="Apply this bundle?"
        description="This overwrites the selected agents' real config files. A snapshot of each file is taken first (see History), so changes can be undone."
        confirmLabel="Apply"
        onConfirm={() => void doApply(false)}
      />
    </div>
  )
}
