import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import {
  SHORTCUT_ACTIONS,
  type ShortcutActionId,
  useShortcutsStore,
} from '@/features/shortcuts/store/shortcuts.store'
import {
  comboFromEvent,
  humanizeCombo,
} from '@/features/shortcuts/lib/shortcuts'

export function ShortcutsSection() {
  const bindings = useShortcutsStore((s) => s.bindings)
  const setBinding = useShortcutsStore((s) => s.setBinding)
  const resetAll = useShortcutsStore((s) => s.resetAll)
  const [recording, setRecording] = useState<ShortcutActionId | null>(null)

  // While recording, capture the next key combo (or Escape to cancel).
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      const combo = comboFromEvent(e)
      if (combo) {
        setBinding(recording, combo)
        setRecording(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, setBinding])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Keyboard shortcuts</CardTitle>
          <CardDescription>
            Click a shortcut, then press the key combo. Esc cancels.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={resetAll}>
          <Icon name="rotate-ccw" />
          Reset all
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {SHORTCUT_ACTIONS.map((action) => {
          const active = recording === action.id
          return (
            <div
              key={action.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm font-medium">{action.label}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecording(action.id)}
                className={cn(
                  'min-w-[120px] font-code',
                  active && 'border-primary text-primary',
                )}
              >
                {active ? 'Press keys…' : humanizeCombo(bindings[action.id])}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
