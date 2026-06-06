import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { AgentSwitcher } from '@/features/agents/components/AgentSwitcher'
import { AppearanceToggle } from '@/features/themes/components/AppearanceToggle'
import { useCommandPalette } from '@/app/command/commandPalette.store'
import { useBrowserNav } from '@/app/hooks/useBrowserNav'
import { HelpButton } from './HelpButton'

export function TopBar() {
  const navigate = useNavigate()
  const openPalette = useCommandPalette((s) => s.toggle)
  const nav = useBrowserNav()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={nav.back}
            disabled={!nav.canBack}
            aria-label="Back"
            title="Back (Alt+Left)"
          >
            <Icon name="chevron-left" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={nav.forward}
            disabled={!nav.canForward}
            aria-label="Forward"
            title="Forward (Alt+Right)"
          >
            <Icon name="chevron-right" />
          </Button>
        </div>
        <AgentSwitcher />
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={openPalette}
          className="gap-2 text-muted-foreground"
        >
          <Icon name="search" className="size-3.5" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 font-code text-[10px] sm:inline">
            ⌘K
          </kbd>
        </Button>
        <HelpButton />
        <AppearanceToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
        >
          <Icon name="settings" />
        </Button>
      </div>
    </header>
  )
}
