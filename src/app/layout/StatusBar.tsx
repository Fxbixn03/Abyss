import { Icon } from '@/shared/components/Icon'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { useThemeStore } from '@/features/themes/store/theme.store'
import { useConfigStore } from '@/features/config/store/config.store'

export function StatusBar() {
  const agent = useActiveAgent()
  const basePath = useBasePath(agent.id)
  const appearance = useThemeStore((s) => s.appearance)
  const themeLabel = useThemeStore((s) => s.getActiveTheme(agent.id).label)

  const spec = useConfigStore((s) => s.spec)
  const draft = useConfigStore((s) => s.draft)
  const original = useConfigStore((s) => s.original)
  const saving = useConfigStore((s) => s.saving)
  const issues = useConfigStore((s) => s.issues)

  const dirty = draft !== original
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-sidebar-border bg-sidebar px-3 text-[11px] text-sidebar-foreground/70">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex items-center gap-1.5">
          <Icon name={agent.icon} className="size-3" />
          {agent.displayName}
        </span>
        {basePath && (
          <>
            <span className="opacity-40">·</span>
            <span className="truncate font-code" title={basePath}>
              {basePath}
            </span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {spec && (
          <span className="flex items-center gap-1.5">
            <Icon
              name={saving ? 'refresh-cw' : dirty ? 'circle-alert' : 'circle-check'}
              className="size-3"
            />
            {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
          </span>
        )}
        {errors > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <Icon name="circle-alert" className="size-3" />
            {errors}
          </span>
        )}
        {warnings > 0 && (
          <span className="flex items-center gap-1 text-warning">
            <Icon name="alert-triangle" className="size-3" />
            {warnings}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Icon name={appearance === 'dark' ? 'moon' : 'sun'} className="size-3" />
          {themeLabel}
        </span>
      </div>
    </footer>
  )
}
