/**
 * Bulk-export helpers for the Session Explorer multi-select action.
 */

import type { ChatTranscript } from '@/shared/types/chat'
import type { ChatExportFormat } from '@/shared/types/ipc'
import { transcriptToMarkdown } from '@/shared/chat/transcript-format'

/**
 * Merge multiple transcripts into a single exportable string.
 *
 * - `markdown`: sessions separated by an H2 heading with the session title.
 * - `json`: a JSON array of `ChatTranscript` objects.
 */
export function bulkExportContent(
  transcripts: ChatTranscript[],
  format: ChatExportFormat,
): string {
  if (format === 'json') {
    return `${JSON.stringify(transcripts, null, 2)}\n`
  }
  return transcripts
    .map((t, i) => {
      const sep = `## Session ${i + 1}: ${t.title || 'Untitled session'}`
      return `${sep}\n\n${transcriptToMarkdown(t)}`
    })
    .join('\n\n---\n\n')
}
