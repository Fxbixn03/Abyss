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
import { HooksPage } from '@/features/hooks/pages/HooksPage'
import { SettingsFilePage } from '@/features/settings-file/pages/SettingsFilePage'
import { ChatsPage } from '@/features/chats/pages/ChatsPage'
import { SnapshotsPage } from '@/features/snapshots/pages/SnapshotsPage'
import { BundlesPage } from '@/features/bundles/pages/BundlesPage'
import { ProfilesPage } from '@/features/profiles/pages/ProfilesPage'
import { ComparePage } from '@/features/compare/pages/ComparePage'

// Hash history works under Electron's file:// protocol in production.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'chats', element: <ChatsPage /> },
      { path: 'history', element: <SnapshotsPage /> },
      { path: 'bundles', element: <BundlesPage /> },
      { path: 'profiles', element: <ProfilesPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'commands', element: <CommandsPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'mcp', element: <McpPage /> },
      { path: 'hooks', element: <HooksPage /> },
      { path: 'permissions', element: <PermissionsPage /> },
      { path: 'model-env', element: <ModelEnvPage /> },
      { path: 'settings-file', element: <SettingsFilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <DashboardPage /> },
    ],
  },
])
