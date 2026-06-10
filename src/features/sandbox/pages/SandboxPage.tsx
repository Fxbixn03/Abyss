import { useEffect, useMemo, useState } from 'react'
import type { SandboxRunResult } from '@/shared/types/sandbox'
import { PageHeader } from '@/shared/components/PageHeader'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Icon } from '@/shared/components/Icon'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ipc } from '@/shared/ipc/ipc.client'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { estimateTokens, formatTokens } from '@/features/context/lib/tokens'
import { useSandboxIntent } from '../store/sandboxIntent.store'

function CommandSandbox() {
  const [command, setCommand] = useState('')
  const [cwd, setCwd] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SandboxRunResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const acknowledged = useSettingsStore((s) => s.settings.sandboxAcknowledged)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)

  // Preload a command requested from elsewhere (e.g. "Test in Sandbox" on a
  // hook). setState runs only in callbacks, never synchronously here.
  useEffect(() => {
    const fill = (c: string | null) => {
      if (c === null) return
      setCommand(c)
      setResult(null)
    }
    void Promise.resolve().then(() =>
      fill(useSandboxIntent.getState().consumeCommand()),
    )
    return useSandboxIntent.subscribe(() =>
      fill(useSandboxIntent.getState().consumeCommand()),
    )
  }, [])

  const run = async () => {
    if (!command.trim()) return
    setRunning(true)
    setResult(null)
    const r = await ipc
      .sandboxRun(command, { cwd: cwd || undefined })
      .catch(() => null)
    setResult(r)
    setRunning(false)
  }

  // Gate the first-ever run behind an explicit confirmation that these commands
  // execute on the real machine; the acknowledgment is persisted so we ask once.
  const requestRun = () => {
    if (!command.trim()) return
    if (acknowledged) void run()
    else setConfirmOpen(true)
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Icon name="terminal" className="size-4" />
          Hook / command runner
        </h2>
        <p className="text-xs text-muted-foreground">
          Try a hook or command shell snippet in a one-off run and see its
          output.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs">
        <Icon
          name="alert-triangle"
          className="size-3.5 shrink-0 text-warning"
        />
        Commands run on your real machine. Use a throwaway directory and avoid
        destructive commands.
      </div>

      <Textarea
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder='e.g. echo "$CLAUDE_PROJECT_DIR" &amp;&amp; git status --short'
        className="font-code"
        rows={3}
      />

      <div className="flex items-center gap-2">
        <Input
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="Working directory (optional)"
          className="font-code text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const { path } = await ipc.pickDirectory(
              'Sandbox working directory',
            )
            if (path) setCwd(path)
          }}
        >
          <Icon name="folder-open" />
          Pick
        </Button>
        <Button onClick={requestRun} disabled={running || !command.trim()}>
          <Icon
            name={running ? 'loader' : 'play'}
            className={running ? 'animate-spin' : ''}
          />
          Run
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Run shell commands on this machine?"
        description="The sandbox executes the command you enter directly on your computer with your account's permissions. Only run commands you trust, and prefer a throwaway working directory. You won't be asked again."
        confirmLabel="I understand, run it"
        onConfirm={() => {
          setConfirmOpen(false)
          void updatePrefs({ sandboxAcknowledged: true })
          void run()
        }}
      />

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Badge
              variant={
                result.timedOut
                  ? 'warning'
                  : result.exitCode === 0
                    ? 'success'
                    : 'danger'
              }
              className="font-code"
            >
              {result.timedOut ? 'timed out' : `exit ${result.exitCode ?? '—'}`}
            </Badge>
            <span className="text-muted-foreground">
              {result.durationMs} ms
            </span>
          </div>
          {result.stdout && (
            <div>
              <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                stdout
              </p>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 px-2.5 py-2 font-code text-[11px] leading-relaxed">
                {result.stdout}
              </pre>
            </div>
          )}
          {result.stderr && (
            <div>
              <p className="mb-0.5 text-[11px] font-medium text-destructive">
                stderr
              </p>
              <pre className="max-h-48 overflow-auto rounded-md bg-destructive/10 px-2.5 py-2 font-code text-[11px] leading-relaxed">
                {result.stderr}
              </pre>
            </div>
          )}
          {!result.stdout && !result.stderr && (
            <p className="text-xs text-muted-foreground">No output.</p>
          )}
        </div>
      )}
    </Card>
  )
}

function PromptSandbox() {
  const [system, setSystem] = useState('')
  const [user, setUser] = useState('')
  const [copied, setCopied] = useState(false)

  // Preload a prompt requested from elsewhere (e.g. "Run in Sandbox" on a
  // subagent). setState runs only in callbacks, never synchronously here.
  useEffect(() => {
    const fill = (d: { system: string; user: string } | null) => {
      if (!d) return
      setSystem(d.system)
      setUser(d.user)
    }
    void Promise.resolve().then(() =>
      fill(useSandboxIntent.getState().consume()),
    )
    return useSandboxIntent.subscribe(() =>
      fill(useSandboxIntent.getState().consume()),
    )
  }, [])

  const tokens = useMemo(
    () => ({
      system: estimateTokens(system),
      user: estimateTokens(user),
      total: estimateTokens(`${system}\n${user}`),
    }),
    [system, user],
  )

  const copy = () => {
    void navigator.clipboard.writeText(
      [system && `# System\n${system}`, user && `# User\n${user}`]
        .filter(Boolean)
        .join('\n\n'),
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Icon name="flask-conical" className="size-4" />
          Prompt scratchpad
        </h2>
        <p className="text-xs text-muted-foreground">
          Draft a system + user prompt and see its size before spending it on a
          real run.
        </p>
      </div>

      <Textarea
        value={system}
        onChange={(e) => setSystem(e.target.value)}
        placeholder="System prompt…"
        rows={4}
      />
      <Textarea
        value={user}
        onChange={(e) => setUser(e.target.value)}
        placeholder="User prompt…"
        rows={4}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted" className="font-code">
          system ~{formatTokens(tokens.system)}
        </Badge>
        <Badge variant="muted" className="font-code">
          user ~{formatTokens(tokens.user)}
        </Badge>
        <Badge variant="secondary" className="font-code">
          total ~{formatTokens(tokens.total)} tokens
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={copy}
          disabled={!system && !user}
        >
          <Icon name={copied ? 'check' : 'copy'} />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </Card>
  )
}

export function SandboxPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Sandbox"
        description="Try out commands, hooks and prompts safely — nothing is saved to your config"
        icon="flask-conical"
      />
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1 lg:grid-cols-2">
        <CommandSandbox />
        <PromptSandbox />
      </div>
    </div>
  )
}
