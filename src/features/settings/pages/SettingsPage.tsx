import { type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { PathsSection } from '../components/PathsSection'
import { AgentsSection } from '../components/AgentsSection'
import { AppearanceSection } from '../components/AppearanceSection'
import { AgentIconsSection } from '../components/AgentIconsSection'
import { ShortcutsSection } from '../components/ShortcutsSection'
import { PreferencesSection } from '../components/PreferencesSection'
import { BackupsSection } from '../components/BackupsSection'
import { AboutSection } from '../components/AboutSection'
import { ThemeBuilder } from '@/features/themes/components/ThemeBuilder'
import {
  SETTINGS_SECTIONS,
  SETTINGS_CATEGORIES,
  DEFAULT_SETTINGS_SECTION,
} from '../sections'

/** Rendered body per section id (metadata lives in sections.ts). */
const SECTION_RENDER: Record<string, ReactNode> = {
  agents: <AgentsSection />,
  paths: <PathsSection />,
  appearance: <AppearanceSection />,
  'agent-icons': <AgentIconsSection />,
  'theme-builder': <ThemeBuilder />,
  shortcuts: <ShortcutsSection />,
  preferences: <PreferencesSection />,
  backups: <BackupsSection />,
  about: <AboutSection />,
}

export function SettingsPage() {
  // The active section lives in the URL so it's deep-linkable from the command
  // palette (`/settings?s=shortcuts`) and survives back/forward navigation.
  const [params, setParams] = useSearchParams()
  const requested = params.get('s')
  const activeId = SETTINGS_SECTIONS.some((s) => s.id === requested)
    ? (requested as string)
    : DEFAULT_SETTINGS_SECTION

  // Bucket sections into their categories, preserving section order and
  // dropping empty categories — mirrors the sidebar's grouped navigation.
  const groups = SETTINGS_CATEGORIES.map((category) => ({
    category,
    sections: SETTINGS_SECTIONS.filter((s) => s.category === category.id),
  })).filter((g) => g.sections.length > 0)

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Settings"
        description="Paths, appearance and app preferences"
        icon="settings"
      />
      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-4">
        <aside className="flex flex-col gap-0.5 overflow-y-auto pr-1">
          {groups.map(({ category, sections }, index) => (
            <div key={category.id} className="flex flex-col gap-0.5">
              <p
                className={cn(
                  'px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50',
                  index === 0 ? 'pt-0.5' : 'pt-3',
                )}
              >
                {category.label}
              </p>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setParams({ s: s.id })}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                    s.id === activeId
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  <Icon name={s.icon} className="size-4" />
                  {s.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <section className="min-h-0 overflow-y-auto pr-1">
          {SECTION_RENDER[activeId]}
        </section>
      </div>
    </div>
  )
}
