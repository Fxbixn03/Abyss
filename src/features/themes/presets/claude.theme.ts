import type { ThemeConfig } from '@/shared/types/theme'

export const claudeThemes: ThemeConfig[] = [
  {
    id: 'claude-dusk',
    label: 'Claude — Dusk',
    agentId: 'claude',
    borderRadius: 'md',
    fontFamily: 'sans',
    dark: {
      primary: '#D4956A',
      primaryForeground: '#1A1410',
      background: '#0F0D0B',
      surface: '#1A1715',
      border: '#2E2926',
      text: '#E8E0D8',
      textMuted: '#8A7E74',
      sidebar: '#12100E',
      sidebarActive: '#2A2320',
    },
    light: {
      primary: '#B5703B',
      primaryForeground: '#FFFFFF',
      background: '#FAF7F2',
      surface: '#FFFFFF',
      border: '#E7DFD4',
      text: '#2A2018',
      textMuted: '#8A7E74',
      sidebar: '#F3ECE2',
      sidebarActive: '#E9DFD1',
    },
  },
]
