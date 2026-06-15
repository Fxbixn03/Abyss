/**
 * Shared types for file-level config validation. The core/validation.ts module
 * produces these findings; this file re-exports the pure types so both the
 * renderer and the IPC contract can import them without pulling in Node APIs.
 */

export type ValidationSeverity = 'warn' | 'error'

export interface ValidationFinding {
  severity: ValidationSeverity
  agentId: string
  agentName: string
  file: string
  message: string
  /** Renderer route where the user can navigate to fix the issue. */
  route?: string
  /**
   * Machine-readable hint for the renderer about which repair action to offer
   * the user. Optional so existing consumers compile unchanged.
   */
  suggestedAction?: 'open-raw-editor' | 'create-file' | 'open-mcp' | 'open-hooks'
}
