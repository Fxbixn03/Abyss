import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useThemeApplier } from '@/features/themes/hooks/useThemeApplier'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useAgentAvailability } from '@/features/agents/store/agent-availability.store'
import { FirstRunWizard } from '@/features/settings/components/FirstRunWizard'
import { Toaster } from '@/shared/components/ui/sonner'
import { ErrorBoundary } from './ErrorBoundary'
import { router } from './router'

export function App() {
  useThemeApplier()
  const load = useSettingsStore((s) => s.load)
  const refreshAvailability = useAgentAvailability((s) => s.refresh)

  useEffect(() => {
    void load()
    void refreshAvailability()
  }, [load, refreshAvailability])

  return (
    <ErrorBoundary>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <FirstRunWizard />
      <Toaster />
    </ErrorBoundary>
  )
}
