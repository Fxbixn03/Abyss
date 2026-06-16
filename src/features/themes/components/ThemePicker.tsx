import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentId } from '@/shared/types/agent'
import type { AppearanceMode, ThemeConfig } from '@/shared/types/theme'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { applyTheme } from '../lib/applyTheme'
import { useThemeStore } from '../store/theme.store'
import { ThemePreview } from './ThemePreview'

/**
 * Per-agent theme selector. Lists every theme available to the agent (its own +
 * global), previews swatches in the current appearance, and applies instantly.
 */
export function ThemePicker({ agentId }: { agentId: AgentId }) {
  const appearance = useThemeStore((s) => s.appearance)
  const customThemes = useThemeStore((s) => s.customThemes)
  const getThemesForAgent = useThemeStore((s) => s.getThemesForAgent)
  const allThemes = useThemeStore((s) => s.allThemes)
  const setAgentTheme = useThemeStore((s) => s.setAgentTheme)
  const addCustomTheme = useThemeStore((s) => s.addCustomTheme)
  const deleteTheme = useThemeStore((s) => s.deleteTheme)
  const restoreDefaults = useThemeStore((s) => s.restoreDefaults)
  const activeTheme = useThemeStore((s) => s.getActiveTheme(agentId))
  const activeThemeId = activeTheme.id

  const [notice, setNotice] = useState<string | null>(null)
  /** Local preview variant — defaults to the live appearance but can differ. */
  const [previewVariant, setPreviewVariant] = useState<AppearanceMode>(appearance)

  void customThemes
  const canDelete = allThemes().length > 1
  const themes: ThemeConfig[] = getThemesForAgent(agentId)

  /** Ref to the radiogroup container to detect whether it contains focus. */
  const groupRef = useRef<HTMLDivElement | null>(null)

  /** Refs to all card buttons so we can call .focus() programmatically. */
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])

  /**
   * Roving tabIndex index — tracks which card is the current "active" card in
   * the radiogroup. Stored in a ref (mutable, no re-render) and mirrored into
   * rovingIndexState (triggers re-render to flip tabIndex attributes). Updates
   * happen only in event handlers (keyboard / focus), not inside effects.
   */
  const rovingIndexRef = useRef<number>(0)
  const [rovingIndexState, setRovingIndexState] = useState<number>(0)

  /**
   * When the active theme changes externally (e.g. import, delete, restore),
   * reset the roving index to the newly-active card so Tab-into-the-grid
   * lands on the right item. We read themes.length to keep the index in bounds
   * but we must not call setRovingIndexState here (setState-in-effect lint
   * error) — instead we update the ref synchronously, then schedule a
   * requestAnimationFrame that updates state outside the render phase.
   */
  const pendingIndexRef = useRef<number | null>(null)
  useEffect(() => {
    const idx = themes.findIndex((t) => t.id === activeThemeId)
    const next = idx >= 0 ? idx : 0
    rovingIndexRef.current = next
    pendingIndexRef.current = next
    // Schedule outside the synchronous effect body to avoid setState-in-effect.
    const id = requestAnimationFrame(() => {
      if (pendingIndexRef.current !== null) {
        setRovingIndexState(pendingIndexRef.current)
        pendingIndexRef.current = null
      }
    })
    return () => {
      cancelAnimationFrame(id)
    }
  }, [activeThemeId, themes])

  const restoreActiveTheme = useCallback(() => {
    applyTheme(activeTheme, appearance)
  }, [activeTheme, appearance])

  /**
   * Move DOM focus to the card at `index`. applyTheme fires automatically via
   * the card's onFocus handler when focus lands.
   */
  const moveFocus = useCallback((index: number) => {
    rovingIndexRef.current = index
    setRovingIndexState(index)
    cardRefs.current[index]?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const count = themes.length
      if (count === 0) return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          moveFocus((rovingIndexRef.current + 1) % count)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          moveFocus((rovingIndexRef.current - 1 + count) % count)
          break
        case 'Home':
          e.preventDefault()
          moveFocus(0)
          break
        case 'End':
          e.preventDefault()
          moveFocus(count - 1)
          break
        case 'Escape':
          restoreActiveTheme()
          break
        default:
          break
      }
    },
    [themes.length, moveFocus, restoreActiveTheme],
  )

  const exportActive = async () => {
    const { path } = await ipc.themeExport(activeTheme, activeTheme.id)
    if (path) setNotice(`Exported "${activeTheme.label}" to ${path}`)
  }

  const importTheme = async () => {
    setNotice(null)
    const { theme, error } = await ipc.themeImport()
    if (error) {
      setNotice(error)
      return
    }
    if (theme) {
      addCustomTheme(theme)
      if (theme.agentId === agentId || theme.agentId === '*') {
        setAgentTheme(agentId, theme.id)
      }
      setNotice(`Imported "${theme.label}".`)
    }
  }

  const deleteActive = () => {
    if (canDelete) deleteTheme(activeThemeId)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void importTheme()}>
          <Icon name="download" />
          Import theme
        </Button>
        <Button variant="outline" size="sm" onClick={() => void exportActive()}>
          <Icon name="upload" />
          Export current
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={deleteActive}
          disabled={!canDelete}
        >
          <Icon name="trash" />
          Delete current
        </Button>
        <Button variant="ghost" size="sm" onClick={restoreDefaults}>
          <Icon name="rotate-ccw" />
          Restore defaults
        </Button>
        {notice && (
          <span className="truncate text-xs text-muted-foreground">
            {notice}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Hover or use arrow keys to preview — click or press Enter/Space to apply.
        </p>
        <div
          role="group"
          aria-label="Preview palette"
          className="flex rounded-md border border-border"
        >
          {(['light', 'dark'] as const).map((variant) => (
            <button
              key={variant}
              type="button"
              onClick={() => setPreviewVariant(variant)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium capitalize transition-colors first:rounded-l-[calc(var(--radius)-1px)] last:rounded-r-[calc(var(--radius)-1px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                previewVariant === variant
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              aria-pressed={previewVariant === variant}
            >
              {variant}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Theme selection"
        tabIndex={-1}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onMouseLeave={restoreActiveTheme}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            restoreActiveTheme()
          }
        }}
        onKeyDown={handleKeyDown}
      >
        {themes.map((theme, index) => {
          const selected = theme.id === activeThemeId
          const isFocusable = index === rovingIndexState
          return (
            <button
              key={theme.id}
              ref={(el) => {
                cardRefs.current[index] = el
              }}
              role="radio"
              type="button"
              tabIndex={isFocusable ? 0 : -1}
              aria-pressed={selected}
              aria-checked={selected}
              onMouseEnter={() => applyTheme(theme, appearance)}
              onFocus={() => {
                rovingIndexRef.current = index
                setRovingIndexState(index)
                applyTheme(theme, appearance)
              }}
              onClick={() => setAgentTheme(agentId, theme.id)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/50',
                selected
                  ? 'border-primary ring-1 ring-primary/40'
                  : 'border-border',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{theme.label}</span>
                {selected ? (
                  <Icon name="circle-check" className="size-4 text-primary" />
                ) : theme.agentId === '*' ? (
                  <Badge variant="muted">global</Badge>
                ) : null}
              </div>
              <ThemePreview theme={theme} variant={previewVariant} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
