/**
 * Agent icon model.
 *
 * An agent's `icon` is a single string that can encode three kinds of glyph:
 *
 *   - `img:<key>`           a bundled brand mark — inline SVG that inherits the
 *                           surrounding `currentColor`, so it adapts to the theme
 *   - `data:image/...`      a user-supplied custom image (data URL)
 *   - `<lucide-name>`       a Lucide icon name, e.g. `sparkles` (default kind)
 *
 * Keeping it a plain string means `AgentDefinition.iconName` / `AgentAdapter.icon`
 * stay untyped data and the existing string-keyed render sites keep working —
 * lucide names fall straight through to the {@link Icon} registry.
 */

// Imported as raw markup (?raw) so brand marks can be inlined and themed via
// `currentColor` rather than drawn as opaque <img> chips.
import claudeSvg from '@/assets/agents/claude.svg?raw'
import codexSvg from '@/assets/agents/codex.svg?raw'

const IMAGE_PREFIX = 'img:'

/** Bundled brand marks (inline SVG markup), keyed by the `img:<key>` suffix. */
export const AGENT_BRAND_SVGS: Record<string, string> = {
  claude: claudeSvg,
  codex: codexSvg,
}

/** Which of the three render paths an icon string takes. */
export type IconKind = 'brand' | 'image' | 'lucide'

/** Classifies an icon string into its render kind. */
export function iconKind(icon: string): IconKind {
  if (icon.startsWith(IMAGE_PREFIX)) return 'brand'
  if (icon.startsWith('data:')) return 'image'
  return 'lucide'
}

/**
 * Inline SVG markup for an `img:<key>` brand icon, or `null` when the icon is a
 * custom image or a Lucide name. Unknown keys resolve to `null` so the caller
 * can fall back.
 */
export function resolveBrandSvg(icon: string): string | null {
  if (!icon.startsWith(IMAGE_PREFIX)) return null
  return AGENT_BRAND_SVGS[icon.slice(IMAGE_PREFIX.length)] ?? null
}

/** Image `src` for a custom (`data:`) icon, or `null` for brand / Lucide icons. */
export function resolveImageSrc(icon: string): string | null {
  return icon.startsWith('data:') ? icon : null
}

export interface IconChoice {
  /** The icon string stored when this choice is picked. */
  value: string
  label: string
}

/** Brand mark choices offered in the icon picker (one per bundled SVG). */
export const BRAND_ICON_CHOICES: IconChoice[] = [
  { value: 'img:claude', label: 'Claude' },
  { value: 'img:codex', label: 'Codex' },
]

/** Curated Lucide fallbacks offered in the icon picker. */
export const LUCIDE_ICON_CHOICES: IconChoice[] = [
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'bot', label: 'Bot' },
  { value: 'gem', label: 'Gem' },
  { value: 'cpu', label: 'Cpu' },
  { value: 'command', label: 'Command' },
  { value: 'box', label: 'Box' },
  { value: 'braces', label: 'Braces' },
  { value: 'server', label: 'Server' },
]
