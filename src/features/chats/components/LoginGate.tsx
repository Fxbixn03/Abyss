import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatAvailability } from '@/shared/types/chat'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'

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
  const { t } = useTranslation('chats')
  const [persist, setPersist] = useState(false)
  const [useApiKey, setUseApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')

  if (loading && !availability) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('loginGate.checking', { agent: agentName })}
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
          <p className="font-medium">{t('loginGate.cliNotFound', { agent: agentName })}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {availability.reason ?? t('loginGate.cliInstallHint', { agent: agentName })}
          </p>
        </div>
        <Button variant="outline" onClick={onRefresh}>
          <Icon name="refresh-cw" />
          {t('loginGate.reCheck')}
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
          <h2 className="text-base font-semibold">{t('loginGate.signInTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('loginGate.signInDesc', { agent: agentName })}
          </p>
        </div>

        {busy ? (
          <div className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
            <Spinner className="size-5" label={t('loginGate.waitingForBrowser')} />
            {t('loginGate.waitingForBrowser')}
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={onRefresh}
            >
              {t('loginGate.finishedReCheck')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!useApiKey ? (
              <Button onClick={() => onLogin(persist)} className="w-full">
                <Icon name="log-in" />
                {t('loginGate.signInWith', { agent: agentName })}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('loginGate.apiKeyPlaceholder')}
                  className="font-code"
                />
                <Button
                  onClick={() => onLogin(persist, apiKey)}
                  disabled={apiKey.trim() === ''}
                  className="w-full"
                >
                  <Icon name="key" />
                  {t('loginGate.useApiKey')}
                </Button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setUseApiKey((v) => !v)}
              className="text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {useApiKey
                ? t('loginGate.backToSubscription')
                : t('loginGate.useApiKeyInstead')}
            </button>

            <label className="mt-1 flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{t('loginGate.saveCredentials')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('loginGate.saveCredentialsDesc')}
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
