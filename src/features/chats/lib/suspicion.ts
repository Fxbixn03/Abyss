/**
 * "Suspicion system" — not hallucination *detection* (impossible to do
 * reliably), but risk *indicators* over a transcript. It flags claims made
 * without tool use, high-confidence statements without evidence, internal
 * contradictions and references to files that don't exist on disk.
 */

import type { ChatBlock, ChatMessage } from '@/shared/types/chat'

export type SuspicionKind =
  | 'no-verification'
  | 'overconfident'
  | 'contradiction'
  | 'missing-file'

export interface SuspicionMarker {
  kind: SuspicionKind
  severity: 'warning' | 'info'
  title: string
  detail: string
  /** Short excerpt of the offending message. */
  snippet: string
}

function messageText(m: ChatMessage): string {
  return m.blocks
    .map((b) => ('text' in b ? b.text : ''))
    .join('\n')
    .trim()
}

function hasToolUse(blocks: ChatBlock[]): boolean {
  return blocks.some((b) => b.kind === 'tool_use' || b.kind === 'tool_result')
}

function snippetAround(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return text.slice(0, 120)
  const start = Math.max(0, i - 40)
  return `${start > 0 ? '…' : ''}${text.slice(start, i + term.length + 40).trim()}…`
}

const CONFIDENCE = [
  'definitely',
  'guaranteed',
  '100%',
  'certainly',
  'without a doubt',
  'this fixes',
  'this will fix',
  'i am sure',
  "i'm sure",
  'surely',
  'absolutely',
]

const QUANT_CLAIM =
  /\b\d+\s+(tables?|files?|rows?|users?|functions?|methods?|classes?|endpoints?|tests?|columns?|records?|entries)\b/i

/** Antonym pairs that, appearing together in one message, suggest a self-contradiction. */
const ANTONYMS: [RegExp, RegExp, string][] = [
  [/\boffline\b/i, /\b(online|running|reachable)\b/i, 'offline vs online'],
  [
    /\b(does ?n['o]t exist|no such|not found|missing)\b/i,
    /\b(exists|found|present|returned)\b/i,
    'exists vs not found',
  ],
  [
    /\b(failed|failure|errored?)\b/i,
    /\b(succeeded|success|passed|works?)\b/i,
    'failed vs succeeded',
  ],
]

/** Text-only markers — safe to run synchronously on the loaded transcript. */
export function analyzeTranscript(messages: ChatMessage[]): SuspicionMarker[] {
  const markers: SuspicionMarker[] = []
  const sessionUsedTools = messages.some((m) => hasToolUse(m.blocks))

  for (const m of messages) {
    if (m.role !== 'assistant') continue
    const text = messageText(m)
    if (!text) continue
    const lower = text.toLowerCase()
    const ownTools = hasToolUse(m.blocks)

    // Overconfident without evidence.
    const phrase = CONFIDENCE.find((p) => lower.includes(p))
    if (phrase && !ownTools) {
      markers.push({
        kind: 'overconfident',
        severity: 'warning',
        title: 'High-confidence claim without evidence',
        detail: `“${phrase}” asserted without a tool call, test or reproduction in this message.`,
        snippet: snippetAround(text, phrase),
      })
    }

    // Quantitative claim while the whole session never used a tool.
    const quant = text.match(QUANT_CLAIM)
    if (quant && !sessionUsedTools) {
      markers.push({
        kind: 'no-verification',
        severity: 'warning',
        title: 'Claim made without verification',
        detail: `States “${quant[0]}” but no tool, query or file read happened in this conversation.`,
        snippet: snippetAround(text, quant[0]),
      })
    }

    // Internal contradiction.
    for (const [a, b, label] of ANTONYMS) {
      if (a.test(text) && b.test(text)) {
        markers.push({
          kind: 'contradiction',
          severity: 'info',
          title: 'Possible self-contradiction',
          detail: `This message contains both sides of “${label}”.`,
          snippet: text.slice(0, 140),
        })
        break
      }
    }
  }

  return markers
}

/** Candidate file paths referenced in assistant text (for existence checks). */
export function extractReferencedPaths(messages: ChatMessage[]): string[] {
  const found = new Set<string>()
  const backtick = /`([^`\n]+)`/g
  // A path-ish token: has a slash and a file extension, no spaces.
  const pathish = /^[\w./@-]+\/[\w./@-]+\.[a-zA-Z]{1,6}$/

  for (const m of messages) {
    if (m.role !== 'assistant') continue
    const text = messageText(m)
    let match: RegExpExecArray | null
    while ((match = backtick.exec(text)) !== null) {
      const token = match[1].trim()
      if (pathish.test(token)) found.add(token)
    }
    for (const raw of text.split(/\s+/)) {
      const token = raw.replace(/[.,;:)\]}'"]+$/, '')
      if (pathish.test(token)) found.add(token)
    }
  }
  return [...found].slice(0, 25)
}
