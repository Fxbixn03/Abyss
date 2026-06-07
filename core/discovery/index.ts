/**
 * Discovery entry point. Registers every provider and re-exports the search
 * dispatcher used by the IPC handler. Add new providers' `registerProvider`
 * calls here as new discoverable areas come online.
 */

import { registerProvider, runDiscoverySearch } from './provider'
import { mcpOfficialProvider } from './mcp-official.provider'
import { a2aRegistryProvider } from './a2a-registry.provider'
import { aiAgentsDirectoryProvider } from './ai-agents-directory.provider'

registerProvider(mcpOfficialProvider)
registerProvider(a2aRegistryProvider)
registerProvider(aiAgentsDirectoryProvider)

export { runDiscoverySearch }
