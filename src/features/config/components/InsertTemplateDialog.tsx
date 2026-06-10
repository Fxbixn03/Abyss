import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { useTemplatesStore } from '@/features/templates/store/templates.store'
import { resolveTemplates } from '@/features/templates/lib/resolve'
import { hasVariables } from '@/features/templates/lib/variables'
import type { PromptTemplate } from '@/features/templates/types'

/**
 * Picks a prompt template to insert into the instruction editor. Selection is
 * handed back to the caller, which substitutes variables and inserts into the
 * draft (so the user reviews before saving).
 */
export function InsertTemplateDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (t: PromptTemplate) => void
}) {
  const customTemplates = useTemplatesStore((s) => s.customTemplates)
  const builtinOverrides = useTemplatesStore((s) => s.builtinOverrides)
  const hiddenBuiltins = useTemplatesStore((s) => s.hiddenBuiltins)
  const [search, setSearch] = useState('')

  const templates = useMemo(
    () =>
      resolveTemplates({ customTemplates, builtinOverrides, hiddenBuiltins }),
    [customTemplates, builtinOverrides, hiddenBuiltins],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [templates, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>Insert prompt template</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
        />
        <div className="-mr-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No templates found.
            </p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t)}
                className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-accent/60"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {t.title}
                  {hasVariables(t.content) && (
                    <Badge variant="muted" className="font-code text-[10px]">
                      variables
                    </Badge>
                  )}
                  {!t.builtin && <Badge variant="muted">custom</Badge>}
                </span>
                {t.description && (
                  <span className="text-xs text-muted-foreground">
                    {t.description}
                  </span>
                )}
                {t.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="font-code text-[10px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon name="info" className="size-3 shrink-0" />
          Inserted into the editor — review and save to write it to disk.
        </p>
      </DialogContent>
    </Dialog>
  )
}
