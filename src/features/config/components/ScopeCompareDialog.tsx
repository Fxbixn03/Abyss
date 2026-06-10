import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { LineDiffView } from '@/shared/components/LineDiffView'
import type { AgentAdapter } from '@/shared/types/agent'
import { readInstructionLayers, type InstructionLayer } from '../lib/scopes'

/**
 * Side-by-side diff of an agent's instruction file between the global and
 * project scope, so it's clear what the project layer adds or overrides.
 */
export function ScopeCompareDialog({
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
  const [sides, setSides] = useState<{
    global: string
    project: string
  } | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    const spec = agent.getConfigFileSpecs()[0]
    const load = spec
      ? readInstructionLayers(agent.id, spec.id, projectDir)
      : Promise.resolve<InstructionLayer[]>([])
    void load.then((layers) => {
      if (!active) return
      setSides({
        global: layers.find((l) => l.scope === 'global')?.content ?? '',
        project: layers.find((l) => l.scope === 'project')?.content ?? '',
      })
    })
    return () => {
      active = false
    }
  }, [open, agent, projectDir])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Compare global ↔ project</DialogTitle>
          <DialogDescription>
            {agent.displayName} instructions in each scope.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          {sides === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : (
            <LineDiffView
              a={sides.global}
              b={sides.project}
              leftLabel="Global"
              rightLabel="Project"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
