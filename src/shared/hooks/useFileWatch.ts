import { useEffect } from 'react'
import { IpcEvent } from '@/shared/types/ipc'
import { ipc } from '@/shared/ipc/ipc.client'

/**
 * Watch a file for external changes. `onChange` fires when the file changes on
 * disk; it should be a stable callback (useCallback). Pass an empty path to
 * watch nothing.
 */
export function useFileWatch(filePath: string, onChange: () => void): void {
  useEffect(() => {
    if (!filePath) return
    void ipc.fsWatch(filePath)
    const unsubscribe = ipc.subscribe(IpcEvent.FileChanged, ({ path }) => {
      if (path === filePath) onChange()
    })
    return () => {
      unsubscribe()
      void ipc.fsUnwatch(filePath)
    }
  }, [filePath, onChange])
}
