import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Blocks in-app navigation (and warns on window close) while there are unsaved
 * edits, then asks the user to confirm discarding. Relies on the data router
 * (createHashRouter) for {@link useBlocker}.
 */
export function UnsavedGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset()
      }}
      title="Discard unsaved changes?"
      description="You have unsaved edits on this page. Leaving will discard them."
      confirmLabel="Discard"
      onConfirm={() => {
        if (blocker.state === 'blocked') blocker.proceed()
      }}
    />
  )
}
