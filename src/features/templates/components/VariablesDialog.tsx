import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { extractVariables, applyVariables } from '../lib/variables'
import { VariablesFields } from './VariablesFields'

/**
 * Collects values for a template's `{{placeholders}}` and hands back the fully
 * substituted content. Used for "Copy" (the apply dialog embeds its own fields).
 */
export function VariablesDialog({
  open,
  onOpenChange,
  title,
  content,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  content: string
  submitLabel: string
  onSubmit: (substituted: string) => void
}) {
  const variables = useMemo(() => extractVariables(content), [content])
  // The parent remounts this dialog per template (via `key`), so a fresh value
  // map is created each time without a reset effect.
  const [values, setValues] = useState<Record<string, string>>({})

  const submit = () => {
    onSubmit(applyVariables(content, values))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fill in “{title}”</DialogTitle>
        </DialogHeader>
        <VariablesFields
          variables={variables}
          values={values}
          onChange={(name, value) =>
            setValues((v) => ({ ...v, [name]: value }))
          }
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
