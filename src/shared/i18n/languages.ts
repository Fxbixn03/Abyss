/** UI languages Abyss ships translations for. Add a code here + a matching
 *  locale folder under `locales/<code>/` (and register it in `index.ts`). */
export interface SupportedLanguage {
  code: string
  /** Endonym — shown the same way regardless of the active UI language. */
  label: string
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
]
