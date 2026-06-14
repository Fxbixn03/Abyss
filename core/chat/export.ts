/**
 * Pure transcript → text serializers for the "export chat" action. The IPC
 * handler picks a destination via a save dialog and writes the result.
 *
 * The actual logic lives in `src/shared/chat/transcript-format.ts` so the
 * renderer can also use it without going through IPC. This file re-exports
 * everything the electron/ipc layer needs.
 */

export {
  transcriptToMarkdown,
  transcriptToJson,
} from '@/shared/chat/transcript-format'
