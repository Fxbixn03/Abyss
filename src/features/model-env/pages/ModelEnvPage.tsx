import { useEffect, useState } from 'react'
import { useCtrlS } from '@/shared/hooks/useCtrlS'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { KeyValueEditor } from '@/shared/components/KeyValueEditor'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  isDiskWriteError,
  isWritePermissionError,
  reportDiskWriteError,
  reportError,
  reportWritePermissionError,
} from '@/shared/lib/errors'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'

export function ModelEnvPage() {
  const { t } = useTranslation(['modelEnv', 'common'])
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const supported = agent.capabilities.modelEnv

  const [model, setModel] = useState('')
  const [env, setEnv] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.getModelEnv(agent.id, basePath).then((config) => {
      if (!active) return
      setModel(config.model ?? '')
      setEnv(config.env)
      setDirty(false)
    })
    return () => {
      active = false
    }
  }, [supported, agent.id, basePath])

  const save = async () => {
    if (!basePath) return
    setSaving(true)
    try {
      await ipc.setModelEnv(agent.id, basePath, { model, env })
      setDirty(false)
    } catch (err) {
      if (isWritePermissionError(err)) {
        reportWritePermissionError(err, (path) => void ipc.revealPath(path))
      } else if (isDiskWriteError(err)) {
        reportDiskWriteError(err)
      } else {
        reportError(err, { title: "Couldn't save model & env settings" })
      }
    } finally {
      setSaving(false)
    }
  }

  // Ctrl/Cmd+S to save model & env settings.
  useCtrlS(() => {
    if (!dirty || saving) return
    void save()
  })

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="sliders" />
        <EmptyState
          icon="sliders"
          title={t('noSupportTitle', { agent: agent.displayName })}
          description={t('unsupportedDesc')}
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="sliders" />
        <EmptyState
          icon="folder"
          title={t('noPath.title')}
          description={t('noPath.desc')}
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              {t('openSettings')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('headerDescription', { agent: agent.displayName })}
        icon="sliders"
        actions={
          <Button onClick={() => void save()} disabled={!dirty || saving}>
            <Icon name="save" />
            {saving ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
        }
      />

      <div className="grid gap-4 overflow-y-auto lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="cpu" className="size-4" />
              {t('model.label')}
            </CardTitle>
            <CardDescription>{t('model.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="model">{t('model.label')}</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  setDirty(true)
                }}
                placeholder={t('modelPlaceholder')}
                className="font-code"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="sliders" className="size-4" />
              {t('env.label')}
            </CardTitle>
            <CardDescription>{t('env.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValueEditor
              value={env}
              onChange={(next) => {
                setEnv(next)
                setDirty(true)
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
