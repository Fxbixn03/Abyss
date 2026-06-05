import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ConfigLanguage } from '@/shared/types/agent'
import { useThemeStore } from '@/features/themes/store/theme.store'

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

export interface ConfigEditorProps {
  value: string
  language: ConfigLanguage
  onChange: (value: string) => void
  readOnly?: boolean
}

export function ConfigEditor({
  value,
  language,
  onChange,
  readOnly = false,
}: ConfigEditorProps) {
  const appearance = useThemeStore((s) => s.appearance)
  const extensions = useMemo(
    () => [...languageExtensions(language), EditorView.lineWrapping],
    [language],
  )

  return (
    <div className="h-full overflow-hidden rounded-md border border-border bg-card">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={appearance === 'dark' ? oneDark : 'light'}
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
