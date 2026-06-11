import { createHashRouter } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ConfigPage } from '@/features/config/pages/ConfigPage'
import { McpPage } from '@/features/mcp/pages/McpPage'
import { PermissionsPage } from '@/features/permissions/pages/PermissionsPage'
import { ModelEnvPage } from '@/features/model-env/pages/ModelEnvPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { AgentsPage } from '@/features/collections/pages/AgentsPage'
import { CommandsPage } from '@/features/collections/pages/CommandsPage'
import { SkillsPage } from '@/features/collections/pages/SkillsPage'
import { RulesPage } from '@/features/collections/pages/RulesPage'
import { HooksPage } from '@/features/hooks/pages/HooksPage'
import { SettingsFilePage } from '@/features/settings-file/pages/SettingsFilePage'
import { ChatsPage } from '@/features/chats/pages/ChatsPage'
import { SnapshotsPage } from '@/features/snapshots/pages/SnapshotsPage'
import { BundlesPage } from '@/features/bundles/pages/BundlesPage'
import { ProfilesPage } from '@/features/profiles/pages/ProfilesPage'
import { ComparePage } from '@/features/compare/pages/ComparePage'
import { TemplatesPage } from '@/features/templates/pages/TemplatesPage'
import { ContextPage } from '@/features/context/pages/ContextPage'
import { ValidationPage } from '@/features/validation/pages/ValidationPage'
import { DiscoverPage } from '@/features/discovery/pages/DiscoverPage'
import { SandboxPage } from '@/features/sandbox/pages/SandboxPage'
import { RelationsPage } from '@/features/relations/pages/RelationsPage'
import { UsagePage } from '@/features/usage/pages/UsagePage'
import { DoctorPage } from '@/features/doctor/pages/DoctorPage'
import { MarketplacePage } from '@/features/marketplace/pages/MarketplacePage'
import { ActivityPage } from '@/features/activity/pages/ActivityPage'
import { StatusLinePage } from '@/features/statusline/pages/StatusLinePage'
import { PluginsPage } from '@/features/plugins/pages/PluginsPage'

// Hash history works under Electron's file:// protocol in production.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'relations', element: <RelationsPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'chats', element: <ChatsPage /> },
      { path: 'context', element: <ContextPage /> },
      { path: 'usage', element: <UsagePage /> },
      { path: 'validation', element: <ValidationPage /> },
      { path: 'doctor', element: <DoctorPage /> },
      { path: 'discover', element: <DiscoverPage /> },
      { path: 'marketplace', element: <MarketplacePage /> },
      { path: 'sandbox', element: <SandboxPage /> },
      { path: 'history', element: <SnapshotsPage /> },
      { path: 'activity', element: <ActivityPage /> },
      { path: 'bundles', element: <BundlesPage /> },
      { path: 'profiles', element: <ProfilesPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'commands', element: <CommandsPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'mcp', element: <McpPage /> },
      { path: 'hooks', element: <HooksPage /> },
      { path: 'permissions', element: <PermissionsPage /> },
      { path: 'model-env', element: <ModelEnvPage /> },
      { path: 'statusline', element: <StatusLinePage /> },
      { path: 'plugins', element: <PluginsPage /> },
      { path: 'settings-file', element: <SettingsFilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <DashboardPage /> },
    ],
  },
])
