import { useTranslation } from 'react-i18next'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import { Icon } from '@/shared/components/Icon'
import { MarketplacePage } from '@/features/marketplace/pages/MarketplacePage'
import { McpPage } from './McpPage'

interface McpHubPageProps {
  defaultTab?: 'servers' | 'marketplace'
}

/**
 * Unifies the two MCP surfaces — managing installed servers and browsing the
 * registry — into one tabbed view. Same pattern as `ValidationDoctorPage`: each
 * tab renders the full original page (its own header, actions and scroll area),
 * and Radix unmounts the inactive tab so only one PageHeader is in the DOM.
 */
export function McpHubPage({ defaultTab = 'servers' }: McpHubPageProps) {
  const { t } = useTranslation('mcp')
  return (
    <Tabs defaultValue={defaultTab} className="flex h-full flex-col gap-4">
      <TabsList className="self-start">
        <TabsTrigger value="servers">
          <Icon name="plug" className="size-4" />
          {t('hub.servers')}
        </TabsTrigger>
        <TabsTrigger value="marketplace">
          <Icon name="store" className="size-4" />
          {t('hub.marketplace')}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="servers"
        className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-0"
      >
        <McpPage />
      </TabsContent>
      <TabsContent
        value="marketplace"
        className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-0"
      >
        <MarketplacePage />
      </TabsContent>
    </Tabs>
  )
}
