import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { useScopeStore } from '@/features/scope/store/scope.store'
import type { AgentId } from '@/shared/types/agent'
import type {
  WorkspaceConfigFind,
  WorkspaceRepo,
  WorkspaceScanResult,
} from '@/shared/types/workspace'
import { useWorkspaceStore } from '../store/workspace.store'

/** Human-friendly file size for a config find. */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function agentLabel(id: string): string {
  return agentRegistry.has(id as AgentId)
    ? agentRegistry.get(id as AgentId).displayName
    : id
}

function agentIcon(id: string): string {
  return agentRegistry.has(id as AgentId)
    ? agentRegistry.get(id as AgentId).icon
    : 'box'
}

function FindRow({ find }: { find: WorkspaceConfigFind }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <Icon name={agentIcon(find.agentId)} className="size-4 shrink-0" />
      <span className="shrink-0 text-sm">{agentLabel(find.agentId)}</span>
      <code className="min-w-0 flex-1 truncate font-code text-xs text-muted-foreground">
        {find.relPath}
      </code>
      <Badge variant="muted" className="font-code">
        {find.isDir ? 'dir' : formatBytes(find.bytes)}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        title="Reveal in file manager"
        onClick={() => void ipc.revealPath(find.absPath)}
      >
        <Icon name="folder-open" className="size-3.5" />
      </Button>
    </div>
  )
}

function RepoCard({
  repo,
  onSetProject,
}: {
  repo: WorkspaceRepo
  onSetProject: (repo: WorkspaceRepo) => void
}) {
  const agents = new Set(repo.finds.map((f) => f.agentId))
  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <Icon
          name={repo.isGitRepo ? 'git-branch' : 'folder'}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="font-medium">{repo.name}</span>
        {repo.isGitRepo && <Badge variant="success">git</Badge>}
        <Badge variant="muted">
          {agents.size} {agents.size === 1 ? 'agent' : 'agents'}
        </Badge>
        <code className="min-w-0 flex-1 truncate text-right font-code text-xs text-muted-foreground">
          {repo.path}
        </code>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onSetProject(repo)}
        >
          <Icon name="folder-cog" />
          Set as project
        </Button>
      </div>
      <div className="space-y-0.5">
        {repo.finds.map((f) => (
          <FindRow key={f.relPath} find={f} />
        ))}
      </div>
    </Card>
  )
}

export function WorkspacePage() {
  const navigate = useNavigate()
  const lastRoot = useWorkspaceStore((s) => s.lastRoot)
  const setLastRoot = useWorkspaceStore((s) => s.setLastRoot)
  const setProject = useScopeStore((s) => s.setProject)

  const [root, setRoot] = useState<string | null>(lastRoot)
  const [result, setResult] = useState<WorkspaceScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [rescan, setRescan] = useState(0)

  // Scan whenever the chosen root (or the rescan counter) changes — including
  // the persisted last root on mount, so the page isn't empty on return.
  useEffect(() => {
    if (!root) return
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        const res = await ipc.workspaceScan(root)
        if (active) {
          setResult(res)
          setLastRoot(root)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [root, rescan, setLastRoot])

  const choose = async () => {
    const { path } = await ipc.pickDirectory(
      'Choose a folder to scan for agent config',
      root ?? undefined,
    )
    if (path) {
      if (path === root) setRescan((n) => n + 1)
      else setRoot(path)
    }
  }

  const setAsProject = (repo: WorkspaceRepo) => {
    setProject(repo.path)
    toast.success(`Project set to ${repo.name}`, {
      description: 'Config surfaces now target this repo.',
    })
    navigate('/config')
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Workspace"
        description="Agent config across all your repos, in one place"
        icon="folder-tree"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void choose()}>
              <Icon name="folder-search" />
              Choose folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!root || loading}
              onClick={() => setRescan((n) => n + 1)}
            >
              <Icon
                name={loading ? 'loader' : 'refresh-cw'}
                className={loading ? 'animate-spin' : ''}
              />
              Rescan
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {loading && !result ? (
          <p className="text-sm text-muted-foreground">Scanning…</p>
        ) : !result ? (
          <EmptyState
            icon="folder-tree"
            title="Discover agent config across your repos"
            description="Pick a folder that holds your projects. Abyss scans one level down and lists every repo with CLAUDE.md, .cursor/rules, copilot-instructions.md and more."
            action={
              <Button onClick={() => void choose()}>
                <Icon name="folder-search" />
                Choose folder
              </Button>
            }
          />
        ) : result.outOfScope ? (
          <EmptyState
            icon="shield-alert"
            title="Folder is out of scope"
            description="Abyss only scans inside your home directory and its own data folders. Pick a folder under your home directory."
            action={
              <Button onClick={() => void choose()}>
                <Icon name="folder-search" />
                Choose another folder
              </Button>
            }
          />
        ) : result.repos.length === 0 ? (
          <EmptyState
            icon="folder-x"
            title="No agent config found"
            description={`Scanned ${result.scannedCount} folder${result.scannedCount === 1 ? '' : 's'} under ${result.root}. None of them have a known agent config file.`}
            action={
              <Button onClick={() => void choose()}>
                <Icon name="folder-search" />
                Choose another folder
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {result.repos.length}
              </span>{' '}
              {result.repos.length === 1 ? 'repo' : 'repos'} with agent config ·{' '}
              {result.scannedCount} scanned in{' '}
              <code className="font-code text-xs">{result.root}</code>
            </p>
            {result.repos.map((repo) => (
              <RepoCard
                key={repo.path}
                repo={repo}
                onSetProject={setAsProject}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
