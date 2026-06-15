import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import { Icon } from '@/shared/components/Icon'
import { AbyssLogo } from '@/shared/components/AbyssLogo'
import { cn } from '@/shared/lib/utils'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import {
  useAgentEnabled,
  isAgentEnabled,
} from '@/features/agents/store/agent-enabled.store'
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
 * Collapsible list of agents that have no detected config and no user-set
 * override path. The user can dismiss each one so they stop appearing in the
 * switcher and PathsSection.
 */
function NotOnThisMachineSection() {
  const [open, setOpen] = useState(false)

  const detected = useSettingsStore((s) => s.detected)
  const agentPaths = useSettingsStore((s) => s.settings.agentPaths)
  const enabledMap = useAgentEnabled((s) => s.enabled)
  const setEnabled = useAgentEnabled((s) => s.setEnabled)

  // All agents in the registry (not filtered by enabled state)
  const allAgents = agentRegistry.getAll()

  // Agents with no detected path AND no user override
  const undetectedAgents = allAgents.filter((agent) => {
    const paths = detected[agent.id] ?? []
    const hasDetected = paths.some((p) => p.exists)
    const hasOverride =
      Boolean(agentPaths[agent.id]) && agentPaths[agent.id]!.trim() !== ''
    return !hasDetected && !hasOverride
  })

  if (undetectedAgents.length === 0) return null

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <Icon name="circle-slash" className="size-4 shrink-0" />
          Not on this machine
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal">
            {undetectedAgents.length}
          </span>
        </span>
        <Icon
          name="chevron-down"
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-border">
          <p className="px-3 py-2 text-xs text-muted-foreground">
            These agents were not detected on this machine. Toggle off to hide
            them from the switcher.
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {undetectedAgents.map((agent) => {
              const currentlyEnabled = isAgentEnabled(enabledMap, agent.id)
              return (
                <li
                  key={agent.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AgentGlyph agent={agent} className="size-4 shrink-0" />
                    <span className="truncate text-sm">{agent.displayName}</span>
                  </div>
                  <Switch
                    checked={currentlyEnabled}
                    onCheckedChange={(on) => setEnabled(agent.id, on)}
                    aria-label={`Enable ${agent.displayName}`}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      )}
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

        <NotOnThisMachineSection />

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
