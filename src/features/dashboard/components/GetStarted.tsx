import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { AgentAdapter } from '@/shared/types/agent'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'

interface QuickLink {
  icon: string
  title: string
  description: string
  route: string
}

/**
 * Inviting get-started panel shown when there's no usage yet (first run) or when
 * the active agent has no chat history to summarise. Turns an otherwise empty
 * dashboard into a set of next steps tailored to the agent's capabilities.
 */
export function GetStarted({ agent }: { agent: AgentAdapter }) {
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const caps = agent.capabilities

  const links: QuickLink[] = []
  if (caps.instructions) {
    links.push({
      icon: 'file-text',
      title: t('getStarted.editInstructions.title'),
      description: t('getStarted.editInstructions.description', {
        agent: agent.displayName,
      }),
      route: '/config',
    })
    links.push({
      icon: 'clipboard-check',
      title: t('getStarted.validateConfig.title'),
      description: t('getStarted.validateConfig.description'),
      route: '/validation',
    })
  }
  if (caps.mcp) {
    links.push({
      icon: 'plug',
      title: t('getStarted.connectMcp.title'),
      description: t('getStarted.connectMcp.description'),
      route: '/mcp',
    })
  }
  if (caps.chats) {
    links.push({
      icon: 'messages-square',
      title: t('getStarted.startChat.title'),
      description: t('getStarted.startChat.description', {
        agent: agent.displayName,
      }),
      route: '/chats',
    })
  }

  if (links.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {t('getStarted.heading')}
      </h2>
      <Card className="space-y-1 p-4">
        <p className="text-sm">
          {caps.chats
            ? t('getStarted.introChatHistory', { agent: agent.displayName })
            : t('getStarted.introConfig', {
                agent: agent.displayName,
              })}{' '}
          {t('getStarted.begin')}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {links.map((link) => (
            <button
              key={link.route}
              type="button"
              onClick={() => navigate(link.route)}
              className="flex items-start gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon name={link.icon} className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{link.title}</p>
                <p className="text-xs text-muted-foreground">
                  {link.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </section>
  )
}
