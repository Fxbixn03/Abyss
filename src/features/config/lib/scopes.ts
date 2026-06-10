import { ipc } from '@/shared/ipc/ipc.client'
import type { AgentId } from '@/shared/types/agent'
import { useSettingsStore } from '@/features/settings/store/settings.store'

export interface InstructionLayer {
  scope: 'global' | 'project'
  base: string
  path: string
  content: string
  exists: boolean
}

async function readOne(
  agentId: AgentId,
  specId: string,
  scope: 'global' | 'project',
  base: string,
): Promise<InstructionLayer> {
  if (!base) return { scope, base, path: '', content: '', exists: false }
  try {
    const r = await ipc.readAgentConfig(agentId, specId, base)
    return { scope, base, path: r.path, content: r.content, exists: r.exists }
  } catch {
    return { scope, base, path: base, content: '', exists: false }
  }
}

/**
 * Read the instruction file for an agent at both the global config dir and the
 * current project dir. The project layer is omitted when no project is active.
 * Mirrors how CLIs merge a global memory file with a project one.
 */
export async function readInstructionLayers(
  agentId: AgentId,
  specId: string,
  projectDir: string | null,
): Promise<InstructionLayer[]> {
  const globalBase = useSettingsStore.getState().getBasePath(agentId)
  const layers: InstructionLayer[] = [
    await readOne(agentId, specId, 'global', globalBase),
  ]
  if (projectDir) {
    layers.push(await readOne(agentId, specId, 'project', projectDir))
  }
  return layers
}
