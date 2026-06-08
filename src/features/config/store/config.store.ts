import { create } from 'zustand'
import type {
  AgentId,
  ConfigFileSpec,
  ValidationIssue,
} from '@/shared/types/agent'
import { ipc } from '@/shared/ipc/ipc.client'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { reportError } from '@/shared/lib/errors'

interface ConfigEditorState {
  agentId: AgentId | null
  spec: ConfigFileSpec | null
  basePath: string
  filePath: string
  fileExists: boolean
  original: string
  draft: string
  loading: boolean
  saving: boolean
  issues: ValidationIssue[]

  open: (
    agentId: AgentId,
    spec: ConfigFileSpec,
    basePath: string,
  ) => Promise<void>
  setDraft: (value: string) => void
  save: () => Promise<{ path: string }>
  revert: () => void
  isDirty: () => boolean
  /** Re-read the open file from disk into original + draft. */
  reload: () => Promise<void>
}

function validate(
  agentId: AgentId,
  spec: ConfigFileSpec,
  content: string,
): ValidationIssue[] {
  if (!agentRegistry.has(agentId)) return []
  return agentRegistry.get(agentId).validate(spec, content)
}

export const useConfigStore = create<ConfigEditorState>()((set, get) => ({
  agentId: null,
  spec: null,
  basePath: '',
  filePath: '',
  fileExists: false,
  original: '',
  draft: '',
  loading: false,
  saving: false,
  issues: [],

  open: async (agentId, spec, basePath) => {
    set({ agentId, spec, basePath, loading: true })
    try {
      const result = await ipc.readAgentConfig(agentId, spec.id, basePath)
      // Guard against a stale response if the user switched files meanwhile.
      if (get().spec?.id !== spec.id || get().agentId !== agentId) return
      set({
        original: result.content,
        draft: result.content,
        filePath: result.path,
        fileExists: result.exists,
        issues: validate(agentId, spec, result.content),
        loading: false,
      })
    } catch (err) {
      if (get().spec?.id === spec.id && get().agentId === agentId) {
        set({ loading: false })
      }
      reportError(err, { title: `Couldn't open ${spec.filename}` })
    }
  },

  setDraft: (value) => {
    const { agentId, spec } = get()
    set({
      draft: value,
      issues: agentId && spec ? validate(agentId, spec, value) : [],
    })
  },

  save: async () => {
    const { agentId, spec, basePath, draft } = get()
    if (!agentId || !spec) throw new Error('No config file open')
    set({ saving: true })
    try {
      const result = await ipc.writeAgentConfig(
        agentId,
        spec.id,
        basePath,
        draft,
      )
      set({ original: draft, fileExists: true })
      return { path: result.path }
    } catch (err) {
      reportError(err, { title: `Couldn't save ${spec.filename}` })
      throw err
    } finally {
      set({ saving: false })
    }
  },

  revert: () => {
    const { agentId, spec, original } = get()
    set({
      draft: original,
      issues: agentId && spec ? validate(agentId, spec, original) : [],
    })
  },

  isDirty: () => get().draft !== get().original,

  reload: async () => {
    const { agentId, spec, basePath } = get()
    if (!agentId || !spec) return
    try {
      const result = await ipc.readAgentConfig(agentId, spec.id, basePath)
      set({
        original: result.content,
        draft: result.content,
        filePath: result.path,
        fileExists: result.exists,
        issues: validate(agentId, spec, result.content),
      })
    } catch (err) {
      reportError(err, { title: `Couldn't reload ${spec.filename}` })
    }
  },
}))
