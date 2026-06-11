import { useMemo } from 'react'
import type { ChatMessage, ChatSessionMeta } from '@/shared/types/chat'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import { Icon } from '@/shared/components/Icon'
import { ChatTranscript } from '@/features/chats/components/ChatTranscript'
import { toolFrequency, transcriptStats } from '../lib/aggregate'

export interface SessionDetailProps {
  session: ChatSessionMeta
  messages: ChatMessage[]
  loading: boolean
  agentName?: string
  onBack: () => void
}

export function SessionDetail({
  session,
  messages,
  loading,
  agentName,
  onBack,
}: SessionDetailProps) {
  const stats = useMemo(() => transcriptStats(messages), [messages])
  const tools = useMemo(() => toolFrequency(messages), [messages])
  const maxToolCount = Math.max(1, ...tools.map((t) => t.count))

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <Icon name="arrow-left" />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={session.title}>
            {session.title || 'Untitled session'}
          </p>
          <p
            className="truncate font-code text-xs text-muted-foreground"
            title={session.cwd}
          >
            {session.cwd || session.projectLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant="muted">{stats.userTurns} you</Badge>
          <Badge variant="muted">{stats.assistantTurns} agent</Badge>
          <Badge variant="muted">{stats.toolCalls} tool calls</Badge>
          {stats.toolErrors > 0 && (
            <Badge variant="danger">{stats.toolErrors} tool errors</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="timeline" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="timeline">
            <Icon name="messages-square" className="size-3.5" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Icon name="wrench" className="size-3.5" />
            Tools ({tools.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="min-h-0 flex-1">
          <ChatTranscript
            messages={messages}
            loading={loading}
            agentName={agentName}
          />
        </TabsContent>

        <TabsContent value="tools" className="min-h-0 flex-1 overflow-y-auto">
          {tools.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tool calls in this session.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 py-2">
              {tools.map((t) => (
                <li key={t.name} className="flex items-center gap-3">
                  <span
                    className="w-44 shrink-0 truncate font-code text-xs"
                    title={t.name}
                  >
                    {t.name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(t.count / maxToolCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
