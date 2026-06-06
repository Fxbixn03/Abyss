/**
 * Named config sets ("profiles"). A profile is a saved {@link ExportBundle}
 * plus a name, so users can switch between setups (Work / Personal / Minimal).
 * Pure types.
 */

import type { ExportBundle } from './bundle'

export interface ProfileMeta {
  id: string
  name: string
  /** ISO 8601. */
  createdAt: string
  agentIds: string[]
}

export interface Profile {
  meta: ProfileMeta
  bundle: ExportBundle
}
