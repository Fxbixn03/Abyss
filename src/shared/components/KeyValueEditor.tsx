import { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Icon } from './Icon'

export interface KeyValueEditorProps {
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  /** Mask values (e.g. API keys) with a per-row reveal toggle. */
  secret?: boolean
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
  secret = false,
}: KeyValueEditorProps) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const toggleReveal = (key: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const add = () => {
    const key = newKey.trim()
    if (!key) return
    onChange({ ...value, [key]: newValue })
    setNewKey('')
    setNewValue('')
  }

  const remove = (key: string) => {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {Object.entries(value).map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span
            data-selectable
            className="w-44 shrink-0 truncate font-code text-xs"
            title={key}
          >
            {key}
          </span>
          <Input
            type={secret && !revealed.has(key) ? 'password' : 'text'}
            value={val}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            className="font-code"
          />
          {secret && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleReveal(key)}
              aria-label={revealed.has(key) ? `Hide ${key}` : `Reveal ${key}`}
            >
              <Icon name="eye" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(key)}
            aria-label={`Remove ${key}`}
          >
            <Icon name="x" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={keyPlaceholder}
          className="w-44 shrink-0 font-code"
        />
        <Input
          type={secret ? 'password' : 'text'}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={valuePlaceholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          className="font-code"
        />
        <Button
          variant="secondary"
          size="icon"
          onClick={add}
          aria-label="Add variable"
        >
          <Icon name="plus" />
        </Button>
      </div>
    </div>
  )
}
