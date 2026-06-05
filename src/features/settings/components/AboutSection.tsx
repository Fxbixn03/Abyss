import { useEffect, useState } from 'react'
import type { AppInfo } from '@/shared/types/config'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
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

export function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void ipc.getAppInfo().then(setInfo)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon name="box" className="size-5" />
          </span>
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
          instructions, MCP servers, permissions and more — for every agent, in
          one place.
        </p>
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
