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
import { cn } from '@/shared/lib/utils'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useProjectDir, joinPath } from '@/features/scope/hooks/useScopedBase'
import { useChatsStore } from '../store/chats.store'
import { SessionList } from '../components/SessionList'
import { ChatTranscript } from '../components/ChatTranscript'
import { Composer } from '../components/Composer'
import { LoginGate } from '../components/LoginGate'
import { useResizableWidth } from '../hooks/useResizableWidth'
import { formatCost } from '../lib/format'
import type { SuspicionMarker } from '../lib/suspicion'
import { analyzeTranscript, extractReferencedPaths } from '../lib/suspicion'
import { ReplayBar } from '../components/ReplayBar'
import { REPLAY_SPEEDS } from '../lib/replay'

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
  // Suspicion scan results, tied to the session they were computed for.
  const [risks, setRisks] = useState<{
    key: string
    markers: SuspicionMarker[]
  } | null>(null)
  const [scanning, setScanning] = useState(false)
  // Session replay: when set, the transcript reveals messages up to `index`.
  // `key` ties the replay to its session so it's ignored after switching chats.
  const [replay, setReplay] = useState<{
    key: string
    index: number
    playing: boolean
    speed: number
  } | null>(null)

  const {
    width: listWidth,
    isDragging,
    startDrag,
    reset: resetWidth,
  } = useResizableWidth({
    storageKey: 'abyss-chats-list-width',
    initial: 280,
    min: 220,
    max: 560,
  })

  // In project scope, list only this project's chats (global shows them all).
  const projectDir = useProjectDir()

  useEffect(() => {
    if (supported) void init(agent.id, projectDir)
  }, [supported, agent.id, projectDir, init])

  // Replay playback: a recursive timer that reveals one more message per tick.
  useEffect(() => {
    if (!replay?.playing) return
    const key = activeSessionId ?? 'live'
    if (replay.key !== key) return
    const total = messages.length
    if (replay.index >= total) return
    const ms = Math.max(150, 900 / replay.speed)
    const id = window.setTimeout(() => {
      setReplay((r) => {
        if (!r) return r
        const next = Math.min(total, r.index + 1)
        return { ...r, index: next, playing: next < total }
      })
    }, ms)
    return () => window.clearTimeout(id)
  }, [replay, activeSessionId, messages.length])

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

  const sessionKey = activeSessionId ?? 'live'
  const shownRisks = risks && risks.key === sessionKey ? risks.markers : null
  const activeReplay = replay && replay.key === sessionKey ? replay : null
  const shownMessages = activeReplay
    ? messages.slice(0, activeReplay.index)
    : messages

  const scanRisks = async () => {
    setScanning(true)
    const markers = analyzeTranscript(messages)
    // Verify referenced file paths exist (resolved against the session dir).
    for (const ref of extractReferencedPaths(messages)) {
      const abs =
        ref.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(ref)
          ? ref
          : cwd
            ? joinPath(cwd, ref)
            : null
      if (!abs) continue
      const { exists } = await ipc.fileExists(abs).catch(() => ({ exists: true }))
      if (!exists) {
        markers.push({
          kind: 'missing-file',
          severity: 'warning',
          title: 'Referenced file not found',
          detail: `“${ref}” doesn't exist under the session directory.`,
          snippet: ref,
        })
      }
    }
    setRisks({ key: sessionKey, markers })
    setScanning(false)
  }

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

      <div className="flex min-h-0 flex-1">
        <aside
          style={{ width: listWidth }}
          className="flex min-h-0 shrink-0 flex-col pr-1"
        >
          <SessionList onNewChat={() => void handleNewChat()} />
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startDrag}
          onDoubleClick={resetWidth}
          title="Drag to resize · double-click to reset"
          className="group relative mx-1 flex w-1.5 shrink-0 cursor-col-resize items-stretch"
        >
          <span
            className={cn(
              'mx-auto w-px rounded-full bg-border transition-colors group-hover:bg-primary',
              isDragging && 'bg-primary',
            )}
          />
        </div>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card/40">
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
                <div className="flex shrink-0 items-center gap-2">
                  {usage && formatCost(usage.totalCostUsd) && (
                    <Badge variant="muted" className="font-code">
                      {formatCost(usage.totalCostUsd)}
                    </Badge>
                  )}
                  {messages.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setReplay(
                          activeReplay
                            ? null
                            : {
                                key: sessionKey,
                                index: 0,
                                playing: true,
                                speed: 1,
                              },
                        )
                      }
                      title="Replay this conversation step by step"
                    >
                      <Icon name={activeReplay ? 'x' : 'play'} />
                      {activeReplay ? 'Exit replay' : 'Replay'}
                    </Button>
                  )}
                  {messages.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void scanRisks()}
                      disabled={scanning}
                      title="Scan this transcript for risk indicators"
                    >
                      <Icon
                        name={scanning ? 'loader' : 'flag'}
                        className={scanning ? 'animate-spin' : ''}
                      />
                      Scan risks
                    </Button>
                  )}
                </div>
              </div>

              {activeReplay && (
                <ReplayBar
                  index={activeReplay.index}
                  total={messages.length}
                  playing={activeReplay.playing}
                  speed={activeReplay.speed}
                  onPlayPause={() =>
                    setReplay((r) => (r ? { ...r, playing: !r.playing } : r))
                  }
                  onStep={(delta) =>
                    setReplay((r) =>
                      r
                        ? {
                            ...r,
                            playing: false,
                            index: Math.max(
                              0,
                              Math.min(messages.length, r.index + delta),
                            ),
                          }
                        : r,
                    )
                  }
                  onRestart={() =>
                    setReplay((r) =>
                      r ? { ...r, index: 0, playing: true } : r,
                    )
                  }
                  onCycleSpeed={() =>
                    setReplay((r) => {
                      if (!r) return r
                      const i = REPLAY_SPEEDS.indexOf(
                        r.speed as (typeof REPLAY_SPEEDS)[number],
                      )
                      const speed =
                        REPLAY_SPEEDS[(i + 1) % REPLAY_SPEEDS.length]
                      return { ...r, speed }
                    })
                  }
                  onClose={() => setReplay(null)}
                />
              )}

              {shownRisks && (
                <div className="border-b border-border bg-muted/20 px-4 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <Icon name="flag" className="size-3.5" />
                      {shownRisks.length === 0
                        ? 'No risk indicators found'
                        : `${shownRisks.length} risk indicator(s)`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRisks(null)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Dismiss risk scan"
                    >
                      <Icon name="x" className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {shownRisks.map((marker, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                      >
                        <Icon
                          name={
                            marker.severity === 'warning'
                              ? 'alert-triangle'
                              : 'info'
                          }
                          className={cn(
                            'mt-0.5 size-3.5 shrink-0',
                            marker.severity === 'warning'
                              ? 'text-warning'
                              : 'text-muted-foreground',
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-medium">{marker.title}</p>
                          <p className="text-muted-foreground">{marker.detail}</p>
                          <p className="mt-0.5 truncate font-code text-[11px] text-muted-foreground/70">
                            {marker.snippet}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 px-4">
                <ChatTranscript
                  messages={shownMessages}
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
