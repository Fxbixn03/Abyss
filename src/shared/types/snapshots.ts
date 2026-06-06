/**
 * Snapshot model — Abyss's safety net. Every config write is preceded by a
 * snapshot of the previous file content so any save can be undone. Pure types.
 */

export interface SnapshotMeta {
  /** Opaque id: `<hash>/<timestamp>`. */
  id: string
  /** Absolute path of the file this snapshot was taken from. */
  originalPath: string
  /** Basename of the original file, for display. */
  fileName: string
  /** ISO 8601 timestamp of when the snapshot was taken. */
  timestamp: string
  sizeBytes: number
}

export interface SnapshotContent {
  meta: SnapshotMeta
  content: string
}
