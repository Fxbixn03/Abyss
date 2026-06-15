import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CollectionKind } from '@/shared/types/collections'
import type {
  GlobalSearchKind,
  GlobalSearchResult,
} from '@/shared/search/types'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'
import { PRIMARY_NAV, SETTINGS_NAV } from '@/app/navigation'
import type { NavItem } from '@/app/navigation'
import { useCommandPalette } from '@/app/command/commandPalette.store'
import {
  useRecentNavStore,
  MAX_RECENT_SHOWN,
} from '@/features/navigation/store/recentNav.store'
import {
  useRecentActionsStore,
  MAX_RECENT_ACTIONS_SHOWN,
} from '@/features/navigation/store/recentActions.store'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { useAgentStore } from '@/features/agents/store/agent.store'
import { applyTheme } from '@/features/themes/lib/applyTheme'
import { useThemeStore } from '@/features/themes/store/theme.store'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useCollectionSelection } from '@/features/collections/store/collectionSelection.store'
import { useTemplatesStore } from '@/features/templates/store/templates.store'
import { useTemplatesIntent } from '@/features/templates/store/templatesIntent.store'
import { resolveTemplates } from '@/features/templates/lib/resolve'
import { SETTINGS_SECTIONS } from '@/features/settings/sections'
import { useShortcutsStore } from '@/features/shortcuts/store/shortcuts.store'
import { humanizeCombo } from '@/features/shortcuts/lib/shortcuts'

/**
 * Maps a nav route to the shortcut action id that navigates to it.
 * Drives the keyboard-hint chips rendered beside Go-to items in the palette.
 */
const ROUTE_SHORTCUT: Record<string, string> = {
  '/': 'nav.dashboard',
  '/config': 'nav.config',
  '/settings': 'nav.settings',
  '/mcp': 'nav.mcp',
  '/hooks': 'nav.hooks',
  '/doctor': 'nav.doctor',
  '/history': 'nav.snapshots',
  '/sessions': 'nav.sessions',
  '/compare': 'nav.compare',
  '/permissions': 'nav.permissions',
  '/workspace': 'nav.workspace',
  '/profiles': 'nav.profiles',
  '/bundles': 'nav.bundles',
}

/** Renders a themed keyboard shortcut chip. */
function ShortcutHint({ combo }: { combo: string }) {
  if (!combo) return null
  return (
    <kbd className="ml-auto shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-code text-[11px] text-muted-foreground">
      {humanizeCombo(combo)}
    </kbd>
  )
}

const COLLECTION_KINDS: CollectionKind[] = [
  'agents',
  'commands',
  'skills',
  'rules',
]
const KIND_ICON: Record<CollectionKind, string> = {
  agents: 'bot',
  commands: 'square-slash',
  skills: 'graduation-cap',
  rules: 'book-open',
}

const GLOBAL_KIND_ICON: Record<GlobalSearchKind, string> = {
  mcp: 'plug',
  hook: 'webhook',
  permission: 'lock',
  skill: 'graduation-cap',
  command: 'square-slash',
  subagent: 'bot',
  rule: 'book-open',
}

interface PaletteItem {
  kind: CollectionKind
  id: string
  name: string
  description: string
  /** File body, so the palette finds an item by what's written inside it. */
  content: string
}

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open)
  const setOpen = useCommandPalette((s) => s.setOpen)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* The body lives inside the dialog content, which unmounts on close, so
          its search/items state resets cleanly every time the palette opens. */}
      <PaletteBody onClose={() => setOpen(false)} />
    </CommandDialog>
  )
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

  const agents = useAllAgents()
  const activeAgent = useActiveAgent()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const basePath = useConfigBase(activeAgent.id)
  const requestOpen = useCollectionSelection((s) => s.requestOpen)
  const requestApplyTemplate = useTemplatesIntent((s) => s.requestApply)
  const customTemplates = useTemplatesStore((s) => s.customTemplates)
  const builtinOverrides = useTemplatesStore((s) => s.builtinOverrides)
  const hiddenBuiltins = useTemplatesStore((s) => s.hiddenBuiltins)
  const templates = useMemo(
    () =>
      resolveTemplates({ customTemplates, builtinOverrides, hiddenBuiltins }),
    [customTemplates, builtinOverrides, hiddenBuiltins],
  )

  const [items, setItems] = useState<PaletteItem[]>([])
  const [search, setSearch] = useState('')
  const [globalIndex, setGlobalIndex] = useState<GlobalSearchResult[]>([])

  // Index every agent's hooks / MCP / permissions / collections once per open,
  // so the search can reach config that doesn't belong to the active agent.
  useEffect(() => {
    let active = true
    ipc
      .globalConfigSearch()
      .then((res) => {
        if (active) setGlobalIndex(res)
      })
      .catch((err) => {
        // Cross-agent search is an enhancement: log the failure via the error
        // framework but keep it silent so a bad config never breaks the palette.
        reportError(err, {
          title: "Couldn't build cross-agent search",
          silent: true,
        })
      })
    return () => {
      active = false
    }
  }, [])

  const agentNames = useMemo(
    () => new Map(agents.map((a) => [a.id, a.displayName])),
    [agents],
  )

  // Substring-match the global index ourselves (cheap, predictable), capped so
  // the palette stays readable. We inject the query as a keyword below so cmdk
  // keeps these items in the rendered list.
  const globalMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return globalIndex
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.detail.toLowerCase().includes(q) ||
          r.kind.includes(q) ||
          (agentNames.get(r.agentId) ?? r.agentId).toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [globalIndex, search, agentNames])

  // Lowercase each item's body once per loaded set. Searching it with a plain
  // substring test (below) stays fast even for multi-KB files — feeding those
  // bodies to cmdk's fuzzy scorer as keywords is what made typing stutter.
  const contentIndex = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of items) map.set(`${i.kind}-${i.id}`, i.content.toLowerCase())
    return map
  }, [items])

  // Keys of items whose body contains the query. We inject the query into those
  // items' keywords so cmdk keeps them, without it having to scan the body.
  const contentMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    const hits = new Set<string>()
    if (q.length < 2) return hits
    for (const [key, text] of contentIndex) {
      if (text.includes(q)) hits.add(key)
    }
    return hits
  }, [contentIndex, search])

  useEffect(() => {
    if (!basePath) return
    let active = true
    const kinds = COLLECTION_KINDS.filter((k) => activeAgent.capabilities[k])
    void Promise.all(
      kinds.map((kind) =>
        ipc
          .listCollection(activeAgent.id, basePath, kind)
          .then((list) =>
            Promise.all(
              list.map(async (i) => {
                // Pull the file body so items are findable by their contents,
                // not just their name/description.
                const content = await ipc
                  .readCollectionItem(activeAgent.id, basePath, kind, i.id)
                  .then((r) => r.content)
                  .catch(() => '')
                return {
                  kind,
                  id: i.id,
                  name: i.name,
                  description: i.description,
                  content,
                }
              }),
            ),
          )
          .catch(() => [] as PaletteItem[]),
      ),
    ).then((res) => {
      if (active) setItems(res.flat())
    })
    return () => {
      active = false
    }
  }, [basePath, activeAgent.id, activeAgent.capabilities])

  const bindings = useShortcutsStore((s) => s.bindings)

  const toggleAppearance = useThemeStore((s) => s.toggleAppearance)
  const setAgentTheme = useThemeStore((s) => s.setAgentTheme)
  const getThemesForAgent = useThemeStore((s) => s.getThemesForAgent)
  const appearance = useThemeStore((s) => s.appearance)
  const activeTheme = useThemeStore((s) => s.getActiveTheme(activeAgent.id))
  const themes = getThemesForAgent(activeAgent.id)

  const restoreActiveTheme = useCallback(() => {
    applyTheme(activeTheme, appearance)
  }, [activeTheme, appearance])

  // Restore the active theme when the palette unmounts (e.g. Escape during hover).
  useEffect(() => {
    return () => {
      restoreActiveTheme()
    }
  }, [restoreActiveTheme])

  const navItems = [
    ...PRIMARY_NAV.filter(
      (item) =>
        !item.requiresCapability ||
        !!activeAgent.capabilities[item.requiresCapability],
    ),
    ...(activeAgent.getSidebarSections?.() ?? []),
    SETTINGS_NAV,
  ]

  // All possible nav entries for label/icon lookup (regardless of capability filter).
  const allNavItems = useMemo(
    () => [...PRIMARY_NAV, ...(activeAgent.getSidebarSections?.() ?? []), SETTINGS_NAV],
    [activeAgent],
  )
  const navByRoute = useMemo(
    () => new Map(allNavItems.map((item) => [item.route, item])),
    [allNavItems],
  )

  const pushRecentAction = useRecentActionsStore((s) => s.push)
  const recentActions = useRecentActionsStore((s) => s.actions)

  const recentRoutes = useRecentNavStore((s) => s.routes)
  const recentNavItems = useMemo(() => {
    const results: NavItem[] = []
    for (const route of recentRoutes) {
      const item = navByRoute.get(route)
      if (item) results.push(item)
      if (results.length >= MAX_RECENT_SHOWN) break
    }
    return results
  }, [recentRoutes, navByRoute])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search agents, pages, configs…"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {search === '' && recentNavItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentNavItems.map((item) => (
              <CommandItem
                key={`recent-${item.route}`}
                value={`recent ${item.label} ${item.route}`}
                onSelect={run(() => navigate(item.route))}
              >
                <Icon name={item.icon} />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {search === '' && recentActions.length > 0 && (
          <CommandGroup heading="Recent actions">
            {recentActions.slice(0, MAX_RECENT_ACTIONS_SHOWN).map((action) => (
              <CommandItem
                key={`recent-action-${action.value}`}
                value={`recent-action ${action.label} ${action.value}`}
                onSelect={run(() => {
                  // Re-execute the recorded action by dispatching its stored value.
                  const [kind, id] = action.value.split(':') as [string, string]
                  if (kind === 'agent') {
                    setActiveAgent(id)
                  } else if (kind === 'theme') {
                    setAgentTheme(activeAgent.id, id)
                  } else if (kind === 'template') {
                    requestApplyTemplate(id)
                    navigate('/templates')
                  }
                })}
              >
                <Icon name={action.icon} />
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Agents">
          {agents.map((agent) => (
            <CommandItem
              key={agent.id}
              value={`agent ${agent.displayName} ${agent.id}`}
              onSelect={run(() => {
                setActiveAgent(agent.id)
                pushRecentAction({
                  label: `Switch to ${agent.displayName}`,
                  value: `agent:${agent.id}`,
                  icon: 'bot',
                })
              })}
            >
              <AgentGlyph agent={agent} className="size-4 rounded-[3px]" />
              Switch to {agent.displayName}
              {agent.id === activeAgent.id && (
                <Icon name="check" className="ml-auto text-primary" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Go to">
          {navItems.map((item) => {
            const actionId = ROUTE_SHORTCUT[item.route]
            const combo = actionId ? (bindings[actionId] ?? '') : ''
            return (
              <CommandItem
                key={item.id}
                value={`go ${item.label}`}
                onSelect={run(() => navigate(item.route))}
              >
                <Icon name={item.icon} />
                {item.label}
                <ShortcutHint combo={combo} />
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandGroup heading="Settings">
          {SETTINGS_SECTIONS.map((section) => (
            <CommandItem
              key={section.id}
              value={`settings ${section.label}`}
              keywords={section.keywords}
              onSelect={run(() => navigate(`/settings?s=${section.id}`))}
            >
              <Icon name={section.icon} />
              Settings: {section.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {templates.length > 0 && (
          <CommandGroup heading="Prompt Templates">
            {templates.map((t) => (
              <CommandItem
                key={`tpl-${t.id}`}
                value={`template ${t.title} ${t.id}`}
                keywords={[t.description, ...t.tags]}
                onSelect={run(() => {
                  requestApplyTemplate(t.id)
                  navigate('/templates')
                  pushRecentAction({
                    label: `Apply template: ${t.title}`,
                    value: `template:${t.id}`,
                    icon: 'library',
                  })
                })}
              >
                <Icon name="library" />
                Apply: {t.title}
                {!t.builtin && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    custom
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {items.length > 0 && (
          <CommandGroup heading="Items">
            {items.map((item) => (
              <CommandItem
                key={`${item.kind}-${item.id}`}
                value={`item ${item.name} ${item.id} ${item.kind}`}
                keywords={[
                  item.description,
                  // Keep body matches in the results without making cmdk scan
                  // the whole file: the substring test already decided this.
                  contentMatches.has(`${item.kind}-${item.id}`) ? search : '',
                ]}
                onSelect={run(() => {
                  requestOpen(item.kind, item.id)
                  navigate(`/${item.kind}`)
                })}
              >
                <Icon name={KIND_ICON[item.kind]} />
                {item.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {item.kind}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {globalMatches.length > 0 && (
          <CommandGroup heading="Across all agents">
            {globalMatches.map((r, i) => (
              <CommandItem
                key={`global-${r.agentId}-${r.kind}-${i}`}
                value={`global ${r.agentId} ${r.kind} ${r.label} ${i}`}
                keywords={[search, r.detail]}
                onSelect={run(() => {
                  if (r.agentId !== activeAgent.id) setActiveAgent(r.agentId)
                  navigate(r.route)
                })}
              >
                <Icon name={GLOBAL_KIND_ICON[r.kind]} />
                <span className="truncate">{r.label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {agentNames.get(r.agentId) ?? r.agentId} · {r.kind}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Appearance">
          <CommandItem
            value="toggle light dark appearance mode"
            onSelect={run(toggleAppearance)}
          >
            <Icon name="sun" />
            Toggle light / dark
            <ShortcutHint combo={bindings['appearance.toggle'] ?? ''} />
          </CommandItem>
          {themes.map((theme) => (
            <CommandItem
              key={theme.id}
              value={`theme ${theme.label}`}
              onMouseEnter={() => applyTheme(theme, appearance)}
              onMouseLeave={restoreActiveTheme}
              onSelect={run(() => {
                setAgentTheme(activeAgent.id, theme.id)
                pushRecentAction({
                  label: `Apply theme: ${theme.label}`,
                  value: `theme:${theme.id}`,
                  icon: 'palette',
                })
              })}
            >
              <Icon name="palette" />
              {theme.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </>
  )
}
