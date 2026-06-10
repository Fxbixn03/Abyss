import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Markdown } from '@/shared/components/Markdown'
import { Icon } from '@/shared/components/Icon'
import type { AgentAdapter } from '@/shared/types/agent'
import { estimateTokens, formatTokens } from '@/features/context/lib/tokens'
import { readInstructionLayers, type InstructionLayer } from '../lib/scopes'

const SCOPE_LABEL = { global: 'Global', project: 'Project' } as const

/**
 * Read-only view of what the agent actually reads for its instructions: the
 * global memory file followed by the project one (when a project is active),
 * each with its token estimate.
 */
export function EffectiveInstructionsDialog({
  open,
  onOpenChange,
  agent,
  projectDir,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agent: AgentAdapter
  projectDir: string | null
}) {
  const [layers, setLayers] = useState<InstructionLayer[] | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    const spec = agent.getConfigFileSpecs()[0]
    const load = spec
      ? readInstructionLayers(agent.id, spec.id, projectDir)
      : Promise.resolve<InstructionLayer[]>([])
    void load.then((res) => {
      if (active) setLayers(res)
    })
    return () => {
      active = false
    }
  }, [open, agent, projectDir])

  const present = (layers ?? []).filter((l) => l.content.trim().length > 0)
  const totalTokens = present.reduce((n, l) => n + estimateTokens(l.content), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Effective instructions
            <Badge variant="muted">~{formatTokens(totalTokens)} tokens</Badge>
          </DialogTitle>
          <DialogDescription>
            What {agent.displayName} reads, in order. Global first, then the
            active project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {layers === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : present.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No instructions found in either scope.
            </p>
          ) : (
            present.map((layer) => (
              <section
                key={layer.scope}
                className="rounded-md border border-border"
              >
                <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon name="file-text" className="size-3.5" />
                    {SCOPE_LABEL[layer.scope]}
                    <span className="font-code text-[10px] text-muted-foreground">
                      {layer.path}
                    </span>
                  </span>
                  <Badge variant="muted" className="shrink-0">
                    ~{formatTokens(estimateTokens(layer.content))}
                  </Badge>
                </header>
                <div className="max-h-[40vh] overflow-y-auto p-4">
                  <Markdown content={layer.content} />
                </div>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
