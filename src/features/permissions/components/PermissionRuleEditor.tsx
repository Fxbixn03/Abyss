import { useMemo, useState } from 'react'
import type { PermissionColumn } from '@/shared/types/config'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import {
  Select,
  SelectContent,
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
import { isValidRule, previewSpecifier } from '../lib/glob'
import { assessRisk, type RuleConflict } from '../lib/conflicts'
import { BulkAddRules } from './BulkAddRules'

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
  conflicts,
  onChange,
  onMove,
}: {
  category: PermissionColumn
  values: string[]
  /** Rules inherited from the global profile (shown read-only when in project scope). */
  inherited?: string[]
  /** Case-insensitive substring filter applied to displayed rules. */
  filter?: string
  /** Cross-column conflicts keyed by trimmed rule. */
  conflicts?: Map<string, RuleConflict>
  onChange: (values: string[]) => void
  /** Move a rule to another column (removes it here, adds it there). */
  onMove?: (rule: string, target: PermissionColumn) => void
}) {
  const [tool, setTool] = useState('Bash')
  const [specifier, setSpecifier] = useState('')

  const preview = useMemo(
    () => previewSpecifier(tool, specifier),
    [tool, specifier],
  )

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
    addRule(spec ? `${tool}(${spec})` : tool)
    setSpecifier('')
  }

  const remove = (rule: string) => onChange(values.filter((v) => v !== rule))

  // Inherited rules already present locally aren't shown twice.
  const inheritedOnly = inherited.filter((r) => !values.includes(r))

  const q = filter.trim().toLowerCase()
  const match = (r: string) => !q || r.toLowerCase().includes(q)
  const shownValues = q ? values.filter(match) : values
  const shownInherited = q ? inheritedOnly.filter(match) : inheritedOnly

  const totalEmpty = values.length === 0 && inheritedOnly.length === 0
  const filteredEmpty =
    !totalEmpty && shownValues.length === 0 && shownInherited.length === 0

  const moveTargets = (
    Object.keys(CATEGORY_LABELS) as PermissionColumn[]
  ).filter((c) => c !== category)

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
        shownValues.map((rule) => {
          const status = ruleStatus(rule, category, conflicts?.get(rule.trim()))
          return (
            <div
              key={rule}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
            >
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
              <span
                data-selectable
                className="min-w-0 flex-1 truncate font-code text-xs"
                title={rule}
              >
                {rule}
              </span>
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
                  {onMove && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => remove(rule)}
                  >
                    <Icon name="trash" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })
      )}

      <div className="flex items-center gap-2">
        <Select value={tool} onValueChange={setTool}>
          <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KNOWN_TOOLS.map((t) => (
              <SelectItem key={t} value={t} className="font-code">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={specifier}
          onChange={(e) => setSpecifier(e.target.value)}
          placeholder="specifier (optional)"
          className="font-code"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addFromBuilder()
            }
          }}
        />
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
      {specifier.trim() && (
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
    </div>
  )
}
