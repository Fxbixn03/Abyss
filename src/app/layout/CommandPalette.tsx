import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CollectionKind } from '@/shared/types/collections'
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
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'
import { PRIMARY_NAV, SETTINGS_NAV } from '@/app/navigation'
import { useCommandPalette } from '@/app/command/commandPalette.store'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { useAgentStore } from '@/features/agents/store/agent.store'
import { useThemeStore } from '@/features/themes/store/theme.store'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useCollectionSelection } from '@/features/collections/store/collectionSelection.store'
import { SETTINGS_SECTIONS } from '@/features/settings/sections'

const COLLECTION_KINDS: CollectionKind[] = ['agents', 'commands', 'skills']
const KIND_ICON: Record<CollectionKind, string> = {
  agents: 'bot',
  commands: 'square-slash',
  skills: 'graduation-cap',
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

  const [items, setItems] = useState<PaletteItem[]>([])
  const [search, setSearch] = useState('')

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
          .listCollection(basePath, kind)
          .then((list) =>
            Promise.all(
              list.map(async (i) => {
                // Pull the file body so items are findable by their contents,
                // not just their name/description.
                const content = await ipc
                  .readCollectionItem(basePath, kind, i.id)
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

  const toggleAppearance = useThemeStore((s) => s.toggleAppearance)
  const setAgentTheme = useThemeStore((s) => s.setAgentTheme)
  const getThemesForAgent = useThemeStore((s) => s.getThemesForAgent)
  const themes = getThemesForAgent(activeAgent.id)

  const navItems = [
    ...PRIMARY_NAV,
    ...(activeAgent.getSidebarSections?.() ?? []),
    SETTINGS_NAV,
  ]

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search agents, pages, themes…"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Agents">
          {agents.map((agent) => (
            <CommandItem
              key={agent.id}
              value={`agent ${agent.displayName} ${agent.id}`}
              onSelect={run(() => setActiveAgent(agent.id))}
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
          {navItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`go ${item.label}`}
              onSelect={run(() => navigate(item.route))}
            >
              <Icon name={item.icon} />
              {item.label}
            </CommandItem>
          ))}
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

        <CommandGroup heading="Appearance">
          <CommandItem
            value="toggle light dark appearance mode"
            onSelect={run(toggleAppearance)}
          >
            <Icon name="sun" />
            Toggle light / dark
          </CommandItem>
          {themes.map((theme) => (
            <CommandItem
              key={theme.id}
              value={`theme ${theme.label}`}
              onSelect={run(() => setAgentTheme(activeAgent.id, theme.id))}
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
