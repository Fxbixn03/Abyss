import { NavLink, useLocation } from 'react-router-dom'
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
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useSidebarStore } from '@/features/sidebar/store/sidebar.store'
import { useRecentNavStore } from '@/features/navigation/store/recentNav.store'
import {
  useNavPrefsStore,
  isNavHidden,
  applyNavOrder,
} from '@/features/navigation/store/navPrefs.store'

/** Maximum number of recent routes shown in the sidebar pinned section. */
const MAX_PINNED = 3

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
        <TooltipContent side="right">
          <p className="font-medium">{item.label}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

export function Sidebar() {
  const agent = useActiveAgent()
  const agentSections = agent.getSidebarSections?.() ?? []
  const { collapsed, toggle } = useSidebarStore()
  const collapsedGroups = useSidebarStore((s) => s.collapsedGroups)
  const toggleGroup = useSidebarStore((s) => s.toggleGroup)
  const { pathname } = useLocation()
  const recentRoutes = useRecentNavStore((s) => s.routes)
  const betaFeatures = useSettingsStore((s) => s.settings.betaFeatures)
  const hidden = useNavPrefsStore((s) => s.hidden)
  const order = useNavPrefsStore((s) => s.order)

  // Merge static + agent-specific nav, dedupe by route, then bucket into the
  // ordered groups. Empty groups are dropped so each agent only shows what it
  // actually supports. Beta pages and per-agent hidden pages are filtered out.
  const merged: NavItem[] = [...PRIMARY_NAV, ...agentSections]
  const seen = new Set<string>()
  const unique: NavItem[] = []
  for (const item of merged) {
    if (!seen.has(item.route)) {
      seen.add(item.route)
      if (
        (!item.requiresCapability ||
          !!agent.capabilities[item.requiresCapability]) &&
        (betaFeatures || !isBetaRoute(item.route)) &&
        !isNavHidden(hidden, agent.id, item.id)
      ) {
        unique.push(item)
      }
    }
  }

  const ordered = applyNavOrder(unique, order[agent.id])

  const groups = NAV_GROUPS.map((group) => ({
    group,
    items: ordered.filter((item) => groupForRoute(item.route) === group.id),
  })).filter((entry) => entry.items.length > 0)

  // Build a lookup map covering all possible nav items (including agent sections
  // and the settings entry) so recent routes resolve to their NavItem metadata.
  const allNavItems = [...PRIMARY_NAV, ...agentSections, SETTINGS_NAV]
  const navByRoute = new Map(allNavItems.map((item) => [item.route, item]))

  // Show up to MAX_PINNED recent routes, excluding the current page.
  const pinnedItems: NavItem[] = []
  for (const route of recentRoutes) {
    if (route === pathname) continue
    const item = navByRoute.get(route)
    if (item) pinnedItems.push(item)
    if (pinnedItems.length >= MAX_PINNED) break
  }

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
        {pinnedItems.length > 0 && (
          <div
            className={cn(
              'flex flex-col gap-0.5',
              collapsed && 'w-full items-center',
            )}
          >
            {!collapsed && (
              <p
                aria-hidden="true"
                className="px-2.5 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40"
              >
                Recent
              </p>
            )}
            {pinnedItems.map((item) => (
              <SidebarLink key={`pinned-${item.route}`} item={item} collapsed={collapsed} />
            ))}
            {collapsed ? (
              <div className="my-1.5 w-6 border-t border-sidebar-border" />
            ) : (
              <div className="mx-2.5 mb-1 mt-2 border-t border-sidebar-border" />
            )}
          </div>
        )}
        {groups.map(({ group, items }, index) => {
          const groupCollapsed = !collapsed && collapsedGroups.includes(group.id)
          return (
            <div
              key={group.id}
              className={cn(
                'flex flex-col gap-0.5',
                collapsed && 'w-full items-center',
              )}
            >
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!groupCollapsed}
                  className={cn(
                    'group flex items-center gap-1 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70',
                    index === 0 ? 'pt-0.5' : 'pt-3',
                  )}
                >
                  <Icon
                    name={groupCollapsed ? 'chevron-right' : 'chevron-down'}
                    className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  {group.label}
                </button>
              )}
              {collapsed && index > 0 && (
                <div className="my-1.5 w-6 border-t border-sidebar-border" />
              )}
              {!groupCollapsed &&
                items.map((item) => (
                  <SidebarLink key={item.id} item={item} collapsed={collapsed} />
                ))}
            </div>
          )
        })}
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
