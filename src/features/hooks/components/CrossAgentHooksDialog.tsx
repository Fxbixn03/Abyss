import { useEffect, useState } from 'react'
import type { AgentAdapter } from '@/shared/types/agent'
import type { HookEntry } from '@/shared/types/hooks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'

interface AgentHooks {
  agent: AgentAdapter
  hooks: HookEntry[]
}

export interface CrossAgentHooksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Enabled agents that support hooks. */
  agents: AgentAdapter[]
  /** Resolve an agent's config base for the active scope. */
  baseFor: (agentId: string) => string
  scopeLabel: string
}

/**
 * "What runs automatically across all my agents?" — reads every hook-capable
 * agent's active hooks for the current scope and lists them in one place.
 */
export function CrossAgentHooksDialog({
  open,
  onOpenChange,
  agents,
  baseFor,
  scopeLabel,
}: CrossAgentHooksDialogProps) {
  const [data, setData] = useState<AgentHooks[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    void Promise.all(
      agents.map(async (agent) => {
        const base = baseFor(agent.id)
        const hooks = base
          ? await ipc.getHooks(agent.id, base).catch(() => [])
          : []
        return { agent, hooks }
      }),
    ).then((rows) => {
      if (!active) return
      setData(rows)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [open, agents, baseFor])

  const total = data.reduce((n, d) => n + d.hooks.length, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What runs automatically</DialogTitle>
          <DialogDescription>
            Active hooks across every agent in the {scopeLabel} scope
            {loaded ? ` · ${total} total` : ''}.
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.map(({ agent, hooks }) => (
              <section key={agent.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon name={agent.icon} className="size-4" />
                  <h3 className="text-sm font-medium">{agent.displayName}</h3>
                  <Badge variant="muted" className="font-code">
                    {hooks.length}
                  </Badge>
                </div>
                {hooks.length === 0 ? (
                  <p className="pl-6 text-xs text-muted-foreground">
                    No hooks configured.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1 pl-6">
                    {hooks.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Badge variant="secondary" className="font-code">
                          {h.event}
                        </Badge>
                        {h.matcher && (
                          <span className="font-code text-foreground/70">
                            {h.matcher}
                          </span>
                        )}
                        <code className="min-w-0 flex-1 truncate font-code">
                          {h.command}
                        </code>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
