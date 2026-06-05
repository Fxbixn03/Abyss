import { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Icon } from './Icon'

export interface StringListEditorProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function StringListEditor({
  values,
  onChange,
  placeholder = 'Add rule…',
}: StringListEditorProps) {
  const [input, setInput] = useState('')

  const add = () => {
    const value = input.trim()
    if (!value) return
    if (!values.includes(value)) onChange([...values, value])
    setInput('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          className="font-code"
        />
        <Button variant="secondary" size="icon" onClick={add} aria-label="Add">
          <Icon name="plus" />
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {values.length === 0 && (
          <li className="px-1 text-xs text-muted-foreground">None</li>
        )}
        {values.map((value) => (
          <li
            key={value}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
          >
            <span data-selectable className="font-code text-xs">
              {value}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(values.filter((v) => v !== value))}
              aria-label={`Remove ${value}`}
            >
              <Icon name="x" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
