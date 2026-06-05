import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentId } from '@/shared/types/agent'
import type { AppearanceMode, ThemeConfig } from '@/shared/types/theme'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { BUILTIN_THEMES } from '../presets'

interface ThemeState {
  /** Global light/dark appearance. */
  appearance: AppearanceMode
  /** agentId -> chosen themeId. */
  agentThemeMap: Record<AgentId, string>
  /** User-created themes (built-ins live in BUILTIN_THEMES). */
  customThemes: ThemeConfig[]

  setAppearance: (mode: AppearanceMode) => void
  toggleAppearance: () => void
  setAgentTheme: (agentId: AgentId, themeId: string) => void
  addCustomTheme: (theme: ThemeConfig) => void

  allThemes: () => ThemeConfig[]
  getThemesForAgent: (agentId: AgentId) => ThemeConfig[]
  getActiveTheme: (agentId: AgentId) => ThemeConfig
}

function defaultThemeIdFor(agentId: AgentId): string {
  if (agentRegistry.has(agentId)) return agentRegistry.get(agentId).defaultThemeId
  return BUILTIN_THEMES[0].id
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      appearance: 'dark',
      agentThemeMap: {},
      customThemes: [],

      setAppearance: (mode) => set({ appearance: mode }),
      toggleAppearance: () =>
        set((s) => ({ appearance: s.appearance === 'dark' ? 'light' : 'dark' })),

      setAgentTheme: (agentId, themeId) =>
        set((s) => ({
          agentThemeMap: { ...s.agentThemeMap, [agentId]: themeId },
        })),

      addCustomTheme: (theme) =>
        set((s) => ({
          customThemes: [
            ...s.customThemes.filter((t) => t.id !== theme.id),
            theme,
          ],
        })),

      allThemes: () => [...BUILTIN_THEMES, ...get().customThemes],

      getThemesForAgent: (agentId) =>
        get().allThemes().filter(
          (t) => t.agentId === agentId || t.agentId === '*',
        ),

      getActiveTheme: (agentId) => {
        const all = get().allThemes()
        const chosenId =
          get().agentThemeMap[agentId] ?? defaultThemeIdFor(agentId)
        return (
          all.find((t) => t.id === chosenId) ??
          all.find((t) => t.agentId === agentId) ??
          all[0]
        )
      },
    }),
    {
      name: 'abyss-themes',
      partialize: (s) => ({
        appearance: s.appearance,
        agentThemeMap: s.agentThemeMap,
        customThemes: s.customThemes,
      }),
    },
  ),
)
