/**
 * Pure CSV builders for the Analytics page export. Kept framework-free so the
 * page only has to hand the rows to `ipc.saveTextFile`.
 */

import type { UsageAnalytics } from '@/shared/types/chat'

/** Quote a CSV cell when it contains a comma, quote or newline. */
function cell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function rows(lines: (string | number)[][]): string {
  return lines.map((cols) => cols.map(cell).join(',')).join('\n')
}

/**
 * One CSV with three labelled sections (daily series, per-agent, per-project)
 * so the whole analytics snapshot exports in a single file.
 */
export function analyticsToCsv(a: UsageAnalytics): string {
  const daily = rows([
    ['Day', 'Tokens'],
    ...a.daily.map((d) => [d.date, d.tokens]),
  ])
  const byAgent = rows([
    ['Agent', 'Sessions', 'Messages', 'Input tokens', 'Output tokens', 'Est. cost USD'],
    ...a.byAgent.map((g) => [
      g.agentId,
      g.sessions,
      g.messages,
      g.inputTokens,
      g.outputTokens,
      g.estCostUsd.toFixed(4),
    ]),
  ])
  const projects = rows([
    ['Project', 'Path', 'Sessions', 'Messages', 'Input tokens', 'Output tokens', 'Est. cost USD'],
    ...a.projects.map((p) => [
      p.label,
      p.cwd,
      p.sessions,
      p.messages,
      p.inputTokens,
      p.outputTokens,
      p.estCostUsd.toFixed(4),
    ]),
  ])
  return [
    `# Abyss usage analytics — last ${a.days} days`,
    '',
    '## Daily tokens',
    daily,
    '',
    '## By agent',
    byAgent,
    '',
    '## By project',
    projects,
    '',
  ].join('\n')
}
