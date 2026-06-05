import type {
  AgentAdapter,
  AgentDefinition,
  ConfigFileSpec,
  ValidationIssue,
} from '@/shared/types/agent'
import { ipc } from '@/shared/ipc/ipc.client'

export interface AdapterOverrides {
  /** lucide icon name; defaults to the definition's iconName. */
  icon?: string
  validate?: (spec: ConfigFileSpec, content: string) => ValidationIssue[]
  getSidebarSections?: AgentAdapter['getSidebarSections']
}

/**
 * Builds a renderer {@link AgentAdapter} from a framework-agnostic
 * {@link AgentDefinition}. All disk IO is delegated to the main process over
 * typed IPC — adapters never import Node APIs. Adding an agent is therefore a
 * matter of writing a tiny file like this and registering it.
 */
export function createAdapter(
  def: AgentDefinition,
  overrides: AdapterOverrides = {},
): AgentAdapter {
  return {
    id: def.id,
    name: def.name,
    displayName: def.displayName,
    icon: overrides.icon ?? def.iconName,
    defaultThemeId: def.defaultThemeId,
    capabilities: def.capabilities,

    getConfigFileSpecs: () => def.configFiles,
    detectConfigPaths: () => ipc.resolvePaths(def.id),
    readConfig: async (basePath, spec) => {
      const result = await ipc.readAgentConfig(def.id, spec.id, basePath)
      return result.content
    },
    writeConfig: async (basePath, spec, content) => {
      await ipc.writeAgentConfig(def.id, spec.id, basePath, content)
    },
    validate: overrides.validate ?? (() => []),
    getSidebarSections: overrides.getSidebarSections,
  }
}
