/**
 * The canonical status-line segment registry, shared by the live preview (this
 * module, browser-safe) and the generated Node script (`core/statusline.ts`
 * serialises these defs into the script). Keep the renderer here and the
 * interpreter embedded in the generated script in lockstep — both consume the
 * same `{ source, path, format }` data, so only the tiny format switch is
 * duplicated.
 */

import type {
  StatusLineConfig,
  StatusLineSegmentId,
} from '@/shared/types/statusline'

export type SegmentFormat =
  | 'text'
  | 'basename'
  | 'percent'
  | 'money'
  | 'lines'
  | 'shortid'

export type SegmentSource = 'json' | 'git'

export interface SegmentDef {
  id: StatusLineSegmentId
  label: string
  description: string
  /** Glyph shown when `icons` is enabled. */
  icon: string
  source: SegmentSource
  /** Dot-path into the stdin JSON (json source only). */
  path?: string
  format: SegmentFormat
}

export const SEGMENT_DEFS: SegmentDef[] = [
  {
    id: 'model',
    label: 'Model',
    description: 'Active model display name',
    icon: '⚡',
    source: 'json',
    path: 'model.display_name',
    format: 'text',
  },
  {
    id: 'dir',
    label: 'Directory',
    description: 'Current working directory',
    icon: '📁',
    source: 'json',
    path: 'workspace.current_dir',
    format: 'basename',
  },
  {
    id: 'projectDir',
    label: 'Project dir',
    description: 'Directory Claude Code was launched from',
    icon: '🗂',
    source: 'json',
    path: 'workspace.project_dir',
    format: 'basename',
  },
  {
    id: 'gitBranch',
    label: 'Git branch',
    description: 'Current branch (runs git in the working dir)',
    icon: '⎇',
    source: 'git',
    format: 'text',
  },
  {
    id: 'context',
    label: 'Context %',
    description: 'Percentage of the context window in use',
    icon: '◔',
    source: 'json',
    path: 'context_window.used_percentage',
    format: 'percent',
  },
  {
    id: 'cost',
    label: 'Cost',
    description: 'Estimated session cost in USD',
    icon: '💰',
    source: 'json',
    path: 'cost.total_cost_usd',
    format: 'money',
  },
  {
    id: 'lines',
    label: 'Lines ±',
    description: 'Lines added / removed this session',
    icon: '±',
    source: 'json',
    format: 'lines',
  },
  {
    id: 'outputStyle',
    label: 'Output style',
    description: 'Name of the active output style',
    icon: '🎨',
    source: 'json',
    path: 'output_style.name',
    format: 'text',
  },
  {
    id: 'version',
    label: 'Version',
    description: 'Claude Code version',
    icon: 'v',
    source: 'json',
    path: 'version',
    format: 'text',
  },
  {
    id: 'session',
    label: 'Session',
    description: 'Short session identifier',
    icon: '#',
    source: 'json',
    path: 'session_id',
    format: 'shortid',
  },
]

export function getSegmentDef(id: StatusLineSegmentId): SegmentDef | undefined {
  return SEGMENT_DEFS.find((d) => d.id === id)
}

/** Sample stdin payload used to render the live preview. */
export const SAMPLE_STATUSLINE_DATA = {
  model: { id: 'claude-opus-4-8', display_name: 'Opus' },
  workspace: {
    current_dir: '/home/you/code/repos/abyss',
    project_dir: '/home/you/code/repos/abyss',
  },
  context_window: { used_percentage: 42 },
  cost: { total_cost_usd: 0.1234, total_lines_added: 156, total_lines_removed: 23 },
  output_style: { name: 'default' },
  version: '2.1.90',
  session_id: 'a1b2c3d4-5e6f-7890-abcd-ef0123456789',
  gitBranch: 'main',
} as const

type SampleData = typeof SAMPLE_STATUSLINE_DATA

function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc != null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    )
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

/** Render a single segment's value (without its icon), or null to skip it. */
function formatValue(
  def: SegmentDef,
  data: SampleData,
  dirBasename: boolean,
): string | null {
  if (def.source === 'git') return data.gitBranch || null
  if (def.format === 'lines') {
    const added = Number(getPath(data, 'cost.total_lines_added') ?? 0)
    const removed = Number(getPath(data, 'cost.total_lines_removed') ?? 0)
    return `+${added} -${removed}`
  }
  const raw = def.path ? getPath(data, def.path) : undefined
  if (raw == null || raw === '') return null
  switch (def.format) {
    case 'basename':
      return dirBasename ? basename(String(raw)) : String(raw)
    case 'percent':
      return `${Math.round(Number(raw))}%`
    case 'money':
      return `$${Number(raw).toFixed(2)}`
    case 'shortid':
      return String(raw).slice(0, 8)
    default:
      return String(raw)
  }
}

/** Render the full status line as Claude Code would, given sample data. */
export function renderStatusLine(
  cfg: Pick<StatusLineConfig, 'segments' | 'separator' | 'dirBasename' | 'icons'>,
  data: SampleData = SAMPLE_STATUSLINE_DATA,
): string {
  const parts: string[] = []
  for (const id of cfg.segments) {
    const def = getSegmentDef(id)
    if (!def) continue
    const value = formatValue(def, data, cfg.dirBasename)
    if (value == null || value === '') continue
    parts.push(cfg.icons && def.icon ? `${def.icon} ${value}` : value)
  }
  return parts.join(cfg.separator)
}
