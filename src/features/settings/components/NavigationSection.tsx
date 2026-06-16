import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import type { NavItem } from '@/app/navigation'
import { PRIMARY_NAV } from '@/app/navigation'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useNavPrefsStore,
  isNavHidden,
  applyNavOrder,
} from '@/features/navigation/store/navPrefs.store'
import { useSettingsStore } from '../store/settings.store'

export function NavigationSection() {
  const agent = useActiveAgent()
  const betaFeatures = useSettingsStore((s) => s.settings.betaFeatures)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)
  const hidden = useNavPrefsStore((s) => s.hidden)
  const order = useNavPrefsStore((s) => s.order)
  const toggleHidden = useNavPrefsStore((s) => s.toggleHidden)
  const move = useNavPrefsStore((s) => s.move)
  const resetAgent = useNavPrefsStore((s) => s.resetAgent)

  // Pages this agent can show (capability-gated), in the user's saved order.
  const available: NavItem[] = [
    ...PRIMARY_NAV.filter(
      (item) =>
        !item.requiresCapability ||
        !!agent.capabilities[item.requiresCapability],
    ),
    ...(agent.getSidebarSections?.() ?? []),
  ]
  const ordered = applyNavOrder(available, order[agent.id])
  const orderedIds = ordered.map((i) => i.id)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Beta features</CardTitle>
          <CardDescription>
            Show beta-quality pages in the navigation. When off, those pages are
            hidden everywhere and their keyboard shortcuts do nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium">Enable beta pages</p>
          <Switch
            checked={betaFeatures}
            onCheckedChange={(v) => void updatePrefs({ betaFeatures: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Pages for {agent.displayName}</CardTitle>
            <CardDescription>
              Toggle pages on or off and reorder them in the sidebar. Each agent
              keeps its own layout.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resetAgent(agent.id)}
          >
            <Icon name="rotate-ccw" />
            Reset
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {ordered.map((item, index) => {
            const on = !isNavHidden(hidden, agent.id, item.id)
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-4"
                    disabled={index === 0}
                    onClick={() => move(agent.id, orderedIds, item.id, 'up')}
                    aria-label="Move up"
                  >
                    <Icon name="chevron-up" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-4"
                    disabled={index === ordered.length - 1}
                    onClick={() => move(agent.id, orderedIds, item.id, 'down')}
                    aria-label="Move down"
                  >
                    <Icon name="chevron-down" />
                  </Button>
                </div>
                <Icon
                  name={item.icon}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.label}
                </span>
                <Switch
                  checked={on}
                  onCheckedChange={() => toggleHidden(agent.id, item.id)}
                  aria-label={`Toggle ${item.label}`}
                />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
