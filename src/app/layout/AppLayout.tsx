import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { useCommandPalette } from '@/app/command/commandPalette.store'
import { useGlobalShortcuts } from '@/features/shortcuts/hooks/useGlobalShortcuts'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { ScopeBar } from '@/features/scope/components/ScopeBar'
import { TourOverlay } from '@/features/tour/components/TourOverlay'

export function AppLayout() {
  const toggle = useCommandPalette((s) => s.toggle)
  useGlobalShortcuts()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <ScopeBar />
          <main className="min-h-0 flex-1 overflow-hidden p-5">
            <Outlet />
          </main>
          <StatusBar />
        </div>
      </div>
      <CommandPalette />
      <TourOverlay />
    </TooltipProvider>
  )
}
