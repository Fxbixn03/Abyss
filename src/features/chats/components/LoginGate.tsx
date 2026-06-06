import { useState } from 'react'
import type { ChatAvailability } from '@/shared/types/chat'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { Icon } from '@/shared/components/Icon'

export interface LoginGateProps {
  agentName: string
  availability: ChatAvailability | null
  loading: boolean
  busy: boolean
  onLogin: (persist: boolean, apiKey?: string) => void
  onRefresh: () => void
}

export function LoginGate({
  agentName,
  availability,
  loading,
  busy,
  onLogin,
  onRefresh,
}: LoginGateProps) {
  const [persist, setPersist] = useState(false)
  const [useApiKey, setUseApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')

  if (loading && !availability) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Checking {agentName}…
      </div>
    )
  }

  if (availability && !availability.installed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon name="terminal" className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{agentName} CLI not found</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {availability.reason ??
              `Install the ${agentName} CLI and make sure it is on your PATH.`}
          </p>
        </div>
        <Button variant="outline" onClick={onRefresh}>
          <Icon name="refresh-cw" />
          Re-check
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card/40 p-6 shadow-sm">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon name="messages-square" className="size-5" />
          </div>
          <h2 className="text-base font-semibold">Sign in to Chats</h2>
          <p className="text-sm text-muted-foreground">
            Abyss uses your existing {agentName} subscription. No API key needed
            — sign-in opens in your browser.
          </p>
        </div>

        {busy ? (
          <div className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
            <Icon name="loader" className="size-5 animate-spin" />
            Waiting for browser sign-in…
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={onRefresh}
            >
              I&rsquo;ve finished — re-check
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!useApiKey ? (
              <Button onClick={() => onLogin(persist)} className="w-full">
                <Icon name="log-in" />
                Sign in with {agentName}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API key (sk-…)"
                  className="font-code"
                />
                <Button
                  onClick={() => onLogin(persist, apiKey)}
                  disabled={apiKey.trim() === ''}
                  className="w-full"
                >
                  <Icon name="key" />
                  Use API key
                </Button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setUseApiKey((v) => !v)}
              className="text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {useApiKey
                ? '← Back to subscription sign-in'
                : 'Use an API key instead'}
            </button>

            <label className="mt-1 flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Save credentials</span>
                <span className="text-xs text-muted-foreground">
                  Stay signed in after closing Abyss.
                </span>
              </span>
              <Switch checked={persist} onCheckedChange={setPersist} />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
