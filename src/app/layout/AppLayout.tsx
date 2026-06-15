import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { useCommandPalette } from '@/app/command/commandPalette.store'
import { useGlobalShortcuts } from '@/features/shortcuts/hooks/useGlobalShortcuts'
import { useRecentNavStore } from '@/features/navigation/store/recentNav.store'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { ScopeBar } from '@/features/scope/components/ScopeBar'
import { TourOverlay } from '@/features/tour/components/TourOverlay'

export function AppLayout() {
  const toggle = useCommandPalette((s) => s.toggle)
  useGlobalShortcuts()
  const location = useLocation()
  const pushRecentRoute = useRecentNavStore((s) => s.push)

  // Record every route change into the recent-nav store so the command
  // palette can surface the most recently visited pages at the top.
  useEffect(() => {
    pushRecentRoute(location.pathname)
  }, [location.pathname, pushRecentRoute])

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
          <main aria-label="Page content" className="min-h-0 flex-1 overflow-hidden p-5">
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
