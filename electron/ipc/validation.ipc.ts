import { IpcChannel } from '@/shared/types/ipc'
import { getAgentDefinition } from '@/shared/agents/defs'
import { runValidation } from '@core/validation'
import { handle } from './handle'

export function registerValidationIpc(): void {
  handle(IpcChannel.ValidateConfig, async ({ agents }) => {
    const inputs = agents.map(({ agentId, basePath }) => ({
      def: getAgentDefinition(agentId),
      basePath,
    }))
    return runValidation(inputs)
  })
}
