import i18n, { type Resource, type ResourceLanguage } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_APP_SETTINGS } from '@/shared/types/config'

/**
 * Bundled translation resources, auto-assembled from every JSON under
 * `locales/<lng>/<namespace>.json`. Files are imported (not fetched), so this
 * stays renderer-safe — no Node, no async backend. Dropping a new `*.json` (a
 * new namespace or language) is picked up automatically; only the typed key
 * surface in `i18next.d.ts` needs a matching line for compile-time checking.
 *
 * The active language is driven at runtime by `useLocaleApplier`, mirroring how
 * the theme is applied.
 */
const modules = import.meta.glob<Record<string, unknown>>(
  './locales/*/*.json',
  { eager: true, import: 'default' },
)

const resources: Resource = {}
for (const [path, data] of Object.entries(modules)) {
  const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path)
  if (!match) continue
  const [, lng, ns] = match
  const language = (resources[lng] ??= {}) as ResourceLanguage
  language[ns] = data
}

export { resources }

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_APP_SETTINGS.language,
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
})

export default i18n
