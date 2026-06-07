import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
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
  onClick,
}: {
  icon: string
  label: string
  value: string
  on: boolean
  /** When set, the chip becomes an interactive button that navigates. */
  onClick?: () => void
}) {
  const interactive = Boolean(onClick)
  return (
    <Card
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'flex items-center gap-2.5 p-3',
        interactive &&
          'cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
      )}
    >
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
      {interactive && (
        <Icon
          name="chevron-right"
          className="ml-1 size-4 shrink-0 text-muted-foreground"
        />
      )}
    </Card>
  )
}

/** A live "what's running" panel: live chat + MCP server status. */
export function StatusPreview() {
  const navigate = useNavigate()
  const agent = useActiveAgent()
  const liveId = useChatsStore((s) => s.liveId)
  const status = useChatsStore((s) => s.status)
  const servers = useMcpStore((s) => s.servers)
  const health = useMcpStore((s) => s.health)
  const loadMcp = useMcpStore((s) => s.load)
  const basePath = useConfigBase(agent.id)
  const projectDir = useProjectDir()

  const hasMcp = agent.capabilities.mcp

  // Pull the server list from the shared MCP store (single source of truth) for
  // the active agent + scope; the store dedups/guards stale responses.
  useEffect(() => {
    if (hasMcp && basePath) void loadMcp(agent.id, basePath, projectDir)
  }, [hasMcp, agent.id, basePath, projectDir, loadMcp])

  const enabledMcp = servers.filter((s) => s.enabled)
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
            onClick={() => navigate('/chats')}
          />
        )}
        {hasMcp && enabledMcp.length > 0 && (
          <StatusChip
            icon="plug"
            label="MCP servers"
            value={`${onlineMcp}/${enabledMcp.length} online`}
            on={onlineMcp > 0}
            onClick={() => navigate('/mcp')}
          />
        )}
      </div>
    </section>
  )
}
