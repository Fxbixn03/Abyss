import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'

export function ReplayBar({
  index,
  total,
  playing,
  speed,
  onPlayPause,
  onStep,
  onRestart,
  onCycleSpeed,
  onClose,
}: {
  index: number
  total: number
  playing: boolean
  speed: number
  onPlayPause: () => void
  onStep: (delta: number) => void
  onRestart: () => void
  onCycleSpeed: () => void
  onClose: () => void
}) {
  const atEnd = index >= total
  const pct = total > 0 ? Math.round((index / total) * 100) : 0

  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRestart}
        aria-label="Restart"
        title="Restart"
      >
        <Icon name="rotate-ccw" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onStep(-1)}
        disabled={index <= 0}
        aria-label="Step back"
      >
        <Icon name="chevron-left" />
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        onClick={onPlayPause}
        disabled={atEnd}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <Icon name={playing ? 'pause' : 'play'} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onStep(1)}
        disabled={atEnd}
        aria-label="Step forward"
      >
        <Icon name="chevron-right" />
      </Button>

      <button
        type="button"
        onClick={onCycleSpeed}
        className="rounded border border-border px-1.5 py-0.5 font-code text-[11px] text-muted-foreground hover:text-foreground"
        title="Playback speed"
      >
        {speed}×
      </button>

      <div className="mx-1 h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 font-code text-[11px] text-muted-foreground">
        {Math.min(index, total)} / {total}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Exit replay"
        title="Exit replay"
      >
        <Icon name="x" />
      </Button>
    </div>
  )
}
