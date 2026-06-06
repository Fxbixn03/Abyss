import { useState } from 'react'
import type { PermissionRules } from '@/shared/types/config'
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
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

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

const PRESETS: Record<keyof PermissionRules, string[]> = {
  allow: [
    'Bash(git status:*)',
    'Bash(git diff:*)',
    'Bash(npm run test:*)',
    'Read(./**)',
  ],
  ask: ['Bash(git push:*)', 'Bash(rm:*)', 'Bash(git commit:*)'],
  deny: ['Read(./.env)', 'Read(./.env.*)', 'Read(./secrets/**)'],
}

/** A rule is `Tool` or `Tool(specifier)`, or an MCP tool `mcp__server__tool`. */
function isValidRule(rule: string): boolean {
  return (
    /^[A-Za-z_][\w]*(\(.*\))?$/.test(rule) ||
    /^mcp__[\w-]+(__[\w-]+)?$/.test(rule)
  )
}

export function PermissionRuleEditor({
  category,
  values,
  onChange,
}: {
  category: keyof PermissionRules
  values: string[]
  onChange: (values: string[]) => void
}) {
  const [tool, setTool] = useState('Bash')
  const [specifier, setSpecifier] = useState('')

  const addRule = (rule: string) => {
    const trimmed = rule.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
  }

  const addFromBuilder = () => {
    const spec = specifier.trim()
    addRule(spec ? `${tool}(${spec})` : tool)
    setSpecifier('')
  }

  const remove = (rule: string) => onChange(values.filter((v) => v !== rule))

  return (
    <div className="flex flex-col gap-2">
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground">No rules.</p>
      ) : (
        values.map((rule) => {
          const valid = isValidRule(rule)
          return (
            <div
              key={rule}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
            >
              <Icon
                name={valid ? 'circle-check' : 'circle-alert'}
                className={cn(
                  'size-3.5 shrink-0',
                  valid ? 'text-muted-foreground' : 'text-warning',
                )}
              />
              <span
                data-selectable
                className="min-w-0 flex-1 truncate font-code text-xs"
                title={valid ? rule : `${rule} — unusual format`}
              >
                {rule}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(rule)}
                aria-label={`Remove ${rule}`}
              >
                <Icon name="x" />
              </Button>
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
    </div>
  )
}
