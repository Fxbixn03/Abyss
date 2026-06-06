import { useEffect, useState } from 'react'
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
}

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open)
  const setOpen = useCommandPalette((s) => s.setOpen)
  const navigate = useNavigate()

  const agents = useAllAgents()
  const activeAgent = useActiveAgent()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const basePath = useConfigBase(activeAgent.id)
  const requestOpen = useCollectionSelection((s) => s.requestOpen)

  const [items, setItems] = useState<PaletteItem[]>([])
  useEffect(() => {
    if (!open || !basePath) return
    let active = true
    const kinds = COLLECTION_KINDS.filter((k) => activeAgent.capabilities[k])
    void Promise.all(
      kinds.map((kind) =>
        ipc
          .listCollection(basePath, kind)
          .then((list) => list.map((i) => ({ kind, id: i.id, name: i.name })))
          .catch(() => [] as PaletteItem[]),
      ),
    ).then((res) => {
      if (active) setItems(res.flat())
    })
    return () => {
      active = false
    }
  }, [open, basePath, activeAgent.id, activeAgent.capabilities])

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
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search agents, pages, themes…" />
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

        {items.length > 0 && (
          <CommandGroup heading="Items">
            {items.map((item) => (
              <CommandItem
                key={`${item.kind}-${item.id}`}
                value={`item ${item.name} ${item.id} ${item.kind}`}
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
    </CommandDialog>
  )
}
