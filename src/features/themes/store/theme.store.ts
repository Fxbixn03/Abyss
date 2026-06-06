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
  /** User-created themes + edited built-ins (override a built-in by sharing id). */
  customThemes: ThemeConfig[]
  /** Built-in theme ids the user deleted (hidden from the list). */
  hiddenThemes: string[]

  setAppearance: (mode: AppearanceMode) => void
  toggleAppearance: () => void
  setAgentTheme: (agentId: AgentId, themeId: string) => void
  addCustomTheme: (theme: ThemeConfig) => void
  removeCustomTheme: (themeId: string) => void
  /** Delete any theme (custom removed, built-in hidden); never the last one. */
  deleteTheme: (themeId: string) => void
  /** Un-hide built-ins and drop edits that override built-ins. */
  restoreDefaults: () => void

  allThemes: () => ThemeConfig[]
  getThemesForAgent: (agentId: AgentId) => ThemeConfig[]
  getActiveTheme: (agentId: AgentId) => ThemeConfig
}

function defaultThemeIdFor(agentId: AgentId): string {
  if (agentRegistry.has(agentId))
    return agentRegistry.get(agentId).defaultThemeId
  return BUILTIN_THEMES[0].id
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      appearance: 'dark',
      agentThemeMap: {},
      customThemes: [],
      hiddenThemes: [],

      setAppearance: (mode) => set({ appearance: mode }),
      toggleAppearance: () =>
        set((s) => ({
          appearance: s.appearance === 'dark' ? 'light' : 'dark',
        })),

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

      removeCustomTheme: (themeId) =>
        set((s) => {
          // Drop any agent that pointed at the deleted theme so it falls back
          // to its default.
          const agentThemeMap = Object.fromEntries(
            Object.entries(s.agentThemeMap).filter(([, id]) => id !== themeId),
          )
          return {
            customThemes: s.customThemes.filter((t) => t.id !== themeId),
            agentThemeMap,
          }
        }),

      deleteTheme: (themeId) =>
        set((s) => {
          // Never delete the last remaining theme.
          if (get().allThemes().length <= 1) return s
          const isBuiltin = BUILTIN_THEMES.some((b) => b.id === themeId)
          const agentThemeMap = Object.fromEntries(
            Object.entries(s.agentThemeMap).filter(([, id]) => id !== themeId),
          )
          return {
            customThemes: s.customThemes.filter((t) => t.id !== themeId),
            hiddenThemes: isBuiltin
              ? [...new Set([...s.hiddenThemes, themeId])]
              : s.hiddenThemes,
            agentThemeMap,
          }
        }),

      restoreDefaults: () =>
        set((s) => ({
          hiddenThemes: [],
          // Drop edits that override built-ins; keep purely-custom themes.
          customThemes: s.customThemes.filter(
            (c) => !BUILTIN_THEMES.some((b) => b.id === c.id),
          ),
        })),

      allThemes: () => {
        const custom = get().customThemes
        const hidden = new Set(get().hiddenThemes)
        // Custom themes override built-ins of the same id; hidden ones drop out.
        const merged = [
          ...custom,
          ...BUILTIN_THEMES.filter((b) => !custom.some((c) => c.id === b.id)),
        ]
        return merged.filter((t) => !hidden.has(t.id))
      },

      getThemesForAgent: (agentId) =>
        get()
          .allThemes()
          .filter((t) => t.agentId === agentId || t.agentId === '*'),

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
        hiddenThemes: s.hiddenThemes,
      }),
    },
  ),
)
