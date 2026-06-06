import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { McpServerEntry } from '@/shared/types/config'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useConfigBase,
  useProjectDir,
} from '@/features/scope/hooks/useScopedBase'
import { useMcpStore } from '../store/mcp.store'
import { McpServerList } from '../components/McpServerList'
import { McpServerForm } from '../components/McpServerForm'
import { McpCatalogDialog } from '../components/McpCatalogDialog'

export function McpPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const projectDir = useProjectDir()
  const navigate = useNavigate()

  const servers = useMcpStore((s) => s.servers)
  const loading = useMcpStore((s) => s.loading)
  const health = useMcpStore((s) => s.health)
  const load = useMcpStore((s) => s.load)
  const upsert = useMcpStore((s) => s.upsert)
  const remove = useMcpStore((s) => s.remove)
  const toggle = useMcpStore((s) => s.toggle)
  const test = useMcpStore((s) => s.test)

  const [formOpen, setFormOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [editing, setEditing] = useState<McpServerEntry | undefined>()

  const supported = agent.capabilities.mcp

  useEffect(() => {
    if (supported && basePath) void load(agent.id, basePath, projectDir)
  }, [supported, agent.id, basePath, projectDir, load])

  // Auto-check each server's status once (per app session) so the list shows
  // online/offline without a manual click.
  useEffect(() => {
    for (const server of servers) {
      if (!useMcpStore.getState().health[server.id]) void test(server)
    }
  }, [servers, test])

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
        description="User-scoped servers, auto-detected from ~/.claude.json"
        icon="plug"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCatalogOpen(true)}
              disabled={!basePath}
            >
              <Icon name="package" />
              Catalog
            </Button>
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
          </div>
        }
      />

      <p className="-mt-1 text-xs text-muted-foreground">
        claude.ai connectors (Google Drive, etc.) are managed in your Claude
        account and aren't editable here.
      </p>

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
            health={health}
            onToggle={(id) => void toggle(id)}
            onRemove={(id) => void remove(id)}
            onTest={(server) => void test(server)}
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

      <McpCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        existingNames={servers.map((s) => s.name)}
        onPick={(entry) => {
          setEditing(entry)
          setFormOpen(true)
        }}
      />
    </div>
  )
}
