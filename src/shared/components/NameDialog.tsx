import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'

export interface NameDialogProps {
  open: boolean
  title: string
  initial?: string
  confirmLabel?: string
  placeholder?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}

/**
 * A tiny "enter a name" prompt. The parent should remount it (via `key`) when
 * opening for a different default, so the field reflects `initial` without a
 * set-state effect.
 */
export function NameDialog({
  open,
  title,
  initial = '',
  confirmLabel = 'OK',
  placeholder = 'Name',
  onOpenChange,
  onConfirm,
}: NameDialogProps) {
  const [name, setName] = useState(initial)
  const trimmed = name.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="font-code"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && trimmed) onConfirm(trimmed)
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!trimmed} onClick={() => onConfirm(trimmed)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
