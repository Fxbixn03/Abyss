import { useEffect, useState } from 'react'
import type { BackupInfo } from '@/shared/types/backup'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useSettingsStore } from '../store/settings.store'

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

export function BackupsSection() {
  const settings = useSettingsStore((s) => s.settings)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    void ipc
      .backupList()
      .then(setBackups)
      .catch(() => setBackups([]))
  }

  useEffect(() => {
    let active = true
    void ipc
      .backupList()
      .then((list) => {
        if (active) setBackups(list)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const backupNow = async () => {
    setBusy(true)
    await ipc.backupRun().catch(() => null)
    setBusy(false)
    refresh()
  }

  const pickDir = async () => {
    const { path } = await ipc.pickDirectory('Backup directory')
    if (path) {
      await updatePrefs({ backupDir: path })
      refresh()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Automatic backups</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Daily auto-backup</p>
              <p className="text-xs text-muted-foreground">
                Export all configs once per day, on the first launch of the day.
              </p>
            </div>
            <Switch
              checked={settings.autoBackup}
              onCheckedChange={(v) => void updatePrefs({ autoBackup: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Backups to keep</p>
              <p className="text-xs text-muted-foreground">
                Older backups beyond this count are pruned automatically.
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={50}
              value={settings.backupKeep}
              onChange={(e) =>
                void updatePrefs({
                  backupKeep: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="w-[90px] text-right font-code"
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">Backup folder</p>
              <p className="truncate font-code text-xs text-muted-foreground">
                {settings.backupDir ?? 'Default (Abyss data directory)'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void pickDir()}>
                <Icon name="folder-open" />
                Change…
              </Button>
              {settings.backupDir && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void updatePrefs({ backupDir: undefined })}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent backups</CardTitle>
          <Button size="sm" onClick={() => void backupNow()} disabled={busy}>
            <Icon
              name={busy ? 'loader' : 'archive'}
              className={busy ? 'animate-spin' : ''}
            />
            Back up now
          </Button>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {backups.map((b, i) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-1.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon
                      name="archive"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">
                      {new Date(b.createdAt).toLocaleString()}
                    </span>
                    {i === 0 && <Badge variant="success">latest</Badge>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-code text-xs text-muted-foreground">
                      {formatBytes(b.sizeBytes)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void ipc.revealPath(b.path)}
                      aria-label="Reveal backup"
                    >
                      <Icon name="folder-open" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
