import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { AbyssLogo } from '@/shared/components/AbyssLogo'
import { cn } from '@/shared/lib/utils'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'
import { useSettingsStore } from '../store/settings.store'
import { PathsSection } from './PathsSection'

/**
 * Read-only summary strip shown above the PathsSection scroll area in the
 * First-Run Wizard. Each enabled agent appears as a compact chip coloured
 * green when at least one config path was detected for it, or muted when none
 * were found.
 */
function DetectedAgentStrip() {
  const agents = useAllAgents()
  const detected = useSettingsStore((s) => s.detected)
  const agentPaths = useSettingsStore((s) => s.settings.agentPaths)

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Agent detection summary">
      {agents.map((agent) => {
        const paths = detected[agent.id] ?? []
        const hasExplicit =
          Boolean(agentPaths[agent.id]) && agentPaths[agent.id]!.trim() !== ''
        const found = hasExplicit || paths.some((p) => p.exists)

        return (
          <div
            key={agent.id}
            role="listitem"
            title={found ? 'Detected' : 'Not found'}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              found
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-border bg-muted/40 text-muted-foreground',
            )}
          >
            <AgentGlyph agent={agent} className="size-3.5 shrink-0" />
            <span>{agent.displayName}</span>
            <Icon
              name={found ? 'circle-check' : 'circle'}
              className="size-3 shrink-0 opacity-70"
            />
          </div>
        )
      })}
    </div>
  )
}

/**
 * First-run experience: shown once until the user completes onboarding.
 * Surfaces auto-detected config locations per agent and lets the user confirm
 * or override them before diving in.
 */
export function FirstRunWizard() {
  const loaded = useSettingsStore((s) => s.loaded)
  const onboarded = useSettingsStore((s) => s.settings.onboarded)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)

  // Derived: open until onboarding is persisted. No effect / setState needed —
  // finishing persists `onboarded`, which closes the dialog on the next render.
  const open = loaded && !onboarded

  const finish = () => {
    void updatePrefs({ onboarded: true })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish()
      }}
    >
      <DialogContent showClose={false} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AbyssLogo className="size-5" />
            Welcome to Abyss
          </DialogTitle>
          <DialogDescription>
            Abyss auto-detected where your agents keep their config. Confirm the
            locations below or pick your own. You can change these any time in
            Settings.
          </DialogDescription>
        </DialogHeader>

        <DetectedAgentStrip />

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <PathsSection />
        </div>

        <DialogFooter>
          <Button onClick={() => void finish()}>
            <Icon name="check" />
            Get started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
