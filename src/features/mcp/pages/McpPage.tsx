import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { McpServerEntry } from '@/shared/types/config'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { useMcpStore } from '../store/mcp.store'
import { McpServerList } from '../components/McpServerList'
import { McpServerForm } from '../components/McpServerForm'

export function McpPage() {
  const agent = useActiveAgent()
  const basePath = useBasePath(agent.id)
  const navigate = useNavigate()

  const servers = useMcpStore((s) => s.servers)
  const loading = useMcpStore((s) => s.loading)
  const load = useMcpStore((s) => s.load)
  const upsert = useMcpStore((s) => s.upsert)
  const remove = useMcpStore((s) => s.remove)
  const toggle = useMcpStore((s) => s.toggle)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<McpServerEntry | undefined>()

  const supported = agent.capabilities.mcp

  useEffect(() => {
    if (supported && basePath) void load(agent.id, basePath)
  }, [supported, agent.id, basePath, load])

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="MCP Servers" icon="plug" />
        <EmptyState
          icon="plug"
          title={`${agent.displayName} has no MCP support`}
          description="Switch to an agent that supports the Model Context Protocol to manage servers."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="MCP Servers"
        description={`Model Context Protocol servers for ${agent.displayName}`}
        icon="plug"
        actions={
          <Button
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
            disabled={!basePath}
          >
            <Icon name="plus" />
            Add server
          </Button>
        }
      />

      {!basePath ? (
        <EmptyState
          icon="folder"
          title="No config location set"
          description="Set a config directory in Settings to manage MCP servers."
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              Open Settings
            </Button>
          }
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : servers.length === 0 ? (
        <EmptyState
          icon="plug"
          title="No MCP servers yet"
          description="Add a server to expose tools and resources to the agent."
          action={
            <Button
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Icon name="plus" />
              Add server
            </Button>
          }
        />
      ) : (
        <div className="overflow-y-auto">
          <McpServerList
            servers={servers}
            onToggle={(id) => void toggle(id)}
            onRemove={(id) => void remove(id)}
            onEdit={(server) => {
              setEditing(server)
              setFormOpen(true)
            }}
          />
        </div>
      )}

      <McpServerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={(entry) => void upsert(entry)}
      />
    </div>
  )
}
