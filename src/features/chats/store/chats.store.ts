import { create } from 'zustand'
import { IpcEvent } from '@/shared/types/ipc'
import type { ChatExportFormat } from '@/shared/types/ipc'
import type { AgentId } from '@/shared/types/agent'
import type {
  ChatAvailability,
  ChatBlock,
  ChatMessage,
  ChatPermissionMode,
  ChatSessionMeta,
  ChatStreamEnvelope,
  ChatUsage,
} from '@/shared/types/chat'
import { ipc } from '@/shared/ipc/ipc.client'
import { genId } from '@/shared/lib/id'
import { reportError } from '@/shared/lib/errors'
import { appendDelta, appendBlock } from './stream-reducer'

/** Sessions fetched per page for infinite scroll. */
const SESSIONS_PAGE_SIZE = 20

export interface SendOptions {
  cwd: string
  model?: string
  permissionMode: ChatPermissionMode
  apiKey?: string
}

type LiveStatus = 'idle' | 'starting' | 'streaming'

interface ChatsState {
  agentId: AgentId | null
  availability: ChatAvailability | null
  availabilityLoading: boolean

  sessions: ChatSessionMeta[]
  sessionsLoading: boolean
  /** Total sessions matching the current filter (for "load more"). */
  sessionsTotal: number
  /** A follow-up page is being fetched. */
  sessionsLoadingMore: boolean
  /** When set, only sessions under this project dir are listed. */
  cwdFilter: string | undefined

  /** Selected history session id, or null for a fresh chat. */
  activeSessionId: string | null
  title: string
  cwd: string
  messages: ChatMessage[]
  transcriptLoading: boolean

  liveId: string | null
  /** Agent-native session id of the live conversation (for resume). */
  liveSessionId: string | undefined
  status: LiveStatus
  usage: ChatUsage | undefined
  currentMessageId: string | null
  error: string | null
  /** Optional API key (session-only, never persisted) for live runs. */
  apiKey: string | undefined

  init: (agentId: AgentId, cwdFilter?: string) => Promise<void>
  refreshSessions: () => Promise<void>
  loadMoreSessions: () => Promise<void>
  checkAvailability: () => Promise<void>
  login: (persist: boolean, apiKey?: string) => Promise<ChatAvailability>
  logout: () => Promise<void>
  openSession: (sessionId: string) => Promise<void>
  newChat: (cwd: string) => void
  send: (text: string, options: SendOptions) => Promise<void>
  interrupt: () => Promise<void>
  stopLive: () => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  exportSession: (sessionId: string, format: ChatExportFormat) => Promise<void>
  handleStreamEvent: (envelope: ChatStreamEnvelope) => void
}

export const useChatsStore = create<ChatsState>()((set, get) => ({
  agentId: null,
  availability: null,
  availabilityLoading: false,
  sessions: [],
  sessionsLoading: false,
  sessionsTotal: 0,
  sessionsLoadingMore: false,
  cwdFilter: undefined,
  activeSessionId: null,
  title: '',
  cwd: '',
  messages: [],
  transcriptLoading: false,
  liveId: null,
  liveSessionId: undefined,
  status: 'idle',
  usage: undefined,
  currentMessageId: null,
  error: null,
  apiKey: undefined,

  init: async (agentId, cwdFilter) => {
    if (get().agentId !== agentId) {
      set({
        agentId,
        sessions: [],
        sessionsTotal: 0,
        cwdFilter,
        activeSessionId: null,
        messages: [],
        title: '',
        liveId: null,
        liveSessionId: undefined,
        status: 'idle',
        usage: undefined,
        error: null,
      })
    } else if (get().cwdFilter !== cwdFilter) {
      set({ cwdFilter, sessions: [], sessionsTotal: 0 })
    }
    await Promise.all([get().checkAvailability(), get().refreshSessions()])
  },

  checkAvailability: async () => {
    const agentId = get().agentId
    if (!agentId) return
    set({ availabilityLoading: true })
    try {
      const availability = await ipc.chatAvailability(agentId)
      set({ availability })
    } catch (err) {
      reportError(err, { title: "Couldn't check chat availability" })
    } finally {
      set({ availabilityLoading: false })
    }
  },

  refreshSessions: async () => {
    const agentId = get().agentId
    if (!agentId) return
    set({ sessionsLoading: true })
    try {
      // Reload the first page, but keep the window as large as what's already
      // visible so a refresh (e.g. after a turn) doesn't collapse the scroll.
      const limit = Math.max(SESSIONS_PAGE_SIZE, get().sessions.length)
      const page = await ipc.chatListSessions(agentId, {
        offset: 0,
        limit,
        cwd: get().cwdFilter,
      })
      set({ sessions: page.sessions, sessionsTotal: page.total })
    } catch (err) {
      reportError(err, { title: "Couldn't load chat history" })
    } finally {
      set({ sessionsLoading: false })
    }
  },

  loadMoreSessions: async () => {
    const agentId = get().agentId
    if (!agentId || get().sessionsLoadingMore) return
    const loaded = get().sessions.length
    if (loaded >= get().sessionsTotal) return
    set({ sessionsLoadingMore: true })
    try {
      const page = await ipc.chatListSessions(agentId, {
        offset: loaded,
        limit: SESSIONS_PAGE_SIZE,
        cwd: get().cwdFilter,
      })
      // Dedupe by id (page boundaries can overlap) and keep recency order.
      const byId = new Map<string, ChatSessionMeta>()
      for (const s of [...get().sessions, ...page.sessions]) byId.set(s.id, s)
      const merged = [...byId.values()].sort((a, b) =>
        (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
      )
      set({ sessions: merged, sessionsTotal: page.total })
    } catch (err) {
      reportError(err, { title: "Couldn't load more sessions" })
    } finally {
      set({ sessionsLoadingMore: false })
    }
  },

  login: async (persist, apiKey) => {
    const agentId = get().agentId
    if (!agentId) throw new Error('No agent selected')
    try {
      const availability = await ipc.chatLogin(agentId, persist, apiKey)
      // Keep the key in memory (not persisted) so live runs can use it.
      set({ availability, apiKey: apiKey || get().apiKey })
      return availability
    } catch (err) {
      reportError(err, { title: 'Login failed' })
      throw err
    }
  },

  logout: async () => {
    const agentId = get().agentId
    if (!agentId) return
    try {
      await ipc.chatLogout(agentId)
      set({ apiKey: undefined })
      await get().checkAvailability()
    } catch (err) {
      reportError(err, { title: 'Logout failed' })
    }
  },

  openSession: async (sessionId) => {
    const agentId = get().agentId
    if (!agentId) return
    // Stop any live process bound to the conversation we are leaving.
    const prevLive = get().liveId
    if (prevLive) void ipc.chatStop(prevLive)
    set({
      transcriptLoading: true,
      activeSessionId: sessionId,
      // Tear down any live session bound to the previous conversation.
      liveId: null,
      liveSessionId: sessionId,
      status: 'idle',
      messages: [],
      error: null,
    })
    try {
      const t = await ipc.chatReadSession(agentId, sessionId)
      // Ignore if the user switched sessions while loading.
      if (get().activeSessionId !== sessionId) return
      set({
        messages: t.messages,
        title: t.title,
        cwd: t.cwd,
        transcriptLoading: false,
      })
    } catch (err) {
      if (get().activeSessionId === sessionId) set({ transcriptLoading: false })
      reportError(err, { title: "Couldn't open session" })
    }
  },

  newChat: (cwd) => {
    const prevLive = get().liveId
    if (prevLive) void ipc.chatStop(prevLive)
    set({
      activeSessionId: null,
      liveId: null,
      liveSessionId: undefined,
      status: 'idle',
      messages: [],
      title: 'New chat',
      cwd,
      usage: undefined,
      error: null,
    })
  },

  send: async (text, options) => {
    const agentId = get().agentId
    if (!agentId || text.trim() === '') return

    // Optimistically show the user's message.
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      blocks: [{ kind: 'text', text }],
      timestamp: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, userMsg], error: null }))

    // Start a live session lazily (resuming the viewed session when present).
    let liveId = get().liveId
    if (!liveId) {
      set({ status: 'starting' })
      try {
        const result = await ipc.chatStart({
          agentId,
          resumeSessionId: get().liveSessionId,
          cwd: options.cwd,
          model: options.model,
          permissionMode: options.permissionMode,
          apiKey: options.apiKey ?? get().apiKey,
        })
        liveId = result.liveId
        set({ liveId, status: 'streaming' })
      } catch (err) {
        set({
          status: 'idle',
          error: err instanceof Error ? err.message : 'Failed to start chat',
        })
        return
      }
    } else {
      set({ status: 'streaming' })
    }

    try {
      await ipc.chatSend(liveId, text)
    } catch (err) {
      set({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Failed to send message',
      })
    }
  },

  interrupt: async () => {
    const liveId = get().liveId
    if (!liveId) return
    try {
      await ipc.chatInterrupt(liveId)
    } catch (err) {
      reportError(err, { title: "Couldn't interrupt" })
    }
  },

  stopLive: async () => {
    const liveId = get().liveId
    try {
      if (liveId) await ipc.chatStop(liveId)
    } catch (err) {
      reportError(err, { title: "Couldn't stop session" })
    } finally {
      set({ liveId: null, status: 'idle' })
    }
  },

  deleteSession: async (sessionId) => {
    const agentId = get().agentId
    if (!agentId) return
    try {
      await ipc.chatDeleteSession(agentId, sessionId)
      if (get().activeSessionId === sessionId) {
        set({ activeSessionId: null, messages: [], title: '' })
      }
      await get().refreshSessions()
    } catch (err) {
      reportError(err, { title: "Couldn't delete session" })
    }
  },

  exportSession: async (sessionId, format) => {
    const agentId = get().agentId
    if (!agentId) return
    try {
      await ipc.chatExportSession(agentId, sessionId, format)
    } catch (err) {
      reportError(err, { title: "Couldn't export session" })
    }
  },

  handleStreamEvent: ({ liveId, event }) => {
    // Drop events from a session we are no longer showing.
    if (get().liveId !== null && liveId !== get().liveId) return

    switch (event.t) {
      case 'session_init': {
        set({
          liveSessionId: event.sessionId || get().liveSessionId,
          activeSessionId: event.sessionId || get().activeSessionId,
          status: 'streaming',
        })
        break
      }
      case 'message_start': {
        const msg: ChatMessage = {
          id: event.messageId,
          role: event.role,
          blocks: [],
          timestamp: new Date().toISOString(),
        }
        set((s) => ({
          messages: [...s.messages, msg],
          currentMessageId: event.messageId,
          status: 'streaming',
        }))
        break
      }
      case 'text_delta':
        set((s) => ({
          messages: appendDelta(
            s.messages,
            s.currentMessageId,
            'text',
            event.text,
          ),
        }))
        break
      case 'thinking_delta':
        set((s) => ({
          messages: appendDelta(
            s.messages,
            s.currentMessageId,
            'thinking',
            event.text,
          ),
        }))
        break
      case 'block': {
        const block = event.block
        set((s) => {
          const id = s.currentMessageId
          if (!id) {
            const msg: ChatMessage = {
              id: genId(),
              role: 'assistant',
              blocks: [block],
              timestamp: new Date().toISOString(),
            }
            return { messages: [...s.messages, msg], currentMessageId: msg.id }
          }
          return { messages: appendBlock(s.messages, id, block) }
        })
        break
      }
      case 'turn_end': {
        set({ status: 'idle', usage: event.usage, currentMessageId: null })
        void get().refreshSessions()
        break
      }
      case 'error': {
        const block: ChatBlock = { kind: 'error', message: event.message }
        set((s) => ({
          error: event.message,
          messages: appendBlock(s.messages, s.currentMessageId, block),
        }))
        break
      }
      case 'done': {
        set({ status: 'idle', currentMessageId: null })
        break
      }
    }
  },
}))

// Single app-lifetime subscription to the streaming push channel. Storing the
// disposer on `window` lets HMR re-runs drop the previous listener instead of
// stacking duplicates.
const w = window as typeof window & { __abyssChatStreamUnsub?: () => void }
w.__abyssChatStreamUnsub?.()
w.__abyssChatStreamUnsub = ipc.subscribe(IpcEvent.ChatStream, (envelope) =>
  useChatsStore.getState().handleStreamEvent(envelope),
)
