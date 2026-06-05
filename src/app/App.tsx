import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useThemeApplier } from '@/features/themes/hooks/useThemeApplier'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { FirstRunWizard } from '@/features/settings/components/FirstRunWizard'
import { router } from './router'

export function App() {
  useThemeApplier()
  const load = useSettingsStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <FirstRunWizard />
    </>
  )
}
