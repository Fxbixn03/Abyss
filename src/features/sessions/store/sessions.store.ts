import { create } from 'zustand'
import type { AgentId } from '@/shared/types/agent'
import type { ChatMessage, ChatSessionMeta } from '@/shared/types/chat'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'

/** Upper bound on sessions pulled into the explorer at once. */
const MAX_SESSIONS = 500

interface SessionsState {
  agentId: AgentId | null
  sessions: ChatSessionMeta[]
  loading: boolean
  /** Currently opened session (detail view), or null for the list. */
  selectedId: string | null
  transcript: ChatMessage[]
  transcriptLoading: boolean

  load: (agentId: AgentId, cwd?: string) => Promise<void>
  open: (sessionId: string) => Promise<void>
  close: () => void
}

export const useSessionsStore = create<SessionsState>()((set, get) => ({
  agentId: null,
  sessions: [],
  loading: false,
  selectedId: null,
  transcript: [],
  transcriptLoading: false,

  load: async (agentId, cwd) => {
    set({ agentId, loading: true, selectedId: null, transcript: [] })
    try {
      const page = await ipc.chatListSessions(agentId, {
        limit: MAX_SESSIONS,
        cwd,
      })
      // Drop a stale response if the agent changed while we were loading.
      if (get().agentId !== agentId) return
      set({ sessions: page.sessions, loading: false })
    } catch (err) {
      if (get().agentId === agentId) set({ loading: false })
      reportError(err, { title: "Couldn't load sessions" })
    }
  },

  open: async (sessionId) => {
    const { agentId } = get()
    if (!agentId) return
    set({ selectedId: sessionId, transcript: [], transcriptLoading: true })
    try {
      const transcript = await ipc.chatReadSession(agentId, sessionId)
      // Ignore if the user navigated to another session meanwhile.
      if (get().selectedId !== sessionId) return
      set({ transcript: transcript.messages, transcriptLoading: false })
    } catch (err) {
      if (get().selectedId === sessionId) set({ transcriptLoading: false })
      reportError(err, { title: "Couldn't open the session" })
    }
  },

  close: () => set({ selectedId: null, transcript: [] }),
}))
