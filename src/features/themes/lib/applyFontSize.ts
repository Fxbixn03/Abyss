import type { AppSettings } from '@/shared/types/config'

export type UiFontSize = NonNullable<AppSettings['uiFontSize']>

/** Base UI font size in px per preference. */
export const FONT_SIZE_PX: Record<UiFontSize, string> = {
  small: '13px',
  medium: '14px',
  large: '15px',
}

/**
 * Writes `--font-size-base` onto :root from the UI font-size preference. Every
 * component sizes in rem, so changing this var rescales the whole UI live — no
 * reload. Falls back to medium when the preference is unset.
 */
export function applyFontSize(size: UiFontSize | undefined): void {
  document.documentElement.style.setProperty(
    '--font-size-base',
    FONT_SIZE_PX[size ?? 'medium'],
  )
}
