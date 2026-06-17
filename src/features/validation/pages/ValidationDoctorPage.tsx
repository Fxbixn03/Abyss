import { useTranslation } from 'react-i18next'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import { Icon } from '@/shared/components/Icon'
import { DoctorPage } from '@/features/doctor/pages/DoctorPage'
import { ValidationPage } from './ValidationPage'

interface ValidationDoctorPageProps {
  defaultTab?: 'validation' | 'doctor'
}

/**
 * Combines the Validation and Doctor pages into a single tabbed view. Each tab
 * renders the full original page (its own header, actions and scroll area) — the
 * bodies are untouched. Radix unmounts the inactive tab, so only one PageHeader
 * is in the DOM at a time.
 */
export function ValidationDoctorPage({
  defaultTab = 'validation',
}: ValidationDoctorPageProps) {
  const { t } = useTranslation('validation')
  return (
    <Tabs defaultValue={defaultTab} className="flex h-full flex-col gap-4">
      <TabsList className="self-start">
        <TabsTrigger value="validation">
          <Icon name="clipboard-check" className="size-4" />
          {t('tabs.validation')}
        </TabsTrigger>
        <TabsTrigger value="doctor">
          <Icon name="stethoscope" className="size-4" />
          {t('tabs.doctor')}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="validation"
        className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-0"
      >
        <ValidationPage />
      </TabsContent>
      <TabsContent
        value="doctor"
        className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-0"
      >
        <DoctorPage />
      </TabsContent>
    </Tabs>
  )
}
