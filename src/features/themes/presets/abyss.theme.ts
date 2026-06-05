import type { ThemeConfig } from '@/shared/types/theme'

/**
 * Global themes (agentId '*') — available to every agent, so the user can pick
 * a neutral color theme independent of the active agent's brand palette.
 */
export const abyssThemes: ThemeConfig[] = [
  {
    id: 'abyss-slate',
    label: 'Abyss — Slate',
    agentId: '*',
    borderRadius: 'md',
    fontFamily: 'sans',
    dark: {
      primary: '#818CF8',
      primaryForeground: '#0B0B12',
      background: '#0B0D12',
      surface: '#14171F',
      border: '#232838',
      text: '#E6E9F2',
      textMuted: '#7A839C',
      sidebar: '#090A0F',
      sidebarActive: '#1B2030',
    },
    light: {
      primary: '#5B63D3',
      primaryForeground: '#FFFFFF',
      background: '#F8F9FC',
      surface: '#FFFFFF',
      border: '#E4E7F0',
      text: '#1A1D29',
      textMuted: '#5A6175',
      sidebar: '#EEF0F8',
      sidebarActive: '#E2E6F4',
    },
  },
  {
    id: 'abyss-mono',
    label: 'Abyss — Mono',
    agentId: '*',
    borderRadius: 'none',
    fontFamily: 'mono',
    dark: {
      primary: '#E0B341',
      primaryForeground: '#1A1505',
      background: '#0B0B0C',
      surface: '#151517',
      border: '#26262A',
      text: '#E6E6E8',
      textMuted: '#7A7A82',
      sidebar: '#08080A',
      sidebarActive: '#1C1C20',
    },
    light: {
      primary: '#B5870B',
      primaryForeground: '#FFFFFF',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      border: '#E4E4E7',
      text: '#18181B',
      textMuted: '#6B6B72',
      sidebar: '#F1F1F2',
      sidebarActive: '#E7E7E9',
    },
  },
]
