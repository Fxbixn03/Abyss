/**
 * Theme type contracts.
 *
 * Two theming axes (per the design interview):
 *  1. Appearance mode: light / dark, switchable globally.
 *  2. Color theme: a named palette. Each agent has a default, and the user can
 *     pick any theme per agent. Themes ship as light/dark pairs.
 */

import type { AgentId } from './agent'

export type AppearanceMode = 'light' | 'dark'

export type BorderRadius = 'none' | 'sm' | 'md' | 'lg'

export type FontFamily = 'mono' | 'sans' | 'mixed'

/**
 * The full set of design tokens a palette must define. Names map 1:1 to the
 * CSS custom properties applied on `:root` and consumed by Tailwind/shadcn.
 */
export interface ThemeColors {
  primary: string
  primaryForeground: string
  background: string
  surface: string
  border: string
  text: string
  textMuted: string
  sidebar: string
  sidebarActive: string
  /** Optional semantic accents; sensible fallbacks derived if omitted. */
  success?: string
  warning?: string
  danger?: string
}

export interface ThemeConfig {
  id: string
  label: string
  /** Owning agent id, or '*' for a global theme available to every agent. */
  agentId: AgentId | '*'
  /** Light + dark variants of the same palette. */
  light: ThemeColors
  dark: ThemeColors
  borderRadius: BorderRadius
  fontFamily: FontFamily
}
