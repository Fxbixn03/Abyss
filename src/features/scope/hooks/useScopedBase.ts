import type { AgentId } from '@/shared/types/agent'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { useScopeStore } from '../store/scope.store'

/** Join an absolute base with a child segment, guessing the OS separator. */
export function joinPath(base: string, seg: string): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return `${base.replace(/[/\\]+$/, '')}${sep}${seg}`
}

export function useScope() {
  const scope = useScopeStore((s) => s.scope)
  const projectDir = useScopeStore((s) => s.projectDir)
  return { scope, projectDir }
}

/**
 * Base dir for `.<agent>`-style surfaces (collections, permissions, model/env,
 * hooks, raw settings). Global → the detected global config dir; project →
 * `<projectDir>/.<agentId>`.
 */
export function useConfigBase(agentId: AgentId): string {
  const globalBase = useBasePath(agentId)
  const { scope, projectDir } = useScope()
  if (scope === 'global') return globalBase
  return projectDir ? joinPath(projectDir, `.${agentId}`) : ''
}

/**
 * Base dir for the instruction file (CLAUDE.md / AGENTS.md / GEMINI.md). Global
 * → the global config dir; project → the project root itself.
 */
export function useInstructionsBase(agentId: AgentId): string {
  const globalBase = useBasePath(agentId)
  const { scope, projectDir } = useScope()
  if (scope === 'global') return globalBase
  return projectDir ?? ''
}

/** The project dir to pass to project-aware IO (MCP), or undefined in global. */
export function useProjectDir(): string | undefined {
  const { scope, projectDir } = useScope()
  return scope === 'project' ? (projectDir ?? undefined) : undefined
}
