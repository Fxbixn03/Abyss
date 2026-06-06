import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Icon } from '@/shared/components/Icon'

export interface ComposerProps {
  onSend: (text: string) => void
  onStop: () => void
  /** True while a turn is in flight. */
  busy: boolean
  disabled?: boolean
  settingsBar?: ReactNode
}

export function Composer({
  onSend,
  onStop,
  busy,
  disabled,
  settingsBar,
}: ComposerProps) {
  const [text, setText] = useState('')

  const submit = () => {
    const trimmed = text.trim()
    if (trimmed === '' || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-2.5">
      {settingsBar}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={
            disabled ? 'Sign in to start chatting…' : 'Message the agent…'
          }
          disabled={disabled}
          className="max-h-48 min-h-[44px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />
        {busy ? (
          <Button
            variant="destructive"
            size="icon"
            onClick={onStop}
            title="Stop"
          >
            <Icon name="square" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={submit}
            disabled={disabled || text.trim() === ''}
            title="Send (Enter)"
          >
            <Icon name="send" />
          </Button>
        )}
      </div>
    </div>
  )
}
