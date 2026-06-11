import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { parseFrontmatter } from '@/features/collections/lib/frontmatter'
import { formatTokens } from '@/features/context/lib/tokens'
import {
  simulateActivation,
  type Activation,
  type RuleActivation,
  type RuleInput,
} from '../lib/simulate'

/** Common paths offered as one-click examples. */
const EXAMPLE_PATHS = [
  'src/components/Button.tsx',
  'src/api/server.ts',
  'README.md',
  'styles/main.css',
  'tests/unit.test.ts',
]

const ACTIVATION_META: Record<
  Activation,
  { label: string; variant: 'default' | 'success' | 'warning' | 'muted' | 'outline'; icon: string }
> = {
  always: { label: 'Always', variant: 'default', icon: 'infinity' },
  auto: { label: 'Auto-attached', variant: 'success', icon: 'zap' },
  agent: { label: 'Agent-requested', variant: 'warning', icon: 'sparkles' },
  inactive: { label: 'Inactive', variant: 'muted', icon: 'minus' },
  manual: { label: 'Manual only', variant: 'outline', icon: 'at-sign' },
}

/** Sort order: loaded rules first, dead rules last. */
const ORDER: Record<Activation, number> = {
  always: 0,
  auto: 1,
  agent: 2,
  inactive: 3,
  manual: 4,
}

function RuleRow({ rule }: { rule: RuleActivation }) {
  const meta = ACTIVATION_META[rule.activation]
  return (
    <Card
      className={cn(
        'flex items-start gap-3 p-3',
        rule.active && 'border-l-2 border-l-success',
      )}
    >
      <Icon
        name={meta.icon}
        className={cn(
          'mt-0.5 size-4 shrink-0',
          rule.active ? 'text-success' : 'text-muted-foreground',
        )}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{rule.name}</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="ml-auto shrink-0 font-code text-xs text-muted-foreground">
            ~{formatTokens(rule.tokens)} tok
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{rule.reason}</p>
        {rule.globs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rule.globs.map((g) => (
              <code
                key={g}
                className={cn(
                  'rounded px-1.5 py-0.5 font-code text-[11px]',
                  rule.matchedGlobs.includes(g)
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {g}
              </code>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

export function RuleActivationPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const supported = agent.capabilities.rules

  const [rules, setRules] = useState<RuleInput[]>([])
  const [loading, setLoading] = useState(true)
  const [path, setPath] = useState('src/components/Button.tsx')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      if (!supported || !basePath) {
        if (active) {
          setRules([])
          setLoading(false)
        }
        return
      }
      const list = await ipc
        .listCollection(agent.id, basePath, 'rules')
        .catch(() => [])
      const loaded = await Promise.all(
        list.map(async (item) => {
          const { content } = await ipc
            .readCollectionItem(agent.id, basePath, 'rules', item.id)
            .catch(() => ({ content: '' }))
          const { data, body } = parseFrontmatter(content)
          return {
            id: item.id,
            name: data.name?.trim() || item.name || item.id,
            globs: data.globs,
            alwaysApply: data.alwaysApply?.toLowerCase() === 'true',
            description: data.description ?? item.description,
            content: body,
          } satisfies RuleInput
        }),
      )
      if (active) {
        setRules(loaded)
        setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [agent.id, basePath, supported])

  const sim = useMemo(() => simulateActivation(rules, path), [rules, path])
  const ordered = useMemo(
    () =>
      [...sim.rules].sort(
        (a, b) =>
          ORDER[a.activation] - ORDER[b.activation] ||
          a.name.localeCompare(b.name),
      ),
    [sim.rules],
  )

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Rule Activation"
        description="See which rules fire for a given file, and what they cost"
        icon="crosshair"
      />

      {!supported ? (
        <EmptyState
          icon="book-open"
          title={`${agent.displayName} has no scoped rules`}
          description="This simulator is for agents with glob-scoped rules (like Cursor’s .mdc files). Switch to a rules-capable agent to use it."
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <Card className="space-y-3 p-3">
            <label className="text-sm font-medium" htmlFor="rule-sim-path">
              Test file path
            </label>
            <div className="flex items-center gap-2">
              <Icon
                name="file-code"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <Input
                id="rule-sim-path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="src/components/Button.tsx"
                className="font-code"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PATHS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPath(p)}
                  className={cn(
                    'rounded-md border px-2 py-0.5 font-code text-xs transition-colors',
                    p === path
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </Card>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading rules…</p>
          ) : rules.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="No rules to simulate"
              description={`No rules found for ${agent.displayName} in the current scope. Add some on the Rules page first.`}
            />
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                <Icon name="layers" className="size-4 text-muted-foreground" />
                <span>
                  <span className="font-medium text-foreground">
                    {sim.activeCount}
                  </span>{' '}
                  of {rules.length} rules load for{' '}
                  <code className="font-code text-xs">{sim.path || '—'}</code>
                </span>
                <span className="ml-auto font-code text-xs text-muted-foreground">
                  ~{formatTokens(sim.activeTokens)} tokens in context
                </span>
              </div>
              {ordered.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
