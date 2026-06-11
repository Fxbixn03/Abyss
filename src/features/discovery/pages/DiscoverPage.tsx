import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import {
  isAgentEnabled,
  useAgentEnabled,
} from '@/features/agents/store/agent-enabled.store'
import { useAgentAvailability } from '@/features/agents/store/agent-availability.store'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { INSTALL_HINTS } from '../lib/discovery'

interface AgentFind {
  id: string
  displayName: string
  installed: boolean
  version?: string
  configFound: boolean
  enabled: boolean
}

interface McpFind {
  name: string
  foundIn: string[]
}

export function DiscoverPage() {
  const navigate = useNavigate()
  const activeAgent = useActiveAgent()
  const enabledMap = useAgentEnabled((s) => s.enabled)
  const setEnabled = useAgentEnabled((s) => s.setEnabled)
  const refreshAvailability = useAgentAvailability((s) => s.refresh)
  const getBasePath = useSettingsStore((s) => s.getBasePath)

  const [agentFinds, setAgentFinds] = useState<AgentFind[]>([])
  const [mcpFinds, setMcpFinds] = useState<McpFind[]>([])
  const [loading, setLoading] = useState(true)
  const [rescan, setRescan] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const scan = async () => {
      setLoading(true)
      const all = agentRegistry.getAll()

      const finds: AgentFind[] = []
      for (const a of all) {
        const status = await ipc.agentInstallStatus(a.id).catch(() => ({
          installed: false,
        }))
        const paths = await ipc.resolvePaths(a.id).catch(() => [])
        finds.push({
          id: a.id,
          displayName: a.displayName,
          installed: status.installed,
          version: 'version' in status ? status.version : undefined,
          configFound: paths.some((p) => p.exists),
          enabled: isAgentEnabled(enabledMap, a.id),
        })
      }

      // Discover MCP servers configured in other agents but not in the active one.
      const byName = new Map<string, Set<string>>()
      const activeNames = new Set<string>()
      for (const a of all) {
        if (!a.capabilities.mcp) continue
        const base = getBasePath(a.id)
        if (!base) continue
        const servers = await ipc.getMcpServers(a.id, base).catch(() => [])
        for (const s of servers.filter((x) => x.enabled)) {
          if (a.id === activeAgent.id) activeNames.add(s.name)
          const set = byName.get(s.name) ?? new Set<string>()
          set.add(a.displayName)
          byName.set(s.name, set)
        }
      }
      const mcp: McpFind[] = []
      for (const [name, agents] of byName) {
        if (activeNames.has(name)) continue
        mcp.push({ name, foundIn: [...agents] })
      }

      if (active) {
        setAgentFinds(finds)
        setMcpFinds(mcp)
        setLoading(false)
      }
    }
    void scan()
    return () => {
      active = false
    }
  }, [enabledMap, getBasePath, activeAgent.id, rescan])

  const toEnable = agentFinds.filter(
    (f) => !f.enabled && (f.installed || f.configFound),
  )
  const toInstall = agentFinds.filter((f) => f.enabled && !f.installed)

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(text)
    window.setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500)
  }

  const nothing =
    !loading &&
    toEnable.length === 0 &&
    toInstall.length === 0 &&
    mcpFinds.length === 0

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Discover"
        description="Agents, CLIs and MCP servers found on this machine"
        icon="scan-search"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refreshAvailability()
              setRescan((n) => n + 1)
            }}
            disabled={loading}
          >
            <Icon
              name={loading ? 'loader' : 'refresh-cw'}
              className={loading ? 'animate-spin' : ''}
            />
            Rescan
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Scanning…</p>
        ) : nothing ? (
          <EmptyState
            icon="scan-search"
            title="Nothing new to discover"
            description="Every agent found on your system is already set up, and no extra MCP servers were found."
          />
        ) : (
          <>
            {toEnable.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Found on your system, not yet enabled
                </h2>
                {toEnable.map((f) => (
                  <Card
                    key={f.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {f.displayName}
                        {f.installed && (
                          <Badge variant="success" className="font-code">
                            CLI{f.version ? ` ${f.version}` : ''}
                          </Badge>
                        )}
                        {f.configFound && (
                          <Badge variant="muted">config found</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Enable it to manage its config in Abyss.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setEnabled(f.id, true)}>
                      <Icon name="plus" />
                      Enable
                    </Button>
                  </Card>
                ))}
              </section>
            )}

            {toInstall.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Enabled but not installed
                </h2>
                {toInstall.map((f) => {
                  const hint = INSTALL_HINTS[f.id]
                  return (
                    <Card key={f.id} className="space-y-2 p-3">
                      <p className="font-medium">{f.displayName}</p>
                      {hint?.command ? (
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-code text-xs">
                            {hint.command}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copy(hint.command as string)}
                          >
                            <Icon
                              name={copied === hint.command ? 'check' : 'copy'}
                            />
                            {copied === hint.command ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                      ) : hint?.url ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void ipc.openExternal(hint.url as string)}
                        >
                          <Icon name="external-link" />
                          Download
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No install hint available.
                        </p>
                      )}
                    </Card>
                  )
                })}
              </section>
            )}

            {mcpFinds.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  MCP servers in other agents
                </h2>
                {mcpFinds.map((m) => (
                  <Card
                    key={m.name}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        <Icon name="plug" className="size-4" />
                        {m.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Configured in {m.foundIn.join(', ')}, not in{' '}
                        {activeAgent.displayName}.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/compare')}
                    >
                      <Icon name="git-compare" />
                      Compare
                    </Button>
                  </Card>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
