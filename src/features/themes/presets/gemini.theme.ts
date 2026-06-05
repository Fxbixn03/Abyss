import type { ThemeConfig } from '@/shared/types/theme'

export const geminiThemes: ThemeConfig[] = [
  {
    id: 'gemini-cosmos',
    label: 'Gemini — Cosmos',
    agentId: 'gemini',
    borderRadius: 'lg',
    fontFamily: 'sans',
    dark: {
      primary: '#4285F4',
      primaryForeground: '#FFFFFF',
      background: '#0C0E14',
      surface: '#141720',
      border: '#22263A',
      text: '#E3E8F4',
      textMuted: '#6B7494',
      sidebar: '#090B10',
      sidebarActive: '#1C2035',
    },
    light: {
      primary: '#2D6FE0',
      primaryForeground: '#FFFFFF',
      background: '#FAFBFF',
      surface: '#FFFFFF',
      border: '#DDE3F0',
      text: '#1A2030',
      textMuted: '#5B6480',
      sidebar: '#EEF2FC',
      sidebarActive: '#E1E8F8',
    },
  },
]
