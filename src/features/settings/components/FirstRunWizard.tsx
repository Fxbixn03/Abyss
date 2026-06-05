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
import { useSettingsStore } from '../store/settings.store'
import { PathsSection } from './PathsSection'

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
            <Icon name="box" className="size-5 text-primary" />
            Welcome to Abyss
          </DialogTitle>
          <DialogDescription>
            Abyss auto-detected where your agents keep their config. Confirm the
            locations below or pick your own — you can change these any time in
            Settings.
          </DialogDescription>
        </DialogHeader>

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
