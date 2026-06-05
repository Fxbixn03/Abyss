import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export interface BrowserNav {
  canBack: boolean
  canForward: boolean
  back: () => void
  forward: () => void
}

/**
 * Browser-style back/forward over the router history (+ Alt+←/→).
 *
 * React Router keeps a position index on `history.state.idx`, and the session
 * history's `length` already tracks total entries (a fresh push truncates any
 * forward ones). So both flags are pure reads — no refs, no state to drift.
 */
export function useBrowserNav(): BrowserNav {
  const navigate = useNavigate()
  // Re-render on every navigation so the flags below stay current.
  useLocation()

  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const length = window.history.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        navigate(-1)
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        navigate(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return {
    canBack: idx > 0,
    canForward: idx < length - 1,
    back: () => navigate(-1),
    forward: () => navigate(1),
  }
}
