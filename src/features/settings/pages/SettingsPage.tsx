import { useState, type ReactNode } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { PathsSection } from '../components/PathsSection'
import { AppearanceSection } from '../components/AppearanceSection'
import { PreferencesSection } from '../components/PreferencesSection'
import { AboutSection } from '../components/AboutSection'

interface Section {
  id: string
  label: string
  icon: string
  render: ReactNode
}

const SECTIONS: Section[] = [
  { id: 'paths', label: 'Config Paths', icon: 'folder', render: <PathsSection /> },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'palette',
    render: <AppearanceSection />,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: 'sliders',
    render: <PreferencesSection />,
  },
  { id: 'about', label: 'About', icon: 'info', render: <AboutSection /> },
]

export function SettingsPage() {
  const [activeId, setActiveId] = useState('paths')
  const section = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0]

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Settings"
        description="Paths, appearance and app preferences"
        icon="settings"
      />
      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-4">
        <aside className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
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
        </aside>
        <section className="min-h-0 overflow-y-auto pr-1">
          {section.render}
        </section>
      </div>
    </div>
  )
}
