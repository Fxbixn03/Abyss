import { create } from 'zustand'

export interface SandboxPromptDraft {
  system: string
  user: string
}

interface SandboxIntentState {
  /** A prompt the prompt-scratchpad should preload (e.g. a subagent to test). */
  pendingPrompt: SandboxPromptDraft | null
  requestPrompt: (draft: SandboxPromptDraft) => void
  /** Take the pending prompt (and clear it), or null. */
  consume: () => SandboxPromptDraft | null

  /** A shell command the command-runner should preload (e.g. a hook to test). */
  pendingCommand: string | null
  requestCommand: (command: string) => void
  /** Take the pending command (and clear it), or null. */
  consumeCommand: () => string | null
}

export const useSandboxIntent = create<SandboxIntentState>((set, get) => ({
  pendingPrompt: null,
  requestPrompt: (draft) => set({ pendingPrompt: draft }),
  consume: () => {
    const p = get().pendingPrompt
    if (p) set({ pendingPrompt: null })
    return p
  },

  pendingCommand: null,
  requestCommand: (command) => set({ pendingCommand: command }),
  consumeCommand: () => {
    const c = get().pendingCommand
    if (c !== null) set({ pendingCommand: null })
    return c
  },
}))
