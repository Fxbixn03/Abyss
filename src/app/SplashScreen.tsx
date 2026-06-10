import { Icon } from '@/shared/components/Icon'

/**
 * Boot splash shown while the app loads settings and probes each agent's CLI.
 * Once both checks resolve, {@link App} swaps it for the router (Dashboard).
 */
export function SplashScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Icon name="layers" className="size-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Abyss</h1>
          <p className="text-sm text-muted-foreground">
            Visual config for your AI coding agents
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon name="loader" className="size-4 animate-spin" />
        Loading settings and detecting agents…
      </div>
    </div>
  )
}
