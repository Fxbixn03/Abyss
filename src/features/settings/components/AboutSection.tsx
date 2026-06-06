import { useEffect, useState } from 'react'
import type { AppInfo, UpdateStatus } from '@/shared/types/config'
import { IpcEvent } from '@/shared/types/ipc'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { AbyssLogo } from '@/shared/components/AbyssLogo'
import { ipc } from '@/shared/ipc/ipc.client'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span data-selectable className="font-code text-xs">
        {value}
      </span>
    </div>
  )
}

function UpdateBlock() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => ipc.subscribe(IpcEvent.UpdateStatus, setStatus), [])

  const label: Record<UpdateStatus['state'], string> = {
    idle: 'Up to date',
    checking: 'Checking for updates…',
    'not-available': 'You’re on the latest version.',
    available: `Update available${status.version ? ` (v${status.version})` : ''}`,
    downloading: `Downloading… ${status.percent ?? 0}%`,
    downloaded: `Ready to install${status.version ? ` (v${status.version})` : ''}`,
    error: status.message ?? 'Update error',
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="flex items-center gap-2 text-sm">
        <Icon
          name={
            status.state === 'checking' || status.state === 'downloading'
              ? 'loader'
              : status.state === 'error'
                ? 'circle-alert'
                : 'refresh-cw'
          }
          className={
            status.state === 'checking' || status.state === 'downloading'
              ? 'size-4 animate-spin'
              : 'size-4'
          }
        />
        <span
          className={status.state === 'error' ? 'text-destructive' : undefined}
        >
          {label[status.state]}
        </span>
      </span>
      {status.state === 'downloaded' ? (
        <Button size="sm" onClick={() => void ipc.updateInstall()}>
          Restart &amp; install
        </Button>
      ) : status.state === 'available' ? (
        <Button size="sm" onClick={() => void ipc.updateDownload()}>
          <Icon name="download" />
          Download
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void ipc.updateCheck()}
          disabled={
            status.state === 'checking' || status.state === 'downloading'
          }
        >
          Check for updates
        </Button>
      )}
    </div>
  )
}

export function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void ipc.getAppInfo().then(setInfo)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AbyssLogo className="size-9" />
          Abyss
          {info && (
            <span className="font-code text-xs text-muted-foreground">
              v{info.version}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A unified visual configuration UI for AI coding agents. Manage
          instructions, MCP servers, permissions and more, for every agent, in
          one place.
        </p>
        <UpdateBlock />
        {info && (
          <div className="divide-y divide-border rounded-md border border-border px-3">
            <InfoRow label="Version" value={info.version} />
            <InfoRow label="Electron" value={info.electron} />
            <InfoRow label="Chromium" value={info.chrome} />
            <InfoRow label="Node" value={info.node} />
            <InfoRow label="Platform" value={info.platform} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
