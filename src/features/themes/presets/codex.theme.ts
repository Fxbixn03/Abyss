import type { ThemeConfig } from '@/shared/types/theme'

export const codexThemes: ThemeConfig[] = [
  {
    id: 'codex-terminal',
    label: 'Codex — Terminal',
    agentId: 'codex',
    borderRadius: 'sm',
    fontFamily: 'mono',
    dark: {
      primary: '#10A37F',
      primaryForeground: '#FFFFFF',
      background: '#0D0D0D',
      surface: '#171717',
      border: '#2D2D2D',
      text: '#ECECEC',
      textMuted: '#6B6B6B',
      sidebar: '#0A0A0A',
      sidebarActive: '#1F1F1F',
    },
    light: {
      primary: '#0E8C6D',
      primaryForeground: '#FFFFFF',
      background: '#FFFFFF',
      surface: '#F7F7F7',
      border: '#E2E2E2',
      text: '#1A1A1A',
      textMuted: '#6B6B6B',
      sidebar: '#F0F0F0',
      sidebarActive: '#E6E6E6',
    },
  },
]
