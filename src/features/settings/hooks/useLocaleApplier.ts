import { useEffect } from 'react'
import i18n from '@/shared/i18n'
import { useSettingsStore } from '../store/settings.store'

/**
 * Watches the configured UI language and applies it to the i18next instance
 * (and the document's <html lang>) at runtime — no reload, mirroring
 * `useThemeApplier`. Mount once at the app root.
 */
export function useLocaleApplier(): void {
  const language = useSettingsStore((s) => s.settings.language)

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language)
    document.documentElement.lang = language
  }, [language])
}
