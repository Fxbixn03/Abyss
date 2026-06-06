import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

export interface ResizableWidth {
  width: number
  isDragging: boolean
  startDrag: (e: ReactPointerEvent) => void
  reset: () => void
}

/**
 * Horizontal drag-to-resize with a persisted, clamped width. Listens on the
 * window during a drag so the pointer can leave the handle, and restores the
 * cursor / text-selection afterwards.
 */
export function useResizableWidth(opts: {
  storageKey: string
  initial: number
  min: number
  max: number
}): ResizableWidth {
  const { storageKey, initial, min, max } = opts

  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(storageKey))
    return stored && !Number.isNaN(stored) ? clamp(stored, min, max) : initial
  })
  const [isDragging, setIsDragging] = useState(false)
  // The drag origin; only ever written from event handlers, never during render.
  const start = useRef({ x: 0, w: 0 })

  const startDrag = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, w: width }
    setIsDragging(true)
    e.preventDefault()
  }

  const reset = () => setWidth(initial)

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: PointerEvent) => {
      setWidth(clamp(start.current.w + (e.clientX - start.current.x), min, max))
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, min, max])

  // Persist whenever the width settles (skipped mid-drag to avoid write spam).
  useEffect(() => {
    if (isDragging) return
    localStorage.setItem(storageKey, String(Math.round(width)))
  }, [isDragging, width, storageKey])

  return { width, isDragging, startDrag, reset }
}
