import { useRef, useState } from 'react'
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
  onSeek,
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
  onSeek: (index: number) => void
  onClose: () => void
}) {
  const atEnd = index >= total
  const pct = total > 0 ? Math.round((index / total) * 100) : 0

  // Track whether we were playing before a drag started so we can resume.
  const wasPlyingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const seekFromEvent = (clientX: number) => {
    const el = trackRef.current
    if (!el || total <= 0) return
    const rect = el.getBoundingClientRect()
    const clamped = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(Math.round(clamped * total))
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle direct clicks, not pointer-drag end clicks.
    if (!dragging) {
      seekFromEvent(e.clientX)
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    wasPlyingRef.current = playing
    setDragging(true)
    // Pause while dragging by seeking without resuming.
    seekFromEvent(e.clientX)
    if (playing) {
      onPlayPause()
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    seekFromEvent(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    seekFromEvent(e.clientX)
    setDragging(false)
    // Resume playback only if we were playing before the drag.
    if (wasPlyingRef.current) {
      onPlayPause()
    }
  }

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
        aria-label={`Playback speed: ${speed}x`}
      >
        {speed}×
      </button>

      {/* Wider hit area with py-2, visible bar kept at h-1.5 */}
      <div
        ref={trackRef}
        className="mx-1 flex-1 cursor-pointer py-2"
        role="slider"
        tabIndex={0}
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Replay progress"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onSeek(Math.max(0, index - 1))
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            onSeek(Math.min(total, index + 1))
          } else if (e.key === 'Home') {
            e.preventDefault()
            onSeek(0)
          } else if (e.key === 'End') {
            e.preventDefault()
            onSeek(total)
          }
        }}
      >
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
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
