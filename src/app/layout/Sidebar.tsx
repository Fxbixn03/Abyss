import { NavLink } from 'react-router-dom'
import type { NavItem } from '@/app/navigation'
import {
  PRIMARY_NAV,
  SETTINGS_NAV,
  NAV_GROUPS,
  groupForRoute,
  isBetaRoute,
} from '@/app/navigation'
import { Icon } from '@/shared/components/Icon'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { AbyssLogo } from '@/shared/components/AbyssLogo'
import { cn } from '@/shared/lib/utils'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useSidebarStore } from '@/features/sidebar/store/sidebar.store'

function SidebarLink({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
  const isBeta = isBetaRoute(item.route)

  const link = (
    <NavLink
      to={item.route}
      end={item.route === '/'}
      title={collapsed ? undefined : item.description}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md transition-colors',
          collapsed
            ? 'size-9 justify-center'
            : 'gap-2.5 px-2.5 py-2 text-sm font-medium',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )
      }
    >
      <Icon name={item.icon} className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {isBeta && (
            <Badge
              variant="outline"
              className="ml-auto shrink-0 text-[10px] uppercase tracking-wide"
            >
              Beta
            </Badge>
          )}
        </>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

export function Sidebar() {
  const agent = useActiveAgent()
  const agentSections = agent.getSidebarSections?.() ?? []
  const { collapsed, toggle } = useSidebarStore()

  // Merge static + agent-specific nav, dedupe by route, then bucket into the
  // ordered groups. Empty groups are dropped so each agent only shows what it
  // actually supports.
  const merged: NavItem[] = [...PRIMARY_NAV, ...agentSections]
  const seen = new Set<string>()
  const unique: NavItem[] = []
  for (const item of merged) {
    if (!seen.has(item.route)) {
      seen.add(item.route)
      if (
        !item.requiresCapability ||
        !!agent.capabilities[item.requiresCapability]
      ) {
        unique.push(item)
      }
    }
  }

  const groups = NAV_GROUPS.map((group) => ({
    group,
    items: unique.filter((item) => groupForRoute(item.route) === group.id),
  })).filter((entry) => entry.items.length > 0)

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        'flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-[52px]' : 'w-[220px]',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          collapsed ? 'justify-center px-0 py-3.5' : 'px-4 py-3.5',
        )}
      >
        <AbyssLogo className="size-7 shrink-0" />
        {!collapsed && (
          <span className="font-code text-sm font-semibold tracking-tight text-sidebar-foreground">
            Abyss
          </span>
        )}
      </div>

      <div className="mx-3 border-b border-sidebar-border" />

      <nav
        aria-label="Main navigation"
        className={cn(
          'flex flex-1 flex-col gap-0.5 overflow-y-auto py-2',
          collapsed ? 'items-center px-1.5' : 'px-2',
        )}
      >
        {groups.map(({ group, items }, index) => (
          <div
            key={group.id}
            className={cn('flex flex-col gap-0.5', collapsed && 'w-full items-center')}
          >
            {!collapsed && (
              <p
                aria-hidden="true"
                className={cn(
                  'px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40',
                  index === 0 ? 'pt-0.5' : 'pt-3',
                )}
              >
                {group.label}
              </p>
            )}
            {collapsed && index > 0 && (
              <div className="my-1.5 w-6 border-t border-sidebar-border" />
            )}
            {items.map((item) => (
              <SidebarLink key={item.id} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'border-t border-sidebar-border',
          collapsed ? 'flex flex-col items-center gap-1 px-1.5 py-2' : 'px-2 py-2',
        )}
      >
        <SidebarLink item={SETTINGS_NAV} collapsed={collapsed} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggle}
              className={cn(
                'text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                collapsed ? 'mt-0' : 'mt-1 w-full justify-start px-2.5',
              )}
            >
              <Icon
                name={collapsed ? 'chevron-right' : 'chevron-left'}
                className="size-4 shrink-0"
              />
              {!collapsed && (
                <span className="text-xs font-medium">Collapse</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
