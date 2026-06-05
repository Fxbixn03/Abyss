import { useState } from 'react'
import type { CollectionKind } from '@/shared/types/collections'
import { COLLECTION_LABELS } from '@/shared/types/collections'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import type { NewItemValues } from '../lib/templates'

const ID_RE = /^[A-Za-z0-9._-]+$/

export interface NewItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CollectionKind
  existingIds: string[]
  onCreate: (values: NewItemValues) => void
}

export function NewItemDialog({
  open,
  onOpenChange,
  kind,
  existingIds,
  onCreate,
}: NewItemDialogProps) {
  const labels = COLLECTION_LABELS[kind]
  const [id, setId] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('sonnet')
  const [tools, setTools] = useState('')

  // Re-seed fields each time the dialog opens.
  const [seeded, setSeeded] = useState(false)
  if (open && !seeded) {
    setId('')
    setDescription('')
    setModel('sonnet')
    setTools('')
    setSeeded(true)
  }
  if (!open && seeded) setSeeded(false)

  const idError =
    id.trim() === ''
      ? null
      : !ID_RE.test(id.trim())
        ? 'Only letters, numbers, dot, dash and underscore.'
        : existingIds.includes(id.trim())
          ? 'An item with this id already exists.'
          : null
  const canCreate = id.trim() !== '' && idError === null

  const submit = () => {
    if (!canCreate) return
    onCreate({
      id: id.trim(),
      name: id.trim(),
      description,
      model: kind === 'agents' ? model : undefined,
      tools: kind === 'agents' ? tools : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New {labels.singular}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-id">
              {kind === 'skills' ? 'Folder name / id' : 'File name / id'}
            </Label>
            <Input
              id="item-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="my-helper"
              className="font-code"
              autoFocus
            />
            {idError && <p className="text-xs text-destructive">{idError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Input
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What it does and when to use it"
            />
          </div>

          {kind === 'agents' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-model">Model</Label>
                <Input
                  id="item-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="sonnet"
                  className="font-code"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-tools">Tools</Label>
                <Input
                  id="item-tools"
                  value={tools}
                  onChange={(e) => setTools(e.target.value)}
                  placeholder="Read, Grep, Bash"
                  className="font-code"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canCreate}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
