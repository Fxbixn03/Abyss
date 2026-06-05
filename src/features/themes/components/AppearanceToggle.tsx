import { Icon } from '@/shared/components/Icon'
import { Button } from '@/shared/components/ui/button'
import { useThemeStore } from '../store/theme.store'

export function AppearanceToggle() {
  const appearance = useThemeStore((s) => s.appearance)
  const toggle = useThemeStore((s) => s.toggleAppearance)
  const next = appearance === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="no-drag"
    >
      <Icon name={appearance === 'dark' ? 'sun' : 'moon'} />
    </Button>
  )
}
