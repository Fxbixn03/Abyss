/**
 * Generic, kind-agnostic discovery dialog. Renders one tab per
 * {@link DiscoverySource} for the given `kind`: searchable sources get an
 * in-app search box + result list, website sources get an "open externally"
 * panel. The consuming feature supplies `renderResult` to draw a single hit
 * (incl. its own "Add" action) — this shell knows nothing kind-specific.
 *
 * It powers MCP-server discovery today and is meant to back skills / agents /
 * commands / themes by passing a different `kind`.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  DiscoveryKind,
  DiscoveryResult,
  DiscoverySource,
} from '@/shared/discovery/types'
import { sourcesForKind } from '@/shared/discovery/sources'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Icon } from './Icon'

const DEBOUNCE_MS = 300

export interface DiscoverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: DiscoveryKind
  title: string
  description?: string
  /** Draw one result row, including its own primary action. */
  renderResult: (result: DiscoveryResult) => ReactNode
}

export function DiscoverDialog({
  open,
  onOpenChange,
  kind,
  title,
  description,
  renderResult,
}: DiscoverDialogProps) {
  const sources = useMemo(() => sourcesForKind(kind), [kind])
  const [sourceId, setSourceId] = useState(() => sources[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DiscoveryResult[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [wasOpen, setWasOpen] = useState(false)
  const reqId = useRef(0)

  const activeSource = sources.find((s) => s.id === sourceId) ?? sources[0]

  // Reset to the first source with a clean slate whenever the dialog opens.
  // Adjusting state during render (vs. an effect) avoids a cascading re-render.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSourceId(sources[0]?.id ?? '')
      setQuery('')
      setResults([])
      setNextCursor(undefined)
      setError(undefined)
    }
  }

  // Debounced search: re-runs on open, source switch, or query change.
  useEffect(() => {
    if (!open || !activeSource || activeSource.mode !== 'search') return
    const timer = setTimeout(() => {
      const myId = ++reqId.current
      setLoading(true)
      setError(undefined)
      void ipc
        .discoverySearch({ kind, sourceId: activeSource.id, query })
        .then((res) => {
          if (reqId.current !== myId) return
          setResults(res.results)
          setNextCursor(res.nextCursor)
          setError(res.error)
          setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [open, kind, activeSource, query])

  const loadMore = () => {
    if (!activeSource || !nextCursor) return
    const myId = ++reqId.current
    setLoadingMore(true)
    void ipc
      .discoverySearch({
        kind,
        sourceId: activeSource.id,
        query,
        cursor: nextCursor,
      })
      .then((res) => {
        if (reqId.current !== myId) return
        setResults((prev) => [...prev, ...res.results])
        setNextCursor(res.nextCursor)
        setError(res.error)
        setLoadingMore(false)
      })
  }

  const switchSource = (id: string) => {
    setSourceId(id)
    setQuery('')
    setResults([])
    setNextCursor(undefined)
    setError(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Tabs value={sourceId} onValueChange={switchSource} className="min-w-0">
          {sources.length > 1 && (
            <TabsList>
              {sources.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {sources.map((s) => (
            <TabsContent key={s.id} value={s.id}>
              <SourceBody
                source={s}
                query={query}
                onQueryChange={setQuery}
                loading={loading}
                loadingMore={loadingMore}
                error={error}
                results={results}
                nextCursor={nextCursor}
                onLoadMore={loadMore}
                renderResult={renderResult}
              />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function SourceBody({
  source,
  query,
  onQueryChange,
  loading,
  loadingMore,
  error,
  results,
  nextCursor,
  onLoadMore,
  renderResult,
}: {
  source: DiscoverySource
  query: string
  onQueryChange: (q: string) => void
  loading: boolean
  loadingMore: boolean
  error?: string
  results: DiscoveryResult[]
  nextCursor?: string
  onLoadMore: () => void
  renderResult: (result: DiscoveryResult) => ReactNode
}) {
  if (source.mode === 'website') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Icon name="globe" className="size-8 text-muted-foreground" />
        <p className="max-w-sm text-sm text-muted-foreground">
          {source.description}
        </p>
        <Button onClick={() => void ipc.openExternal(source.url)}>
          <Icon name="external-link" />
          Open {source.label}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={`Search ${source.label}…`}
        autoFocus
      />
      <div className="flex max-h-[55vh] min-h-[8rem] min-w-0 flex-col gap-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Searching…
          </p>
        ) : error ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <Icon name="alert-triangle" className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No results found{query.trim() ? ` for “${query.trim()}”` : ''}.
          </p>
        ) : (
          <>
            {results.map((r) => (
              <Fragment key={r.id}>{renderResult(r)}</Fragment>
            ))}
            {nextCursor && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="mt-1 self-center"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
