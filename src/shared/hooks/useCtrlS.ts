import { useEffect, useRef } from 'react'

/**
 * Registers a single Ctrl/Cmd+S keydown listener on `window` for the lifetime
 * of the calling component.
 *
 * The handler is stored in a ref so it always reflects the latest closure
 * without the listener needing to be re-registered. This eliminates the need
 * for `// eslint-disable-next-line react-hooks/exhaustive-deps` suppressions
 * that would otherwise appear when the handler captures state variables.
 *
 * @param handler Called whenever the user presses Ctrl+S (or Cmd+S on macOS).
 *   The default browser save action is always suppressed.
 */
export function useCtrlS(handler: () => void): void {
  const handlerRef = useRef(handler)

  // Sync the ref after every render so the keydown listener always calls the
  // latest closure without needing to be re-registered.
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handlerRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
