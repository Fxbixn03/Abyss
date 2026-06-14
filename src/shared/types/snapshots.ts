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
  /** Optional user-supplied label/note, read from the snapshot's sidecar file. */
  label?: string
  /**
   * Absolute path of the label sidecar file (`<snapshot-id>.label.txt`), computed
   * in core so the renderer can write the label via WriteTextFile without doing
   * any path math of its own.
   */
  labelPath: string
}

export interface SnapshotContent {
  meta: SnapshotMeta
  content: string
}
