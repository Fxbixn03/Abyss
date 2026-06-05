import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command'
import { Icon } from '@/shared/components/Icon'
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'
import { PRIMARY_NAV, SETTINGS_NAV } from '@/app/navigation'
import { useCommandPalette } from '@/app/command/commandPalette.store'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { useAgentStore } from '@/features/agents/store/agent.store'
import { useThemeStore } from '@/features/themes/store/theme.store'

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open)
  const setOpen = useCommandPalette((s) => s.setOpen)
  const navigate = useNavigate()

  const agents = useAllAgents()
  const activeAgent = useActiveAgent()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)

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
