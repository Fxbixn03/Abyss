/**
 * Pure-helper tests for:
 *   src/features/themes/lib/builder.ts
 *   src/features/themes/lib/applyFontSize.ts
 *
 * All tested functions are Node-safe (no DOM, no React, no IPC) and
 * deterministic — so these tests are cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeHex,
  colorValue,
  createDraftTheme,
  duplicateTheme,
  cloneTheme,
  STATUS_DEFAULTS,
} from '@/features/themes/lib/builder'
import type { ColorFieldDef } from '@/features/themes/lib/builder'
import { FONT_SIZE_PX } from '@/features/themes/lib/applyFontSize'
import type { ThemeColors, ThemeConfig } from '@/shared/types/theme'

// ── test fixtures ─────────────────────────────────────────────────────────────

const BASE_COLORS: ThemeColors = {
  primary: '#aabbcc',
  primaryForeground: '#ffffff',
  background: '#111111',
  surface: '#222222',
  border: '#333333',
  text: '#eeeeee',
  textMuted: '#888888',
  sidebar: '#1a1a1a',
  sidebarActive: '#2a2a2a',
}

const BASE_THEME: ThemeConfig = {
  id: 'base-theme',
  label: 'Base Theme',
  agentId: 'claude',
  light: { ...BASE_COLORS, primary: '#0000ff' },
  dark: { ...BASE_COLORS, primary: '#ff0000' },
  borderRadius: 'md',
  fontFamily: 'sans',
}

// ── normalizeHex ──────────────────────────────────────────────────────────────

test('normalizeHex: 6-digit hex is returned lowercased unchanged', () => {
  assert.equal(normalizeHex('#aabbcc'), '#aabbcc')
})

test('normalizeHex: 6-digit uppercase hex is lowercased', () => {
  assert.equal(normalizeHex('#AABBCC'), '#aabbcc')
})

test('normalizeHex: 6-digit mixed-case hex is fully lowercased', () => {
  assert.equal(normalizeHex('#AaBbCc'), '#aabbcc')
})

test('normalizeHex: 3-digit hex is expanded to 6 digits (lowercased)', () => {
  assert.equal(normalizeHex('#abc'), '#aabbcc')
})

test('normalizeHex: 3-digit uppercase hex is expanded and lowercased', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc')
})

test('normalizeHex: 3-digit hex #f0f expands to #ff00ff', () => {
  assert.equal(normalizeHex('#f0f'), '#ff00ff')
})

test('normalizeHex: 3-digit hex #000 expands to #000000', () => {
  assert.equal(normalizeHex('#000'), '#000000')
})

test('normalizeHex: 3-digit hex #fff expands to #ffffff', () => {
  assert.equal(normalizeHex('#fff'), '#ffffff')
})

test('normalizeHex: empty string returns #000000', () => {
  assert.equal(normalizeHex(''), '#000000')
})

test('normalizeHex: plain color name returns #000000', () => {
  assert.equal(normalizeHex('red'), '#000000')
})

test('normalizeHex: hex without # prefix returns #000000', () => {
  assert.equal(normalizeHex('aabbcc'), '#000000')
})

test('normalizeHex: 8-digit hex (with alpha) returns #000000', () => {
  assert.equal(normalizeHex('#aabbccdd'), '#000000')
})

test('normalizeHex: whitespace is trimmed before validation', () => {
  assert.equal(normalizeHex('  #aabbcc  '), '#aabbcc')
})

test('normalizeHex: rgb() notation returns #000000', () => {
  assert.equal(normalizeHex('rgb(0,0,0)'), '#000000')
})

// ── colorValue ────────────────────────────────────────────────────────────────

test('colorValue: returns the color field value when present', () => {
  const colors: ThemeColors = { ...BASE_COLORS, primary: '#123456' }
  const field: ColorFieldDef = { key: 'primary', label: 'Primary' }
  assert.equal(colorValue(colors, field), '#123456')
})

test('colorValue: returns text value for text field', () => {
  const colors: ThemeColors = { ...BASE_COLORS, text: '#ffffff' }
  const field: ColorFieldDef = { key: 'text', label: 'Text' }
  assert.equal(colorValue(colors, field), '#ffffff')
})

test('colorValue: falls back to STATUS_DEFAULTS when field is absent', () => {
  // success is optional in ThemeColors — omit it
  const colors: ThemeColors = { ...BASE_COLORS }
  delete colors.success
  const field: ColorFieldDef = { key: 'success', label: 'Success', optional: true }
  assert.equal(colorValue(colors, field), STATUS_DEFAULTS['success'])
})

test('colorValue: falls back to STATUS_DEFAULTS for warning', () => {
  const colors: ThemeColors = { ...BASE_COLORS }
  delete colors.warning
  const field: ColorFieldDef = { key: 'warning', label: 'Warning', optional: true }
  assert.equal(colorValue(colors, field), STATUS_DEFAULTS['warning'])
})

test('colorValue: falls back to STATUS_DEFAULTS for danger', () => {
  const colors: ThemeColors = { ...BASE_COLORS }
  delete colors.danger
  const field: ColorFieldDef = { key: 'danger', label: 'Danger', optional: true }
  assert.equal(colorValue(colors, field), STATUS_DEFAULTS['danger'])
})

test('colorValue: returns #000000 when field absent and no STATUS_DEFAULTS entry', () => {
  // Use a non-status field that is present but force undefined via type cast to
  // simulate a missing required field (edge case / future-proofing).
  const colors = { ...BASE_COLORS } as ThemeColors
  // border is required so we cast to sneak undefined in
  ;(colors as Record<string, unknown>)['border'] = undefined
  const field: ColorFieldDef = { key: 'border', label: 'Border' }
  // STATUS_DEFAULTS has no 'border' key, so must fall through to '#000000'
  assert.equal(colorValue(colors, field), '#000000')
})

test('colorValue: explicit undefined value falls back to STATUS_DEFAULTS success', () => {
  // Simulate optional field set to undefined
  const colors: ThemeColors = { ...BASE_COLORS, success: undefined }
  const field: ColorFieldDef = { key: 'success', label: 'Success', optional: true }
  assert.equal(colorValue(colors, field), STATUS_DEFAULTS['success'])
})

// ── createDraftTheme ──────────────────────────────────────────────────────────

test('createDraftTheme: produces a new id', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.notEqual(draft.id, BASE_THEME.id)
})

test('createDraftTheme: id starts with "custom-"', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.ok(draft.id.startsWith('custom-'), `expected id to start with "custom-", got: ${draft.id}`)
})

test('createDraftTheme: label is "My Theme"', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.equal(draft.label, 'My Theme')
})

test('createDraftTheme: agentId is "*"', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.equal(draft.agentId, '*')
})

test('createDraftTheme: light palette values match base', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.deepEqual(draft.light, BASE_THEME.light)
})

test('createDraftTheme: dark palette values match base', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.deepEqual(draft.dark, BASE_THEME.dark)
})

test('createDraftTheme: light palette is a distinct object (deep copy)', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.notStrictEqual(draft.light, BASE_THEME.light)
})

test('createDraftTheme: dark palette is a distinct object (deep copy)', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.notStrictEqual(draft.dark, BASE_THEME.dark)
})

test('createDraftTheme: mutation of draft light does not affect base light', () => {
  const draft = createDraftTheme(BASE_THEME)
  const originalPrimary = BASE_THEME.light.primary
  draft.light.primary = '#deadbe'
  assert.equal(BASE_THEME.light.primary, originalPrimary)
})

test('createDraftTheme: mutation of draft dark does not affect base dark', () => {
  const draft = createDraftTheme(BASE_THEME)
  const originalPrimary = BASE_THEME.dark.primary
  draft.dark.primary = '#deadbe'
  assert.equal(BASE_THEME.dark.primary, originalPrimary)
})

test('createDraftTheme: borderRadius is preserved from base', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.equal(draft.borderRadius, BASE_THEME.borderRadius)
})

test('createDraftTheme: fontFamily is preserved from base', () => {
  const draft = createDraftTheme(BASE_THEME)
  assert.equal(draft.fontFamily, BASE_THEME.fontFamily)
})

test('createDraftTheme: each call produces a unique id', () => {
  const ids = new Set<string>()
  for (let i = 0; i < 10; i++) {
    ids.add(createDraftTheme(BASE_THEME).id)
  }
  assert.equal(ids.size, 10)
})

// ── duplicateTheme ────────────────────────────────────────────────────────────

test('duplicateTheme: label ends with " Copy"', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.ok(dup.label.endsWith(' Copy'), `expected label to end with " Copy", got: "${dup.label}"`)
})

test('duplicateTheme: label is base label followed by " Copy"', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.equal(dup.label, `${BASE_THEME.label} Copy`)
})

test('duplicateTheme: new id differs from base id', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.notEqual(dup.id, BASE_THEME.id)
})

test('duplicateTheme: agentId is "*" (same as createDraftTheme)', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.equal(dup.agentId, '*')
})

test('duplicateTheme: light palette values match base', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.deepEqual(dup.light, BASE_THEME.light)
})

test('duplicateTheme: dark palette values match base', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.deepEqual(dup.dark, BASE_THEME.dark)
})

test('duplicateTheme: light palette is a distinct object reference', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.notStrictEqual(dup.light, BASE_THEME.light)
})

test('duplicateTheme: dark palette is a distinct object reference', () => {
  const dup = duplicateTheme(BASE_THEME)
  assert.notStrictEqual(dup.dark, BASE_THEME.dark)
})

// ── cloneTheme ────────────────────────────────────────────────────────────────

test('cloneTheme: output is structurally equal to input', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.deepEqual(clone, BASE_THEME)
})

test('cloneTheme: id is identical to source', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.equal(clone.id, BASE_THEME.id)
})

test('cloneTheme: label is identical to source', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.equal(clone.label, BASE_THEME.label)
})

test('cloneTheme: agentId is identical to source', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.equal(clone.agentId, BASE_THEME.agentId)
})

test('cloneTheme: light palette is a distinct object reference', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.notStrictEqual(clone.light, BASE_THEME.light)
})

test('cloneTheme: dark palette is a distinct object reference', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.notStrictEqual(clone.dark, BASE_THEME.dark)
})

test('cloneTheme: top-level object reference is distinct from source', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.notStrictEqual(clone, BASE_THEME)
})

test('cloneTheme: mutation of clone light does not affect source light', () => {
  const clone = cloneTheme(BASE_THEME)
  const originalPrimary = BASE_THEME.light.primary
  clone.light.primary = '#deadbe'
  assert.equal(BASE_THEME.light.primary, originalPrimary)
})

test('cloneTheme: mutation of clone dark does not affect source dark', () => {
  const clone = cloneTheme(BASE_THEME)
  const originalPrimary = BASE_THEME.dark.primary
  clone.dark.primary = '#deadbe'
  assert.equal(BASE_THEME.dark.primary, originalPrimary)
})

test('cloneTheme: borderRadius is preserved', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.equal(clone.borderRadius, BASE_THEME.borderRadius)
})

test('cloneTheme: fontFamily is preserved', () => {
  const clone = cloneTheme(BASE_THEME)
  assert.equal(clone.fontFamily, BASE_THEME.fontFamily)
})

// ── FONT_SIZE_PX (Node-safe constant from applyFontSize.ts) ──────────────────

test('FONT_SIZE_PX: small maps to "13px"', () => {
  assert.equal(FONT_SIZE_PX['small'], '13px')
})

test('FONT_SIZE_PX: medium maps to "14px"', () => {
  assert.equal(FONT_SIZE_PX['medium'], '14px')
})

test('FONT_SIZE_PX: large maps to "15px"', () => {
  assert.equal(FONT_SIZE_PX['large'], '15px')
})

test('FONT_SIZE_PX: has exactly three entries', () => {
  assert.equal(Object.keys(FONT_SIZE_PX).length, 3)
})
