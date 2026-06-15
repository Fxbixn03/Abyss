import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { Statistics } from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import type { ConfigLanguage } from '@/shared/types/agent'
import { useThemeStore } from '@/features/themes/store/theme.store'
import { buildHighlightStyle } from './cmHighlight'

function languageExtensions(language: ConfigLanguage): Extension[] {
  switch (language) {
    case 'markdown':
      return [markdown()]
    case 'json':
      return [json()]
    case 'yaml':
      return [yaml()]
    default:
      return []
  }
}

/** Read a CSS custom property from :root, trimmed. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/**
 * Builds a CodeMirror theme extension that mirrors the active Abyss theme
 * palette (via the CSS custom properties set on :root by `applyTheme`).
 * Must be called at render time so it reads the *current* var values.
 */
function buildCmTheme(dark: boolean): Extension {
  const background = cssVar('--background')
  const surface = cssVar('--card')
  const primary = cssVar('--primary')
  const border = cssVar('--border')
  const mutedFg = cssVar('--muted-foreground')
  const foreground = cssVar('--foreground')

  // A slightly lighter/darker surface for the active line and gutter highlights.
  const gutterBg = surface
  const activeGutter = cssVar('--accent')
  const selectionBg = `color-mix(in srgb, ${primary} 25%, transparent)`

  return EditorView.theme(
    {
      '&': {
        background,
        color: foreground,
      },
      '.cm-content': {
        caretColor: primary,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: primary,
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
        {
          backgroundColor: selectionBg,
        },
      '.cm-gutters': {
        backgroundColor: gutterBg,
        color: mutedFg,
        borderRight: `1px solid ${border}`,
      },
      '.cm-activeLineGutter': {
        backgroundColor: activeGutter,
      },
      '.cm-activeLine': {
        backgroundColor: `color-mix(in srgb, ${activeGutter} 40%, transparent)`,
      },
      '.cm-foldPlaceholder': {
        backgroundColor: surface,
        borderColor: border,
        color: mutedFg,
      },
      '.cm-tooltip': {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        color: foreground,
      },
      '.cm-tooltip .cm-tooltip-arrow:before': {
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
      },
      '.cm-tooltip .cm-tooltip-arrow:after': {
        borderTopColor: surface,
        borderBottomColor: surface,
      },
      '.cm-panels': {
        backgroundColor: surface,
        color: foreground,
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: `2px solid ${border}`,
      },
      '.cm-panels.cm-panels-bottom': {
        borderTop: `2px solid ${border}`,
      },
      '.cm-searchMatch': {
        backgroundColor: `color-mix(in srgb, ${primary} 30%, transparent)`,
        outline: `1px solid ${primary}`,
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: `color-mix(in srgb, ${primary} 50%, transparent)`,
      },
    },
    { dark },
  )
}

export interface ConfigEditorProps {
  value: string
  language: ConfigLanguage
  onChange: (value: string) => void
  readOnly?: boolean
  lineWrap?: boolean
  /** Receives the CodeMirror view so callers can scroll/jump programmatically. */
  onCreateEditor?: (view: EditorView) => void
  /** Called on every editor update with cursor/selection statistics. */
  onStatistics?: (stats: Statistics) => void
}

export function ConfigEditor({
  value,
  language,
  onChange,
  readOnly = false,
  lineWrap = true,
  onCreateEditor,
  onStatistics,
}: ConfigEditorProps) {
  const appearance = useThemeStore((s) => s.appearance)
  // agentThemeMap is tracked so the extension is recreated when the user
  // switches themes (which updates CSS vars on :root via useThemeApplier).
  const agentThemeMap = useThemeStore((s) => s.agentThemeMap)

  const extensions = useMemo(
    () => [
      ...languageExtensions(language),
      ...(lineWrap ? [EditorView.lineWrapping] : []),
      buildCmTheme(appearance === 'dark'),
      buildHighlightStyle(appearance === 'dark'),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, lineWrap, appearance, agentThemeMap],
  )

  return (
    <div className="h-full overflow-hidden rounded-md border border-border bg-card">
      <CodeMirror
        value={value}
        onChange={onChange}
        onCreateEditor={onCreateEditor}
        onStatistics={onStatistics}
        extensions={extensions}
        theme="none"
        height="100%"
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          foldGutter: false,
          autocompletion: false,
          searchKeymap: true,
        }}
        style={{ height: '100%', fontSize: '13px' }}
        className="h-full"
      />
    </div>
  )
}
