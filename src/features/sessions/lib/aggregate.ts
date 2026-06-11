/**
 * Pure aggregation helpers for the Session Explorer. Turn the flat session
 * metadata (and a loaded transcript) into the project-comparison cards, sortable
 * columns and tool-frequency breakdown the page renders. No Node, no React.
 */

import type { ChatMessage, ChatSessionMeta } from '@/shared/types/chat'
import { estimateCostUsd } from '@/shared/lib/cost'

export interface ProjectRollup {
  /** Display label (basename of the working directory). */
  label: string
  cwd: string
  sessions: number
  messages: number
  tokens: number
  estCostUsd: number
  /** ISO of the most recent activity in this project. */
  lastActivityAt?: string
}

export function totalTokens(s: ChatSessionMeta): number {
  return (s.inputTokens ?? 0) + (s.outputTokens ?? 0)
}

export function sessionCostUsd(s: ChatSessionMeta): number {
  return estimateCostUsd(s.inputTokens ?? 0, s.outputTokens ?? 0)
}

/** Group sessions by working directory into comparison cards, busiest first. */
export function rollupByProject(sessions: ChatSessionMeta[]): ProjectRollup[] {
  const byCwd = new Map<string, ProjectRollup>()
  for (const s of sessions) {
    const key = s.cwd || s.projectLabel
    const acc =
      byCwd.get(key) ??
      ({
        label: s.projectLabel || key,
        cwd: s.cwd,
        sessions: 0,
        messages: 0,
        tokens: 0,
        estCostUsd: 0,
        lastActivityAt: undefined,
      } satisfies ProjectRollup)
    acc.sessions += 1
    acc.messages += s.messageCount
    acc.tokens += totalTokens(s)
    acc.estCostUsd += sessionCostUsd(s)
    const ts = s.updatedAt ?? s.startedAt
    if (ts && (!acc.lastActivityAt || ts > acc.lastActivityAt)) {
      acc.lastActivityAt = ts
    }
    byCwd.set(key, acc)
  }
  return [...byCwd.values()].sort((a, b) => b.tokens - a.tokens)
}

export type SessionSortKey =
  | 'updatedAt'
  | 'project'
  | 'messages'
  | 'tokens'
  | 'cost'

export function sortSessions(
  sessions: ChatSessionMeta[],
  key: SessionSortKey,
  dir: 'asc' | 'desc',
): ChatSessionMeta[] {
  const sign = dir === 'asc' ? 1 : -1
  const cmp = (a: ChatSessionMeta, b: ChatSessionMeta): number => {
    switch (key) {
      case 'project':
        return a.projectLabel.localeCompare(b.projectLabel)
      case 'messages':
        return a.messageCount - b.messageCount
      case 'tokens':
        return totalTokens(a) - totalTokens(b)
      case 'cost':
        return sessionCostUsd(a) - sessionCostUsd(b)
      case 'updatedAt':
      default:
        return (
          new Date(a.updatedAt ?? a.startedAt ?? 0).getTime() -
          new Date(b.updatedAt ?? b.startedAt ?? 0).getTime()
        )
    }
  }
  return [...sessions].sort((a, b) => sign * cmp(a, b))
}

export interface ToolCount {
  name: string
  count: number
}

/** Count `tool_use` blocks per tool name across a transcript, busiest first. */
export function toolFrequency(messages: ChatMessage[]): ToolCount[] {
  const counts = new Map<string, number>()
  for (const m of messages) {
    for (const block of m.blocks) {
      if (block.kind === 'tool_use') {
        counts.set(block.name, (counts.get(block.name) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export interface TranscriptStats {
  userTurns: number
  assistantTurns: number
  toolCalls: number
  toolErrors: number
}

/** Quick role / tool tallies for a transcript, shown above the timeline. */
export function transcriptStats(messages: ChatMessage[]): TranscriptStats {
  let userTurns = 0
  let assistantTurns = 0
  let toolCalls = 0
  let toolErrors = 0
  for (const m of messages) {
    if (m.role === 'user') userTurns += 1
    else if (m.role === 'assistant') assistantTurns += 1
    for (const block of m.blocks) {
      if (block.kind === 'tool_use') toolCalls += 1
      else if (block.kind === 'tool_result' && block.isError) toolErrors += 1
    }
  }
  return { userTurns, assistantTurns, toolCalls, toolErrors }
}
