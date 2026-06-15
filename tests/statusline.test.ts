/**
 * Pure-helper tests for src/shared/statusline/segments.ts (node:test).
 * `renderStatusLine` is browser-safe and fully deterministic — no IPC, no
 * React, no disk access — so it runs cleanly under node:test with tsx.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  renderStatusLine,
  SEGMENT_DEFS,
  SAMPLE_STATUSLINE_DATA,
} from '@/shared/statusline/segments'

// ── helpers ───────────────────────────────────────────────────────────────────

const defaultCfg = {
  segments: ['model', 'dir', 'gitBranch', 'context'] as const,
  separator: '  ',
  dirBasename: true,
  icons: false,
} satisfies Parameters<typeof renderStatusLine>[0]

// ── SegmentFormat: text ───────────────────────────────────────────────────────

test('text format: model segment renders display_name as plain text', () => {
  const result = renderStatusLine(
    { segments: ['model'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, model: { id: 'claude-3', display_name: 'Sonnet' } },
  )
  assert.equal(result, 'Sonnet')
})

test('text format: version segment renders version string', () => {
  const result = renderStatusLine(
    { segments: ['version'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, version: '3.0.0' },
  )
  assert.equal(result, '3.0.0')
})

test('text format: outputStyle segment renders style name', () => {
  const result = renderStatusLine(
    { segments: ['outputStyle'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, output_style: { name: 'compact' } },
  )
  assert.equal(result, 'compact')
})

// ── SegmentFormat: basename ───────────────────────────────────────────────────

test('basename format: dir segment extracts last path component when dirBasename=true', () => {
  const result = renderStatusLine(
    { segments: ['dir'], separator: '|', dirBasename: true, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      workspace: {
        current_dir: '/home/user/projects/myapp',
        project_dir: '/home/user/projects/myapp',
      },
    },
  )
  assert.equal(result, 'myapp')
})

test('basename format: dir segment renders full path when dirBasename=false', () => {
  const fullPath = '/home/user/projects/myapp'
  const result = renderStatusLine(
    { segments: ['dir'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      workspace: { current_dir: fullPath, project_dir: fullPath },
    },
  )
  assert.equal(result, fullPath)
})

test('basename format: projectDir segment extracts last path component when dirBasename=true', () => {
  const result = renderStatusLine(
    { segments: ['projectDir'], separator: '|', dirBasename: true, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      workspace: {
        current_dir: '/home/user/repos/abyss',
        project_dir: '/home/user/repos/abyss',
      },
    },
  )
  assert.equal(result, 'abyss')
})

// ── SegmentFormat: percent ────────────────────────────────────────────────────

test('percent format: context segment renders rounded value with % suffix', () => {
  const result = renderStatusLine(
    { segments: ['context'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, context_window: { used_percentage: 42 } },
  )
  assert.equal(result, '42%')
})

test('percent format: context segment rounds fractional percentage', () => {
  const result = renderStatusLine(
    { segments: ['context'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, context_window: { used_percentage: 33.7 } },
  )
  assert.equal(result, '34%')
})

test('percent format: context segment handles 0%', () => {
  const result = renderStatusLine(
    { segments: ['context'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, context_window: { used_percentage: 0 } },
  )
  assert.equal(result, '0%')
})

test('percent format: context segment handles 100%', () => {
  const result = renderStatusLine(
    { segments: ['context'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, context_window: { used_percentage: 100 } },
  )
  assert.equal(result, '100%')
})

// ── SegmentFormat: money ──────────────────────────────────────────────────────

test('money format: cost segment renders with $ prefix and two decimal places', () => {
  const result = renderStatusLine(
    { segments: ['cost'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      cost: { total_cost_usd: 1.5, total_lines_added: 0, total_lines_removed: 0 },
    },
  )
  assert.equal(result, '$1.50')
})

test('money format: cost segment renders zero cost as $0.00', () => {
  const result = renderStatusLine(
    { segments: ['cost'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      cost: { total_cost_usd: 0, total_lines_added: 0, total_lines_removed: 0 },
    },
  )
  assert.equal(result, '$0.00')
})

test('money format: cost segment rounds to two decimal places', () => {
  const result = renderStatusLine(
    { segments: ['cost'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      cost: { total_cost_usd: 0.12345, total_lines_added: 0, total_lines_removed: 0 },
    },
  )
  assert.equal(result, '$0.12')
})

// ── SegmentFormat: shortid ────────────────────────────────────────────────────

test('shortid format: session segment renders first 8 characters of session_id', () => {
  const result = renderStatusLine(
    { segments: ['session'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      session_id: 'a1b2c3d4-5e6f-7890-abcd-ef0123456789',
    },
  )
  assert.equal(result, 'a1b2c3d4')
})

test('shortid format: session_id shorter than 8 chars renders the full string', () => {
  const result = renderStatusLine(
    { segments: ['session'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, session_id: 'abc' },
  )
  assert.equal(result, 'abc')
})

// ── SegmentFormat: lines ──────────────────────────────────────────────────────

test('lines format: renders added and removed counts with +/- notation', () => {
  const result = renderStatusLine(
    { segments: ['lines'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      cost: { total_cost_usd: 0, total_lines_added: 42, total_lines_removed: 7 },
    },
  )
  assert.equal(result, '+42 -7')
})

test('lines format: renders zero lines as +0 -0', () => {
  const result = renderStatusLine(
    { segments: ['lines'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      cost: { total_cost_usd: 0, total_lines_added: 0, total_lines_removed: 0 },
    },
  )
  assert.equal(result, '+0 -0')
})

test('lines format: large line counts render correctly', () => {
  const result = renderStatusLine(
    { segments: ['lines'], separator: '|', dirBasename: false, icons: false },
    {
      ...SAMPLE_STATUSLINE_DATA,
      cost: { total_cost_usd: 0, total_lines_added: 1000, total_lines_removed: 500 },
    },
  )
  assert.equal(result, '+1000 -500')
})

// ── Icon toggling (icons: true / false) ───────────────────────────────────────

test('icons=false: no icon prefix is added to segments', () => {
  const result = renderStatusLine(
    { segments: ['model'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, model: { id: 'opus', display_name: 'Opus' } },
  )
  // Must not start with the ⚡ icon
  assert.equal(result, 'Opus')
  assert.ok(!result.startsWith('⚡'), 'should not include icon prefix')
})

test('icons=true: icon is prepended before segment value', () => {
  const result = renderStatusLine(
    { segments: ['model'], separator: '|', dirBasename: false, icons: true },
    { ...SAMPLE_STATUSLINE_DATA, model: { id: 'opus', display_name: 'Opus' } },
  )
  const modelDef = SEGMENT_DEFS.find((d) => d.id === 'model')
  assert.ok(modelDef, 'model segment def should exist')
  assert.equal(result, `${modelDef.icon} Opus`)
})

test('icons=true: git branch segment includes its icon', () => {
  const result = renderStatusLine(
    { segments: ['gitBranch'], separator: '|', dirBasename: false, icons: true },
    { ...SAMPLE_STATUSLINE_DATA, gitBranch: 'main' },
  )
  const def = SEGMENT_DEFS.find((d) => d.id === 'gitBranch')
  assert.ok(def, 'gitBranch segment def should exist')
  assert.equal(result, `${def.icon} main`)
})

test('icons=true: percent segment includes its icon', () => {
  const result = renderStatusLine(
    { segments: ['context'], separator: '|', dirBasename: false, icons: true },
    { ...SAMPLE_STATUSLINE_DATA, context_window: { used_percentage: 50 } },
  )
  const def = SEGMENT_DEFS.find((d) => d.id === 'context')
  assert.ok(def, 'context segment def should exist')
  assert.equal(result, `${def.icon} 50%`)
})

test('icons=false vs icons=true differ only in prefix', () => {
  const cfg = {
    segments: ['version'] as const,
    separator: '|',
    dirBasename: false,
  }
  const withoutIcons = renderStatusLine(
    { ...cfg, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, version: '1.0.0' },
  )
  const withIcons = renderStatusLine(
    { ...cfg, icons: true },
    { ...SAMPLE_STATUSLINE_DATA, version: '1.0.0' },
  )
  const def = SEGMENT_DEFS.find((d) => d.id === 'version')
  assert.ok(def)
  assert.equal(withoutIcons, '1.0.0')
  assert.equal(withIcons, `${def.icon} 1.0.0`)
})

// ── Custom separators ─────────────────────────────────────────────────────────

test('custom separator: pipe-separated segments', () => {
  const result = renderStatusLine(
    {
      segments: ['model', 'version'],
      separator: ' | ',
      dirBasename: false,
      icons: false,
    },
    {
      ...SAMPLE_STATUSLINE_DATA,
      model: { id: 'opus', display_name: 'Opus' },
      version: '2.0.0',
    },
  )
  assert.equal(result, 'Opus | 2.0.0')
})

test('custom separator: space-separated segments', () => {
  const result = renderStatusLine(
    {
      segments: ['model', 'version'],
      separator: ' ',
      dirBasename: false,
      icons: false,
    },
    {
      ...SAMPLE_STATUSLINE_DATA,
      model: { id: 'opus', display_name: 'Opus' },
      version: '2.0.0',
    },
  )
  assert.equal(result, 'Opus 2.0.0')
})

test('custom separator: double-space separator (default)', () => {
  const result = renderStatusLine(
    {
      segments: ['model', 'version'],
      separator: '  ',
      dirBasename: false,
      icons: false,
    },
    {
      ...SAMPLE_STATUSLINE_DATA,
      model: { id: 'opus', display_name: 'Opus' },
      version: '2.0.0',
    },
  )
  assert.equal(result, 'Opus  2.0.0')
})

test('custom separator: arrow separator between three segments', () => {
  const result = renderStatusLine(
    {
      segments: ['model', 'dir', 'version'],
      separator: ' → ',
      dirBasename: true,
      icons: false,
    },
    {
      ...SAMPLE_STATUSLINE_DATA,
      model: { id: 'opus', display_name: 'Opus' },
      workspace: { current_dir: '/home/user/myapp', project_dir: '/home/user/myapp' },
      version: '2.0.0',
    },
  )
  assert.equal(result, 'Opus → myapp → 2.0.0')
})

test('single segment has no separator characters', () => {
  const result = renderStatusLine(
    { segments: ['model'], separator: ' | ', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, model: { id: 'opus', display_name: 'Opus' } },
  )
  assert.equal(result, 'Opus')
  assert.ok(!result.includes('|'), 'single segment should not include separator')
})

// ── Git source (gitBranch) ────────────────────────────────────────────────────

test('gitBranch: renders the branch name from data.gitBranch', () => {
  const result = renderStatusLine(
    { segments: ['gitBranch'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, gitBranch: 'feature/my-feature' },
  )
  assert.equal(result, 'feature/my-feature')
})

test('gitBranch: main branch renders as "main"', () => {
  const result = renderStatusLine(
    { segments: ['gitBranch'], separator: '|', dirBasename: false, icons: false },
    { ...SAMPLE_STATUSLINE_DATA, gitBranch: 'main' },
  )
  assert.equal(result, 'main')
})

test('gitBranch: empty string is silently skipped (segment omitted)', () => {
  const result = renderStatusLine(
    {
      segments: ['model', 'gitBranch', 'version'],
      separator: ' | ',
      dirBasename: false,
      icons: false,
    },
    {
      ...SAMPLE_STATUSLINE_DATA,
      model: { id: 'opus', display_name: 'Opus' },
      gitBranch: '',
      version: '1.0.0',
    },
  )
  // gitBranch should be absent from the output
  assert.equal(result, 'Opus | 1.0.0')
})

test('gitBranch source ignores the path field (uses data.gitBranch directly)', () => {
  // The gitBranch segment has source='git'; it bypasses the json path resolution
  const def = SEGMENT_DEFS.find((d) => d.id === 'gitBranch')
  assert.ok(def, 'gitBranch def should exist')
  assert.equal(def.source, 'git')
  assert.equal(def.path, undefined)
})

// ── Unknown / invalid segment ids are silently skipped ────────────────────────

test('unknown segment id is silently skipped and does not throw', () => {
  // Cast through unknown to inject an id that doesn't exist in the registry
  const unknownId = 'nonExistentSegment' as Parameters<typeof renderStatusLine>[0]['segments'][number]
  const result = renderStatusLine(
    {
      segments: [unknownId, 'version'],
      separator: '|',
      dirBasename: false,
      icons: false,
    },
    { ...SAMPLE_STATUSLINE_DATA, version: '9.9.9' },
  )
  assert.equal(result, '9.9.9')
})

test('all unknown segment ids produce empty output', () => {
  const unknownId = 'nonExistentSegment' as Parameters<typeof renderStatusLine>[0]['segments'][number]
  const result = renderStatusLine(
    { segments: [unknownId], separator: '|', dirBasename: false, icons: false },
    SAMPLE_STATUSLINE_DATA,
  )
  assert.equal(result, '')
})

test('empty segments array produces empty string', () => {
  const result = renderStatusLine(
    { segments: [], separator: '|', dirBasename: false, icons: false },
    SAMPLE_STATUSLINE_DATA,
  )
  assert.equal(result, '')
})

// ── Multi-segment rendering with sample data ──────────────────────────────────

test('renderStatusLine with multiple segments joins them with separator', () => {
  const result = renderStatusLine(
    {
      segments: ['model', 'version', 'context'],
      separator: ' | ',
      dirBasename: false,
      icons: false,
    },
    {
      ...SAMPLE_STATUSLINE_DATA,
      model: { id: 'opus', display_name: 'Opus' },
      version: '1.0.0',
      context_window: { used_percentage: 75 },
    },
  )
  assert.equal(result, 'Opus | 1.0.0 | 75%')
})

test('renderStatusLine uses SAMPLE_STATUSLINE_DATA by default', () => {
  const result = renderStatusLine(defaultCfg)
  // Should render something non-empty from the sample data
  assert.ok(result.length > 0, 'should produce non-empty output from sample data')
})

test('renderStatusLine with icons and default sample data includes icon prefix', () => {
  const result = renderStatusLine({ ...defaultCfg, icons: true })
  const modelDef = SEGMENT_DEFS.find((d) => d.id === 'model')
  assert.ok(modelDef)
  assert.ok(result.includes(modelDef.icon), 'output should include model icon')
})

// ── Null / missing values are skipped ────────────────────────────────────────

test('segment with missing path data is omitted from output', () => {
  // version is '' which should cause the segment to be skipped
  const result = renderStatusLine(
    {
      segments: ['model', 'version'],
      separator: ' | ',
      dirBasename: false,
      icons: false,
    },
    { ...SAMPLE_STATUSLINE_DATA, model: { id: 'opus', display_name: 'Opus' }, version: '' },
  )
  // version segment skipped because value is empty string
  assert.equal(result, 'Opus')
})
