import { useTranslation } from 'react-i18next'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import { Icon } from '@/shared/components/Icon'
import { ActivityPage } from '@/features/activity/pages/ActivityPage'
import { SnapshotsPage } from './SnapshotsPage'

interface HistoryActivityPageProps {
  defaultTab?: 'history' | 'activity'
}

/**
 * Combines the History (snapshots) and Activity pages into a single tabbed
 * view. Each tab renders the full original page (its own header, actions and
 * scroll area) — the bodies are untouched. Radix unmounts the inactive tab, so
 * only one PageHeader is in the DOM at a time.
 */
export function HistoryActivityPage({
  defaultTab = 'history',
}: HistoryActivityPageProps) {
  const { t } = useTranslation('snapshots')
  return (
    <Tabs defaultValue={defaultTab} className="flex h-full flex-col gap-4">
      <TabsList className="self-start">
        <TabsTrigger value="history">
          <Icon name="history" className="size-4" />
          {t('tabs.history')}
        </TabsTrigger>
        <TabsTrigger value="activity">
          <Icon name="scroll-text" className="size-4" />
          {t('tabs.activity')}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="history"
        className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-0"
      >
        <SnapshotsPage />
      </TabsContent>
      <TabsContent
        value="activity"
        className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-0"
      >
        <ActivityPage />
      </TabsContent>
    </Tabs>
  )
}
