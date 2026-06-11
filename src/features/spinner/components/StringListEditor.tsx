import { useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'

export interface StringListEditorProps {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  /** Max entries; the add row hides once reached. */
  max?: number
}

/** Editable, reorderable list of short strings (spinner verbs / tips). */
export function StringListEditor({
  items,
  onChange,
  placeholder,
  max = 50,
}: StringListEditorProps) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim()
    if (!value || items.includes(value) || items.length >= max) return
    onChange([...items, value])
    setDraft('')
  }

  const remove = (index: number) =>
    onChange(items.filter((_, i) => i !== index))

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
            >
              <span className="flex-1 truncate text-sm">{item}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                <Icon name="chevron-up" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Move down"
              >
                <Icon name="chevron-down" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(i)}
                aria-label={`Remove ${item}`}
              >
                <Icon name="x" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {items.length < max && (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder={placeholder}
          />
          <Button variant="outline" onClick={add} disabled={!draft.trim()}>
            <Icon name="plus" />
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
