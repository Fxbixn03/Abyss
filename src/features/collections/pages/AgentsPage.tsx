import { useActiveAgentId } from '@/features/agents/hooks/useActiveAgent'
import { CodexSubagentsPage } from '@/features/subagents/pages/CodexSubagentsPage'
import { CollectionManager } from '../components/CollectionManager'

export function AgentsPage() {
  const agentId = useActiveAgentId()
  // Codex subagents are TOML files with their own shape, not markdown
  // collections — they get a dedicated editor (cf. PermissionsPage → Codex).
  if (agentId === 'codex') return <CodexSubagentsPage />
  return <CollectionManager kind="agents" icon="bot" />
}
