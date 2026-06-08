import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort boundary around the router. A render-time crash in any page is
 * caught here and shown as a recoverable screen instead of a blank window, so a
 * single broken view can't take down the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error caught by ErrorBoundary', error, info)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Icon name="alert-triangle" className="size-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred while rendering.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={this.reset}>
            Try again
          </Button>
          <Button onClick={() => window.location.reload()}>Reload app</Button>
        </div>
      </div>
    )
  }
}
