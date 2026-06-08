import { Toaster as SonnerToaster } from 'sonner'
import type { ComponentProps } from 'react'
import { useThemeStore } from '@/features/themes/store/theme.store'

type ToasterProps = ComponentProps<typeof SonnerToaster>

/**
 * App-themed Sonner toaster. Follows the global light/dark appearance and maps
 * Sonner's surface variables onto our semantic theme tokens so toasts match the
 * active agent theme with no reload.
 */
export function Toaster(props: ToasterProps) {
  const appearance = useThemeStore((s) => s.appearance)
  return (
    <SonnerToaster
      theme={appearance}
      position="bottom-right"
      richColors
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
