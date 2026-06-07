import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useUsageStore } from '../store/usage.store'

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-base font-semibold leading-none">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

/**
 * Abyss' core idea — every agent in one place — made visible: a single line that
 * sums usage across all chat-capable agents, in addition to the active agent's
 * own panel. Fed from the same cached aggregate the agent grid already loads.
 */
export function CrossAgentSummary() {
  const agents = useAllAgents()
  const byAgent = useUsageStore((s) => s.byAgent)

  const chatAgents = agents.filter((a) => a.capabilities.chats)
  // With a single chat agent the active-agent Usage panel already says it all.
  if (chatAgents.length < 2) return null

  let sessions = 0
  let messages = 0
  let tokens = 0
  let agentsWithData = 0
  for (const a of chatAgents) {
    const stats = byAgent[a.id]?.stats
    if (!stats) continue
    if (stats.totalSessions > 0) agentsWithData += 1
    sessions += stats.totalSessions
    messages += stats.totalMessages
    tokens += stats.inputTokens + stats.outputTokens
  }
  if (sessions === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">All agents</h2>
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <Metric
          icon="layers"
          label={`agent${agentsWithData === 1 ? '' : 's'} active`}
          value={compact(agentsWithData)}
        />
        <Metric
          icon="messages-square"
          label="sessions"
          value={compact(sessions)}
        />
        <Metric icon="file-text" label="messages" value={compact(messages)} />
        <Metric icon="cpu" label="tokens" value={compact(tokens)} />
      </Card>
    </section>
  )
}
