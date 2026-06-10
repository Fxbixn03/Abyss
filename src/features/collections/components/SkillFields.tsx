import { useEffect, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import type { SkillFile } from '@/shared/types/collections'
import { MarkdownEditor } from '@/features/config/components/MarkdownEditor'
import { ValidationList } from '@/features/config/components/ValidationList'
import { estimateTokens, formatTokens } from '@/features/context/lib/tokens'
import type { CollectionController } from '../hooks/useCollectionManager'
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter'
import { KNOWN_TOOLS, parseToolList, joinToolList } from '../lib/tools'
import { checkSkill, extractReferencedPaths } from '../lib/skillChecks'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Structured editor for an Agent Skill: a SKILL.md frontmatter form (name /
 * description / allowed-tools), the body, and a browser for the skill's bundled
 * files (scripts/ references/ assets/) with missing-reference validation.
 */
export function SkillFields({ cm }: { cm: CollectionController }) {
  const { data, body } = parseFrontmatter(cm.draft)
  const [files, setFiles] = useState<SkillFile[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const setField = (key: string, value: string) =>
    cm.setDraft(serializeFrontmatter({ ...data, [key]: value }, body))
  const setBody = (next: string) =>
    cm.setDraft(serializeFrontmatter(data, next))

  const tools = parseToolList(data['allowed-tools'])
  const toolChips = [
    ...KNOWN_TOOLS,
    ...tools.filter((t) => !KNOWN_TOOLS.includes(t)),
  ]
  const toggleTool = (t: string) =>
    setField(
      'allowed-tools',
      joinToolList(
        tools.includes(t) ? tools.filter((x) => x !== t) : [...tools, t],
      ),
    )

  // Load the skill folder's bundled files (setState only inside callbacks).
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) setFilesLoading(true)
    })
    ipc
      .listSkillFiles(cm.agentId, cm.basePath, cm.selectedId ?? '')
      .then((r) => {
        if (active) {
          setFiles(r.files)
          setFilesLoading(false)
        }
      })
      .catch(() => {
        if (active) setFilesLoading(false)
      })
    return () => {
      active = false
    }
  }, [cm.agentId, cm.basePath, cm.selectedId, refresh])

  const referenced = new Set(extractReferencedPaths(body))
  const issues = checkSkill({
    name: data.name ?? '',
    description: data.description ?? '',
    content: cm.draft,
    body,
    files: files.map((f) => f.relPath),
  })
  const tokens = estimateTokens(cm.draft)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="skill-name">Name</Label>
        <Input
          id="skill-name"
          value={data.name ?? ''}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="pdf-processor"
          className="font-code"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skill-desc">Description</Label>
        <Input
          id="skill-desc"
          value={data.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="What it does and when the agent should load it"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Allowed tools</Label>
          {tools.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              Empty = inherit all
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {toolChips.map((t) => {
            const on = tools.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTool(t)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 font-code text-xs transition-colors',
                  on
                    ? 'border-primary/50 bg-accent text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/60',
                )}
              >
                {on && <Icon name="check" className="size-3" />}
                {t}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Bundle files</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setRefresh((n) => n + 1)}
              aria-label="Refresh files"
              title="Refresh"
            >
              <Icon name="refresh-cw" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cm.filePath && void ipc.revealPath(cm.filePath)}
              disabled={!cm.filePath}
            >
              <Icon name="folder-open" />
              Open folder
            </Button>
          </div>
        </div>
        <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-card/40">
          {filesLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : files.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No bundled files. Put scripts/ references/ assets/ next to
              SKILL.md for progressive disclosure.
            </p>
          ) : (
            files.map((f) => {
              const isReferenced = referenced.has(f.relPath)
              return (
                <button
                  key={f.relPath}
                  type="button"
                  onClick={() => void ipc.revealPath(f.path)}
                  title="Reveal in folder"
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs transition-colors hover:bg-accent/60"
                >
                  <Icon
                    name="file-text"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="flex-1 truncate font-code">{f.relPath}</span>
                  {isReferenced && (
                    <Badge variant="muted" className="shrink-0 text-[10px]">
                      referenced
                    </Badge>
                  )}
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>SKILL.md</Label>
      </div>
      <div className="min-h-0 flex-1">
        <MarkdownEditor value={body} language="markdown" onChange={setBody} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <ValidationList issues={issues} />
        <Badge variant="muted" className="shrink-0 font-code">
          ~{formatTokens(tokens)} tokens
        </Badge>
      </div>
    </div>
  )
}
