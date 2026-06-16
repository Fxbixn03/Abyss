import { useEffect, useRef } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useThemeApplier } from '@/features/themes/hooks/useThemeApplier'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useAgentStore } from '@/features/agents/store/agent.store'
import { useAgentAvailability } from '@/features/agents/store/agent-availability.store'
import { FirstRunWizard } from '@/features/settings/components/FirstRunWizard'
import { Toaster } from '@/shared/components/ui/sonner'
import { ErrorBoundary } from './ErrorBoundary'
import { SplashScreen } from './SplashScreen'
import { router } from './router'

export function App() {
  useThemeApplier()
  const load = useSettingsStore((s) => s.load)
  const refreshAvailability = useAgentAvailability((s) => s.refresh)
  // Gate the app on first-load checks so the user boots straight into a ready
  // Dashboard rather than empty cards that fill in a beat later.
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const availabilityLoaded = useAgentAvailability((s) => s.loaded)
  const ready = settingsLoaded && availabilityLoaded

  useEffect(() => {
    void load()
    void refreshAvailability()
  }, [load, refreshAvailability])

  // Once settings are loaded, honour a configured startup agent (a fixed agent
  // overrides the persisted "last used" one). Runs at most once per launch.
  const startupApplied = useRef(false)
  useEffect(() => {
    if (!settingsLoaded || startupApplied.current) return
    startupApplied.current = true
    const startupAgentId = useSettingsStore.getState().settings.startupAgentId
    if (startupAgentId) useAgentStore.getState().setActiveAgent(startupAgentId)
  }, [settingsLoaded])

  return (
    <ErrorBoundary>
      {ready ? (
        <>
          <RouterProvider router={router} />
          <FirstRunWizard />
        </>
      ) : (
        <SplashScreen />
      )}
      <Toaster />
    </ErrorBoundary>
  )
}
