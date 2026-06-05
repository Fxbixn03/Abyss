import { NavLink } from 'react-router-dom'
import type { NavItem } from '@/app/navigation'
import { PRIMARY_NAV, SETTINGS_NAV } from '@/app/navigation'
import { Icon } from '@/shared/components/Icon'
import { AbyssLogo } from '@/shared/components/AbyssLogo'
import { cn } from '@/shared/lib/utils'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.route}
      end={item.route === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )
      }
    >
      <Icon name={item.icon} className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const agent = useActiveAgent()
  const agentSections = agent.getSidebarSections?.() ?? []

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-3.5">
        <AbyssLogo className="size-7" />
        <span className="font-code text-sm font-semibold tracking-tight text-sidebar-foreground">
          Abyss
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {PRIMARY_NAV.map((item) => (
          <SidebarLink key={item.id} item={item} />
        ))}

        {agentSections.length > 0 && (
          <p className="px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
            {agent.displayName}
          </p>
        )}
        {agentSections.map((section) => (
          <SidebarLink key={section.id} item={section} />
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-2 py-2">
        <SidebarLink item={SETTINGS_NAV} />
      </div>
    </aside>
  )
}
