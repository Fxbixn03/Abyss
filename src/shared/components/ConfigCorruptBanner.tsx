import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import type { ConfigParseInfo } from '@/shared/lib/errors'

interface ConfigCorruptBannerProps {
  info: ConfigParseInfo
  /** Re-attempt the read after the file has been fixed. */
  onRetry?: () => void
}

/**
 * Shown when a config file on disk can't be parsed. Rather than crashing or
 * silently swallowing the error, we explain what's broken and offer to reveal
 * the file so the user can repair it by hand. Previous good versions are kept
 * in History (snapshots), so a bad edit is always recoverable.
 */
export function ConfigCorruptBanner({ info, onRetry }: ConfigCorruptBannerProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-2.5">
        <Icon
          name="alert-triangle"
          className="mt-0.5 size-4 shrink-0 text-destructive"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            This config file is corrupt and can't be read
          </p>
          {info.filePath && (
            <p className="truncate font-code text-xs text-muted-foreground">
              {info.filePath}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{info.message}</p>
        </div>
      </div>
      <div className="flex gap-2 pl-6">
        {info.filePath && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void ipc.revealPath(info.filePath as string)}
          >
            <Icon name="folder-open" />
            Reveal file
          </Button>
        )}
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <Icon name="refresh-cw" />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
