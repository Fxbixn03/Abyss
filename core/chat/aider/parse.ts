/**
 * Parse Aider's `~/.aider.chat.history.md` into the normalized chat model.
 *
 * Aider writes every conversation to one Markdown file. Each session starts
 * with a header of the form:
 *
 *   #### aider chat started at YYYY-MM-DD HH:MM:SS
 *
 * Within a session:
 *   - User turns are blockquote lines starting with `> ` (may span multiple
 *     consecutive lines of blockquote).
 *   - Assistant (Aider) turns are the remaining non-empty paragraphs.
 *
 * Because all sessions live in one file the `sessionId` is the zero-padded
 * index of the session within the file (newest first when listed). The file
 * path is always the same `~/.aider.chat.history.md`.
 */

import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatListOptions,
  ChatMessage,
  ChatSessionMeta,
  ChatSessionPage,
  ChatTranscript,
} from '@/shared/types/chat'
import { paginateMetas } from '../paginate'
import { projectLabelFromCwd } from '../normalize'
import { aiderHistoryFile } from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigReadError, ConfigNotFoundError } from '../../config-error'
import { isPermissionError } from '../../os-errors'

/** Regex that matches the `#### aider chat started at …` session delimiter. */
const SESSION_HEADER_RE = /^#### aider chat started at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/

/**
 * A raw parsed session before it is converted to ChatSessionMeta/ChatTranscript.
 */
interface RawSession {
  /** Zero-based index (0 = first session in file / oldest). */
  index: number
  /** ISO 8601 string derived from the header timestamp. */
  startedAt: string
  /** Raw content lines of the session body (excluding the header line). */
  lines: string[]
}

/**
 * Split the Aider history file content into raw sessions. Returns sessions in
 * file order (oldest first — index 0 is the oldest session).
 */
function splitSessions(content: string): RawSession[] {
  const allLines = content.split('\n')
  const sessions: RawSession[] = []
  let current: RawSession | null = null

  for (const line of allLines) {
    const headerMatch = SESSION_HEADER_RE.exec(line)
    if (headerMatch) {
      if (current) sessions.push(current)
      // Convert "YYYY-MM-DD HH:MM:SS" → ISO 8601
      const rawTs = headerMatch[1].replace(' ', 'T')
      const startedAt = `${rawTs}:00`
      current = {
        index: sessions.length,
        startedAt,
        lines: [],
      }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sessions.push(current)
  return sessions
}

/**
 * Parse the body lines of a single Aider session into ChatMessages. User turns
 * are blockquote lines (`> …`); everything else is considered assistant output.
 */
function parseMessages(
  lines: string[],
  sessionIndex: number,
): ChatMessage[] {
  const messages: ChatMessage[] = []
  let msgIndex = 0

  /**
   * Accumulate consecutive non-empty lines into a single text block then flush
   * into `messages`.
   */
  let currentRole: 'user' | 'assistant' | null = null
  const currentLines: string[] = []

  function flush(): void {
    if (currentLines.length === 0 || currentRole === null) return
    const text = currentLines.join('\n').trim()
    if (text === '') return
    messages.push({
      id: `aider-${sessionIndex}-${msgIndex++}`,
      role: currentRole,
      blocks: [{ kind: 'text', text }],
    })
    currentLines.length = 0
  }

  for (const raw of lines) {
    const isQuote = raw.startsWith('> ')
    const isEmptyQuote = raw === '>'

    if (isQuote || isEmptyQuote) {
      // User turn line
      if (currentRole === 'assistant') flush()
      currentRole = 'user'
      // Strip the leading `> ` prefix
      currentLines.push(isEmptyQuote ? '' : raw.slice(2))
    } else {
      // Any non-blockquote line: either assistant content or a blank separator
      if (raw.trim() === '') {
        // Blank lines between blockquote chunks don't switch role; blank lines
        // between other content flush and start fresh.
        if (currentRole === 'user') {
          // Blank line ends the user turn
          flush()
          currentRole = null
        } else if (currentRole === 'assistant') {
          // Blank line may just be a paragraph break — we'll flush and restart
          flush()
          currentRole = null
        }
      } else {
        // Non-empty, non-blockquote line → assistant turn
        if (currentRole === 'user') flush()
        currentRole = 'assistant'
        currentLines.push(raw)
      }
    }
  }

  flush()
  return messages
}

/**
 * Build a stable session id from the history file path and the session index.
 * We use the index (0-based, oldest first) so it is deterministic across runs.
 */
function sessionIdFromIndex(index: number): string {
  return `aider-session-${String(index).padStart(4, '0')}`
}

/** Read session metadata for the usage aggregator (one file = many sessions). */
export async function readAiderMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  // For the usage aggregator we expose the file-level aggregate (total messages
  // across all sessions in the file). This keeps the aggregator's per-file cache
  // from having to parse individual session slices.
  try {
    const stat = await fs.stat(ref.filePath)
    const content = await fs.readFile(ref.filePath, 'utf-8')
    const sessions = splitSessions(content)
    if (sessions.length === 0) return null

    let totalMessages = 0
    for (const s of sessions) {
      totalMessages += parseMessages(s.lines, s.index).length
    }

    const oldest = sessions[0]
    const newest = sessions[sessions.length - 1]

    return {
      id: 'aider-history',
      agentId: 'aider',
      title: 'Aider chat history',
      cwd: '',
      projectLabel: 'Aider',
      messageCount: totalMessages,
      startedAt: oldest.startedAt,
      updatedAt: newest.startedAt,
      sizeBytes: stat.size,
      filePath: ref.filePath,
    }
  } catch {
    return null
  }
}

export async function listAiderSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const filePath = aiderHistoryFile(env)
  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(filePath)
  } catch {
    return { sessions: [], total: 0 }
  }

  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    if (isPermissionError(err)) {
      throw new ConfigReadError(filePath, err)
    }
    throw err
  }
  const raw = splitSessions(content)
  if (raw.length === 0) return { sessions: [], total: 0 }

  // Build metas in newest-first order (reverse index order)
  const metas: ChatSessionMeta[] = []
  for (let i = raw.length - 1; i >= 0; i--) {
    const s = raw[i]
    const messages = parseMessages(s.lines, s.index)
    if (messages.length === 0) continue

    const firstUser = messages.find((m) => m.role === 'user')
    const titleBlock = firstUser?.blocks.find((b) => b.kind === 'text')
    const title =
      (titleBlock && titleBlock.kind === 'text'
        ? titleBlock.text.replace(/\s+/g, ' ').slice(0, 80)
        : '') || 'Aider session'

    // Determine updatedAt: next session's startedAt or file mtime for the last
    const updatedAt =
      i < raw.length - 1 ? raw[i + 1].startedAt : stat.mtime.toISOString()

    metas.push({
      id: sessionIdFromIndex(s.index),
      agentId: 'aider',
      title,
      cwd: '',
      projectLabel: 'Aider',
      messageCount: messages.length,
      startedAt: s.startedAt,
      updatedAt,
      sizeBytes: stat.size,
      filePath,
    })
  }

  // Apply cwd filter (Aider doesn't record cwd so filtering is a no-op)
  const filtered = opts?.cwd
    ? metas // Aider logs have no cwd, skip filter
    : metas

  return paginateMetas(filtered, opts)
}

export async function readAiderSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = aiderHistoryFile(env)
  let stat: Awaited<ReturnType<typeof fs.stat>>
  let content: string
  try {
    stat = await fs.stat(filePath)
    content = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    if (isPermissionError(err)) {
      throw new ConfigReadError(filePath, err)
    }
    throw err
  }
  const raw = splitSessions(content)

  // Match by generated session id
  const found = raw.find((s) => sessionIdFromIndex(s.index) === sessionId)
  if (!found) throw new ConfigNotFoundError(filePath)

  const messages = parseMessages(found.lines, found.index)
  const firstUser = messages.find((m) => m.role === 'user')
  const titleBlock = firstUser?.blocks.find((b) => b.kind === 'text')
  const title =
    (titleBlock && titleBlock.kind === 'text'
      ? titleBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      : '') || 'Aider session'

  const nextSession = raw[found.index + 1]
  const updatedAt = nextSession
    ? nextSession.startedAt
    : stat.mtime.toISOString()

  return {
    id: sessionId,
    agentId: 'aider',
    title,
    cwd: '',
    projectLabel: 'Aider',
    messageCount: messages.length,
    startedAt: found.startedAt,
    updatedAt,
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

/**
 * Aider uses a single append-only log file — individual sessions cannot be
 * deleted without rewriting the whole file. `deleteAiderSession` is a no-op
 * that silently succeeds; deleting the file itself must be done outside Abyss.
 */
export async function deleteAiderSession(
  _env: OsEnv,
  _sessionId: string,
): Promise<void> {
  // The history file is a shared append-only log. Deleting individual sessions
  // would require rewriting the whole file, which is too destructive for a
  // read-only viewer. This is intentionally a no-op.
}

/** Collect session file refs for the usage aggregator. */
export async function listAiderSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const filePath = aiderHistoryFile(env)
  try {
    await fs.access(filePath)
    return [{ filePath }]
  } catch {
    return []
  }
}

/** Re-export for the runtime's usage source. */
export { projectLabelFromCwd }
