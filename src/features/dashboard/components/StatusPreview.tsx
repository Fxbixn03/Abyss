import { useEffect, useState } from 'react'
import type { McpServerEntry } from '@/shared/types/config'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useChatsStore } from '@/features/chats/store/chats.store'
import { useMcpStore } from '@/features/mcp/store/mcp.store'
import {
  useConfigBase,
  useProjectDir,
} from '@/features/scope/hooks/useScopedBase'

function StatusChip({
  icon,
  label,
  value,
  on,
}: {
  icon: string
  label: string
  value: string
  on: boolean
}) {
  return (
    <Card className="flex items-center gap-2.5 p-3">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          on ? 'bg-success' : 'bg-muted-foreground/40',
        )}
      />
      <Icon name={icon} className="size-4 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </Card>
  )
}

/** A live "what's running" panel: live chat + MCP server status. */
export function StatusPreview() {
  const agent = useActiveAgent()
  const liveId = useChatsStore((s) => s.liveId)
  const status = useChatsStore((s) => s.status)
  const health = useMcpStore((s) => s.health)
  const basePath = useConfigBase(agent.id)
  const projectDir = useProjectDir()
  const [mcp, setMcp] = useState<McpServerEntry[]>([])

  const hasMcp = agent.capabilities.mcp

  useEffect(() => {
    if (!hasMcp || !basePath) return
    let active = true
    void ipc.getMcpServers(agent.id, basePath, projectDir).then((list) => {
      if (active) setMcp(list)
    })
    return () => {
      active = false
    }
  }, [agent.id, basePath, projectDir, hasMcp])

  const enabledMcp = mcp.filter((s) => s.enabled)
  const onlineMcp = enabledMcp.filter((s) => {
    const h = health[s.id]
    return h && !('loading' in h) && h.ok
  }).length

  const liveActive = liveId !== null

  if (!liveActive && enabledMcp.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
      <div className="flex flex-wrap gap-3">
        {agent.capabilities.chats && (
          <StatusChip
            icon="messages-square"
            label="Live chat"
            value={
              liveActive
                ? status === 'streaming'
                  ? 'streaming…'
                  : 'active'
                : 'idle'
            }
            on={liveActive}
          />
        )}
        {hasMcp && enabledMcp.length > 0 && (
          <StatusChip
            icon="plug"
            label="MCP servers"
            value={`${onlineMcp}/${enabledMcp.length} online`}
            on={onlineMcp > 0}
          />
        )}
      </div>
    </section>
  )
}
