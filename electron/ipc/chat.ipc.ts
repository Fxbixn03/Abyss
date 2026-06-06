import { promises as fs } from 'node:fs'
import { dialog } from 'electron'
import { IpcChannel, IpcEvent } from '@/shared/types/ipc'
import {
  listChatSessions,
  readChatSession,
  deleteChatSession,
} from '@core/chat/history'
import { getChatRuntime } from '@core/chat/registry'
import { markEphemeralLogin, clearEphemeralLogin } from '@core/chat/auth'
import {
  startChat,
  sendChat,
  respondPermission,
  interruptChat,
  stopChat,
} from '@core/chat/session-manager'
import { transcriptToJson, transcriptToMarkdown } from '@core/chat/export'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerChatIpc(ctx: IpcContext): void {
  // --- History --------------------------------------------------------------
  handle(IpcChannel.ChatListSessions, ({ agentId }) =>
    listChatSessions(ctx.env, agentId),
  )
  handle(IpcChannel.ChatReadSession, ({ agentId, sessionId }) =>
    readChatSession(ctx.env, agentId, sessionId),
  )
  handle(IpcChannel.ChatDeleteSession, async ({ agentId, sessionId }) => {
    await deleteChatSession(ctx.env, agentId, sessionId)
    return { success: true }
  })
  handle(
    IpcChannel.ChatExportSession,
    async ({ agentId, sessionId, format }) => {
      const transcript = await readChatSession(ctx.env, agentId, sessionId)
      const isMd = format === 'markdown'
      const content = isMd
        ? transcriptToMarkdown(transcript)
        : transcriptToJson(transcript)
      const window = ctx.getWindow()
      const safeName = transcript.title.replace(/[^\w.-]+/g, '-').slice(0, 60)
      const options = {
        title: 'Export Chat',
        defaultPath: `${safeName || 'chat'}.${isMd ? 'md' : 'json'}`,
        filters: [
          isMd
            ? { name: 'Markdown', extensions: ['md'] }
            : { name: 'JSON', extensions: ['json'] },
        ],
      }
      const result = await (window
        ? dialog.showSaveDialog(window, options)
        : dialog.showSaveDialog(options))
      if (result.canceled || !result.filePath) return { path: null }
      await fs.writeFile(result.filePath, content, 'utf8')
      return { path: result.filePath }
    },
  )

  // --- Auth -----------------------------------------------------------------
  handle(IpcChannel.ChatAvailability, ({ agentId }) =>
    getChatRuntime(agentId).availability(ctx.env),
  )
  handle(IpcChannel.ChatLogin, async ({ agentId, persist, apiKey }) => {
    const runtime = getChatRuntime(agentId)
    // Capture the pre-existing state so we never log out a session the user
    // already had (only ephemeral-logout logins Abyss performed this run).
    const before = await runtime.availability(ctx.env)
    const result = await runtime.login(ctx.env, apiKey)
    const freshLogin = !before.authenticated && result.authenticated
    if (freshLogin && !persist) markEphemeralLogin(agentId, ctx.env)
    else clearEphemeralLogin(agentId)
    return result
  })
  handle(IpcChannel.ChatLogout, async ({ agentId }) => {
    clearEphemeralLogin(agentId)
    await getChatRuntime(agentId).logout(ctx.env)
    return { success: true }
  })

  // --- Live session ---------------------------------------------------------
  handle(IpcChannel.ChatStart, async (options) => {
    const liveId = await startChat(ctx.env, options, (envelope) =>
      ctx.emit(IpcEvent.ChatStream, envelope),
    )
    return { liveId }
  })
  handle(IpcChannel.ChatSend, async ({ liveId, text }) => {
    await sendChat(liveId, text)
    return { success: true }
  })
  handle(
    IpcChannel.ChatRespondPermission,
    async ({ liveId, requestId, decision }) => {
      await respondPermission(liveId, requestId, decision)
      return { success: true }
    },
  )
  handle(IpcChannel.ChatInterrupt, async ({ liveId }) => {
    await interruptChat(liveId)
    return { success: true }
  })
  handle(IpcChannel.ChatStop, async ({ liveId }) => {
    await stopChat(liveId)
    return { success: true }
  })
}
