import { useEffect, useState } from 'react'
import type { ChatPermissionMode } from '@/shared/types/chat'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useChatsStore } from '../store/chats.store'
import { SessionList } from '../components/SessionList'
import { ChatTranscript } from '../components/ChatTranscript'
import { Composer } from '../components/Composer'
import { LoginGate } from '../components/LoginGate'
import { formatCost } from '../lib/format'

const CLAUDE_MODELS = [
  { value: 'default', label: 'Default model' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
]

const PERMISSION_MODES: { value: ChatPermissionMode; label: string }[] = [
  { value: 'default', label: 'Ask (default)' },
  { value: 'acceptEdits', label: 'Accept edits' },
  { value: 'plan', label: 'Plan only' },
  { value: 'bypassPermissions', label: 'Bypass all' },
]

export function ChatsPage() {
  const agent = useActiveAgent()
  const supported = agent.capabilities.chats

  const availability = useChatsStore((s) => s.availability)
  const availabilityLoading = useChatsStore((s) => s.availabilityLoading)
  const messages = useChatsStore((s) => s.messages)
  const transcriptLoading = useChatsStore((s) => s.transcriptLoading)
  const status = useChatsStore((s) => s.status)
  const usage = useChatsStore((s) => s.usage)
  const title = useChatsStore((s) => s.title)
  const cwd = useChatsStore((s) => s.cwd)
  const activeSessionId = useChatsStore((s) => s.activeSessionId)

  const init = useChatsStore((s) => s.init)
  const login = useChatsStore((s) => s.login)
  const checkAvailability = useChatsStore((s) => s.checkAvailability)
  const newChat = useChatsStore((s) => s.newChat)
  const send = useChatsStore((s) => s.send)
  const interrupt = useChatsStore((s) => s.interrupt)

  const [model, setModel] = useState('default')
  const [permissionMode, setPermissionMode] =
    useState<ChatPermissionMode>('default')
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    if (supported) void init(agent.id)
  }, [supported, agent.id, init])

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Chats" icon="messages-square" />
        <EmptyState
          icon="messages-square"
          title={`${agent.displayName} has no chats`}
          description="Switch to an agent that supports chat history and live chat."
        />
      </div>
    )
  }

  const authed = availability?.authenticated === true

  const handleLogin = async (persist: boolean, apiKey?: string) => {
    setLoggingIn(true)
    try {
      await login(persist, apiKey)
    } finally {
      setLoggingIn(false)
    }
  }

  const handleNewChat = async () => {
    const { path } = await ipc.pickDirectory('Choose a working directory')
    if (path) newChat(path)
  }

  const busy = status === 'streaming' || status === 'starting'
  const canChat = cwd.trim() !== '' || activeSessionId !== null

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Chats"
        description={`History & live chat for ${agent.displayName}`}
        icon="messages-square"
        actions={
          authed && availability?.account ? (
            <Badge variant="muted">
              <Icon name="user" />
              {availability.account}
            </Badge>
          ) : undefined
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] gap-4">
        <aside className="flex min-h-0 flex-col">
          <SessionList onNewChat={() => void handleNewChat()} />
        </aside>

        <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card/40">
          {!authed ? (
            <LoginGate
              agentName={agent.displayName}
              availability={availability}
              loading={availabilityLoading}
              busy={loggingIn}
              onLogin={(persist, apiKey) => void handleLogin(persist, apiKey)}
              onRefresh={() => void checkAvailability()}
            />
          ) : !canChat ? (
            <EmptyState
              icon="messages-square"
              title="Pick up a conversation"
              description="Select a past chat on the left, or start a new one."
              action={
                <Button onClick={() => void handleNewChat()}>
                  <Icon name="plus" />
                  New chat
                </Button>
              }
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {title || 'New chat'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void ipc.revealPath(cwd)}
                    className="flex max-w-full items-center gap-1 truncate font-code text-xs text-muted-foreground hover:text-foreground"
                    title={cwd}
                  >
                    <Icon name="folder-open" className="size-3 shrink-0" />
                    <span className="truncate">{cwd || 'no directory'}</span>
                  </button>
                </div>
                {usage && formatCost(usage.totalCostUsd) && (
                  <Badge variant="muted" className="font-code">
                    {formatCost(usage.totalCostUsd)}
                  </Badge>
                )}
              </div>

              <div className="min-h-0 flex-1 px-4">
                <ChatTranscript
                  messages={messages}
                  loading={transcriptLoading}
                />
              </div>

              <div className="px-4 pb-4 pt-1">
                <Composer
                  busy={busy}
                  disabled={!canChat}
                  onSend={(text) =>
                    void send(text, {
                      cwd,
                      model: model === 'default' ? undefined : model,
                      permissionMode,
                    })
                  }
                  onStop={() => void interrupt()}
                  settingsBar={
                    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
                      <Select
                        value={permissionMode}
                        onValueChange={(v) =>
                          setPermissionMode(v as ChatPermissionMode)
                        }
                      >
                        <SelectTrigger className="h-7 w-auto gap-1.5 px-2 text-xs">
                          <Icon name="shield" className="size-3.5" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERMISSION_MODES.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {agent.id === 'claude' && (
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger className="h-7 w-auto gap-1.5 px-2 text-xs">
                            <Icon name="cpu" className="size-3.5" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CLAUDE_MODELS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {status === 'starting' && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Icon name="loader" className="size-3 animate-spin" />
                          starting…
                        </span>
                      )}
                    </div>
                  }
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
