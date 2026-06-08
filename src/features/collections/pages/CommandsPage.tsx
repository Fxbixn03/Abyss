import { useActiveAgentId } from '@/features/agents/hooks/useActiveAgent'
import { GeminiCommandsPage } from '@/features/gemini-commands/pages/GeminiCommandsPage'
import { CollectionManager } from '../components/CollectionManager'

export function CommandsPage() {
  const agentId = useActiveAgentId()
  // Gemini commands are grouped TOML files with their own shape, not markdown
  // collections — they get a dedicated editor (cf. AgentsPage → Codex).
  if (agentId === 'gemini') return <GeminiCommandsPage />
  return <CollectionManager kind="commands" icon="square-slash" />
}
