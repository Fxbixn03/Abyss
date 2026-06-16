import type { AppSettings } from '@/shared/types/config'

export type UiFontSize = NonNullable<AppSettings['uiFontSize']>

/** Base UI font size in px per preset. */
export const FONT_SIZE_PX: Record<UiFontSize, string> = {
  tiny: '11px',
  small: '13px',
  medium: '14px',
  large: '15px',
  huge: '18px',
}

/** Allowed range (px) for the custom font-size slider. */
export const FONT_SCALE_MIN = 9
export const FONT_SCALE_MAX = 28

/**
 * Writes `--font-size-base` onto :root from the UI font-size preference. Every
 * component sizes in rem, so changing this var rescales the whole UI live — no
 * reload. A custom px value (when set) overrides the preset; otherwise falls
 * back to the named preset, then medium.
 */
export function applyFontSize(
  size: UiFontSize | undefined,
  customPx?: number,
): void {
  const value =
    customPx !== undefined
      ? `${Math.round(customPx)}px`
      : FONT_SIZE_PX[size ?? 'medium']
  document.documentElement.style.setProperty('--font-size-base', value)
}
