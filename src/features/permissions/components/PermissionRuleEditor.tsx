import { Fragment, useMemo, useState } from 'react'
import type { PermissionColumn } from '@/shared/types/config'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  isValidRule,
  parseRule,
  PATH_TOOLS,
  previewSpecifier,
  type RulePreview,
} from '../lib/glob'
import { assessRisk, type RuleConflict } from '../lib/conflicts'
import { BulkAddRules } from './BulkAddRules'

/** Turns an absolute path into a glob relative to the project base. */
function toGlob(chosen: string, base: string | undefined, isDir: boolean): string {
  let rel = chosen
  if (base && chosen.startsWith(base)) rel = chosen.slice(base.length)
  rel = rel.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  if (!rel) return isDir ? '**' : ''
  return isDir ? `${rel}/**` : rel
}

/** Display order for a rule list (display only — never persisted). */
export type RuleSort = 'order' | 'az' | 'tool'

const KNOWN_TOOLS = [
  'Bash',
  'Read',
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'Glob',
  'Grep',
  'Task',
  'TodoWrite',
]

const CATEGORY_LABELS: Record<PermissionColumn, string> = {
  allow: 'Allow',
  ask: 'Ask',
  deny: 'Deny',
}

const PRESETS: Record<PermissionColumn, string[]> = {
  allow: [
    'Bash(git status:*)',
    'Bash(git diff:*)',
    'Bash(npm run test:*)',
    'Read(./**)',
  ],
  ask: ['Bash(git push:*)', 'Bash(rm:*)', 'Bash(git commit:*)'],
  deny: ['Read(./.env)', 'Read(./.env.*)', 'Read(./secrets/**)'],
}

/** Combined status of a single rule row, with an aggregated tooltip. */
interface RuleStatus {
  icon: string
  className: string
  messages: string[]
}

function ruleStatus(
  rule: string,
  category: PermissionColumn,
  conflict: RuleConflict | undefined,
): RuleStatus {
  const messages: string[] = []
  let icon = 'circle-check'
  let className = 'text-muted-foreground'

  const risk = assessRisk(rule, category)
  const losingConflict = conflict && conflict.winner !== category

  if (risk.level === 'high') {
    icon = 'shield-alert'
    className = 'text-destructive'
    messages.push(risk.reason)
  } else if (risk.level === 'warn') {
    icon = 'circle-alert'
    className = 'text-warning'
    messages.push(risk.reason)
  }

  if (losingConflict && conflict) {
    if (risk.level === 'none') {
      icon = 'circle-alert'
      className = 'text-warning'
    }
    messages.push(
      `Also in ${CATEGORY_LABELS[conflict.winner]} — ${CATEGORY_LABELS[conflict.winner]} wins.`,
    )
  }

  if (messages.length === 0 && !isValidRule(rule)) {
    icon = 'circle-alert'
    className = 'text-warning'
    messages.push('Unusual format — double-check this rule.')
  }

  return { icon, className, messages }
}

export function PermissionRuleEditor({
  category,
  values,
  inherited = [],
  filter = '',
  sort = 'order',
  conflicts,
  mcpServers = [],
  relativeBase,
  readOnly = false,
  onChange,
  onMove,
}: {
  category: PermissionColumn
  values: string[]
  /** Rules inherited from the global profile (shown read-only when in project scope). */
  inherited?: string[]
  /** Case-insensitive substring filter applied to displayed rules. */
  filter?: string
  /** Display ordering (does not change the persisted order). */
  sort?: RuleSort
  /** Cross-column conflicts keyed by trimmed rule. */
  conflicts?: Map<string, RuleConflict>
  /** Names of configured MCP servers, offered in the builder's tool select. */
  mcpServers?: string[]
  /** Base path used to relativise picked paths into globs. */
  relativeBase?: string
  /** Render the list read-only (used for the effective-policy view). */
  readOnly?: boolean
  onChange: (values: string[]) => void
  /** Move a rule to another column (removes it here, adds it there). */
  onMove?: (rule: string, target: PermissionColumn) => void
}) {
  const [tool, setTool] = useState('Bash')
  const [specifier, setSpecifier] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const isMcp = tool.startsWith('mcp__')

  const preview = useMemo<RulePreview>(() => {
    if (isMcp) {
      const spec = specifier.trim()
      return {
        kind: 'tool',
        matches: [],
        valid: true,
        note: spec
          ? `Targets ${tool}__${spec}.`
          : `Targets every tool on ${tool}.`,
      }
    }
    return previewSpecifier(tool, specifier)
  }, [tool, specifier, isMcp])

  const addRule = (rule: string) => {
    const trimmed = rule.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
  }

  const addMany = (rules: string[]) => {
    const have = new Set(values)
    const next = [...values]
    for (const r of rules) {
      const t = r.trim()
      if (t && !have.has(t)) {
        have.add(t)
        next.push(t)
      }
    }
    if (next.length !== values.length) onChange(next)
  }

  const addFromBuilder = () => {
    const spec = specifier.trim()
    if (isMcp) {
      addRule(spec ? `${tool}__${spec}` : `${tool}__*`)
    } else {
      addRule(spec ? `${tool}(${spec})` : tool)
    }
    setSpecifier('')
  }

  const remove = (rule: string) => onChange(values.filter((v) => v !== rule))

  // Prefill the builder from an existing rule so the user can add a variant.
  const duplicateToBuilder = (rule: string) => {
    const { tool: t, specifier: spec } = parseRule(rule)
    if (t.startsWith('mcp__')) {
      const parts = t.split('__')
      setTool(`mcp__${parts[1] ?? ''}`)
      setSpecifier(parts.slice(2).join('__').replace(/\*$/, ''))
    } else {
      setTool(t)
      setSpecifier(spec ?? '')
    }
  }

  const pickPath = async (isDir: boolean) => {
    const res = isDir
      ? await ipc.pickDirectory('Choose a folder')
      : await ipc.pickFile({ title: 'Choose a file' })
    if (res.path) setSpecifier(toGlob(res.path, relativeBase, isDir))
  }

  const startEdit = (rule: string) => {
    setEditing(rule)
    setEditValue(rule)
  }

  const commitEdit = () => {
    if (editing === null) return
    const next = editValue.trim()
    setEditing(null)
    if (!next || next === editing) return
    if (values.includes(next)) return // would duplicate another rule
    onChange(values.map((v) => (v === editing ? next : v)))
  }

  // Inherited rules already present locally aren't shown twice.
  const inheritedOnly = inherited.filter((r) => !values.includes(r))

  const q = filter.trim().toLowerCase()
  const match = (r: string) => !q || r.toLowerCase().includes(q)
  const shownInherited = q ? inheritedOnly.filter(match) : inheritedOnly

  const filtered = q
    ? values.filter((r) => r.toLowerCase().includes(q))
    : values
  const sorted =
    sort === 'az'
      ? [...filtered].sort((a, b) => a.localeCompare(b))
      : sort === 'tool'
        ? [...filtered].sort(
            (a, b) =>
              parseRule(a).tool.localeCompare(parseRule(b).tool) ||
              a.localeCompare(b),
          )
        : filtered
  const display = sorted.map((rule, i) => {
    const groupTool = parseRule(rule).tool
    const prevTool = i > 0 ? parseRule(sorted[i - 1]).tool : null
    const header = sort === 'tool' && groupTool !== prevTool ? groupTool : null
    return { rule, header }
  })

  const totalEmpty = values.length === 0 && inheritedOnly.length === 0
  const filteredEmpty =
    !totalEmpty && display.length === 0 && shownInherited.length === 0

  const moveTargets = (Object.keys(CATEGORY_LABELS) as PermissionColumn[]).filter(
    (c) => c !== category,
  )

  return (
    <div className="flex flex-col gap-2">
      {shownInherited.map((rule) => (
        <Tooltip key={`inherited-${rule}`}>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1 opacity-60">
              <Icon name="globe" className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-code text-xs">
                {rule}
              </span>
              <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium uppercase text-muted-foreground">
                Global
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Inherited from your global profile — applies everywhere. Edit it in
            Global scope.
          </TooltipContent>
        </Tooltip>
      ))}

      {totalEmpty ? (
        <p className="text-xs text-muted-foreground">No rules.</p>
      ) : filteredEmpty ? (
        <p className="text-xs text-muted-foreground">No matches.</p>
      ) : (
        display.map(({ rule, header }) => {
          const status = ruleStatus(rule, category, conflicts?.get(rule.trim()))
          return (
            <Fragment key={rule}>
              {header && (
                <p className="px-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {header}
                </p>
              )}
              <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                {status.messages.length > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Icon
                          name={status.icon}
                          className={cn('size-3.5 shrink-0', status.className)}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px]">
                      {status.messages.join(' ')}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Icon
                    name={status.icon}
                    className={cn('size-3.5 shrink-0', status.className)}
                  />
                )}

                {editing === rule ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitEdit()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditing(null)
                      }
                    }}
                    className="h-6 flex-1 font-code text-xs"
                  />
                ) : (
                  <span
                    data-selectable
                    className={cn(
                      'min-w-0 flex-1 truncate font-code text-xs',
                      !readOnly && 'cursor-text',
                    )}
                    title={rule}
                    onClick={readOnly ? undefined : () => startEdit(rule)}
                  >
                    {rule}
                  </span>
                )}

                {!readOnly && editing !== rule && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${rule}`}
                      >
                        <Icon name="more-horizontal" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => startEdit(rule)}>
                        <Icon name="pencil" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => duplicateToBuilder(rule)}>
                        <Icon name="copy" />
                        Duplicate
                      </DropdownMenuItem>
                      {onMove &&
                        moveTargets.map((target) => (
                          <DropdownMenuItem
                            key={target}
                            onSelect={() => onMove(rule, target)}
                          >
                            <Icon name="arrow-right" />
                            Move to {CATEGORY_LABELS[target]}
                          </DropdownMenuItem>
                        ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => remove(rule)}
                      >
                        <Icon name="trash" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </Fragment>
          )
        })
      )}

      {!readOnly && (
        <>
          <div className="flex items-center gap-2">
            <Select value={tool} onValueChange={setTool}>
              <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {KNOWN_TOOLS.map((t) => (
                    <SelectItem key={t} value={t} className="font-code">
                      {t}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {mcpServers.length > 0 && (
                  <SelectGroup>
                    {mcpServers.map((name) => (
                      <SelectItem
                        key={name}
                        value={`mcp__${name}`}
                        className="font-code"
                      >
                        mcp · {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            <Input
              value={specifier}
              onChange={(e) => setSpecifier(e.target.value)}
              placeholder={isMcp ? 'tool name (optional)' : 'specifier (optional)'}
              className="font-code"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addFromBuilder()
                }
              }}
            />
            {!isMcp && PATH_TOOLS.has(tool) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Pick a path"
                  >
                    <Icon name="folder-open" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void pickPath(true)}>
                    <Icon name="folder" />
                    Choose folder…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void pickPath(false)}>
                    <Icon name="file-text" />
                    Choose file…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={addFromBuilder}
              aria-label="Add rule"
            >
              <Icon name="plus" />
            </Button>
          </div>

          {/* Live glob / command preview as the user types the specifier. */}
          {(specifier.trim() || isMcp) && (
            <p
              className={cn(
                'flex items-start gap-1.5 px-0.5 text-[11px]',
                preview.valid ? 'text-muted-foreground' : 'text-warning',
              )}
            >
              <Icon
                name={preview.valid ? 'circle-check' : 'circle-alert'}
                className="mt-0.5 size-3 shrink-0"
              />
              <span className="font-code">{preview.note}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="self-start">
                  <Icon name="plus" />
                  Presets
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PRESETS[category].map((preset) => (
                  <DropdownMenuItem
                    key={preset}
                    disabled={values.includes(preset)}
                    onSelect={() => addRule(preset)}
                    className="font-code text-xs"
                  >
                    {preset}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <BulkAddRules category={category} existing={values} onAdd={addMany} />
          </div>
        </>
      )}
    </div>
  )
}
