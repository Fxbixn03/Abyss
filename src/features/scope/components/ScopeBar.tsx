import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useScopeStore } from '../store/scope.store'

function baseName(p: string): string {
  return (
    p
      .replace(/[/\\]+$/, '')
      .split(/[/\\]/)
      .pop() || p
  )
}

export function ScopeBar() {
  const scope = useScopeStore((s) => s.scope)
  const projectDir = useScopeStore((s) => s.projectDir)
  const recentProjects = useScopeStore((s) => s.recentProjects)
  const setScope = useScopeStore((s) => s.setScope)
  const setProject = useScopeStore((s) => s.setProject)
  const removeRecent = useScopeStore((s) => s.removeRecent)

  const pick = async () => {
    const { path } = await ipc.pickDirectory('Choose a project directory')
    if (path) setProject(path)
  }

  const onProjectClick = () => {
    if (projectDir) setScope('project')
    else void pick()
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3 text-sm">
      <div className="inline-flex items-center rounded-md border border-border p-0.5">
        <button
          type="button"
          onClick={() => setScope('global')}
          className={cn(
            'flex items-center gap-1.5 rounded-[5px] px-2 py-1 text-xs font-medium transition-colors',
            scope === 'global'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon name="globe" className="size-3.5" />
          Global
        </button>
        <button
          type="button"
          onClick={onProjectClick}
          className={cn(
            'flex items-center gap-1.5 rounded-[5px] px-2 py-1 text-xs font-medium transition-colors',
            scope === 'project'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon name="folder" className="size-3.5" />
          Project
        </button>
      </div>

      {scope === 'project' &&
        (projectDir ? (
          <>
            {recentProjects.length > 0 && (
              <Select value={projectDir} onValueChange={setProject}>
                <SelectTrigger className="h-7 w-[160px] gap-1.5 px-2 text-xs">
                  <Icon
                    name="folder-open"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  {/* Name only — the full path already shows to the right. */}
                  <span className="min-w-0 truncate font-code">
                    {baseName(projectDir)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {recentProjects.map((dir) => (
                    <SelectItem key={dir} value={dir} className="font-code">
                      <span className="flex w-full min-w-[180px] items-center gap-2">
                        <span className="min-w-0 flex-1 truncate" title={dir}>
                          {baseName(dir)}
                        </span>
                        {/* Drop a project from the recents list. Stop the
                            pointer/click from selecting the row. */}
                        <button
                          type="button"
                          aria-label={`Remove ${baseName(dir)} from list`}
                          title="Remove from list"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            removeRecent(dir)
                          }}
                          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Icon name="x" className="size-3.5" />
                        </button>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" onClick={() => void pick()}>
              <Icon name="folder-open" />
              Change…
            </Button>
            <button
              type="button"
              onClick={() => void ipc.revealPath(projectDir)}
              className="hidden truncate font-code text-xs text-muted-foreground hover:text-foreground md:inline"
              title={projectDir}
            >
              {projectDir}
            </button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => void pick()}>
            <Icon name="folder-open" />
            Pick a project…
          </Button>
        ))}

      {scope === 'project' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto flex items-center gap-1 font-code text-[11px] text-muted-foreground">
              <Icon name="info" className="size-3.5" />
              global → project → local
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Effective config is merged in this order — project settings override
            global, and a project&apos;s <code>settings.local.json</code>{' '}
            overrides both. Abyss edits the project layer here.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
