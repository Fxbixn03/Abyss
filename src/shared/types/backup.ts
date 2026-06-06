/** Metadata for one auto-backup file (an exported config bundle on disk). */
export interface BackupInfo {
  /** File name, e.g. abyss-backup-2026-06-06T09-12-00-000Z.json. */
  name: string
  /** Absolute path of the backup file. */
  path: string
  /** ISO 8601 creation time. */
  createdAt: string
  sizeBytes: number
}
