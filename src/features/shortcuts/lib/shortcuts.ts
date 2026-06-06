const MODIFIER_KEYS = ['Control', 'Meta', 'Alt', 'Shift']

/**
 * Normalize a keyboard event into a stable combo string like `Alt+ArrowRight`.
 * Returns null for a bare modifier press (so recording waits for a real key).
 */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.metaKey) parts.push('Meta')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
  return parts.join('+')
}

const KEY_LABEL: Record<string, string> = {
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ' ': 'Space',
}

/** Human-friendly rendering of a combo, e.g. `Alt + →`. */
export function humanizeCombo(combo: string): string {
  if (!combo) return '—'
  return combo
    .split('+')
    .map((p) => KEY_LABEL[p] ?? p)
    .join(' + ')
}
