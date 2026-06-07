import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BackupStatus } from '@/shared/types/backup'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`
}

/** Dashboard card summarising config-backup state, linking to History. */
export function BackupCard() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<BackupStatus | null>(null)

  useEffect(() => {
    let active = true
    void ipc
      .backupStatus()
      .then((s) => {
        if (active) setStatus(s)
      })
      .catch(() => {
        if (active) setStatus({ count: 0, changedSinceLast: false })
      })
    return () => {
      active = false
    }
  }, [])

  if (!status) return null

  const open = () => navigate('/history')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Backups</h2>
      <Card
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open()
          }
        }}
        className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon name="archive" className="size-5" />
        </div>
        <div className="min-w-0">
          {status.count === 0 ? (
            <>
              <p className="text-sm font-medium">No backups yet</p>
              <p className="text-xs text-muted-foreground">
                A backup is created automatically once a day.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                Last backup{' '}
                {status.last ? relativeDate(status.last.createdAt) : 'unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                {status.count} backup{status.count === 1 ? '' : 's'} kept
              </p>
            </>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {status.changedSinceLast && (
            <Badge variant="warning">changed since backup</Badge>
          )}
          <Icon name="chevron-right" className="text-muted-foreground" />
        </div>
      </Card>
    </section>
  )
}
