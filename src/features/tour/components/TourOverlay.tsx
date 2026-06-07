import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import type { TourPlacement } from '../tour.steps'
import { TOUR_STEPS } from '../tour.steps'
import { useTourStore } from '../store/tour.store'

const CARD_WIDTH = 340
const GAP = 14
const SPOTLIGHT_PAD = 8

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function sameBox(a: Box | null, b: Box): boolean {
  return (
    a !== null &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

/** Fixed-position style for the explanation card relative to the spotlight. */
function cardStyle(box: Box, placement: TourPlacement): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampLeft = (x: number) =>
    Math.min(Math.max(8, x), vw - CARD_WIDTH - 8)
  // Keep side-anchored cards from clipping past the top/bottom edges.
  const clampTop = (y: number) => Math.min(Math.max(8, y), vh - 200)

  switch (placement) {
    case 'top':
      return {
        top: box.top - GAP,
        left: clampLeft(box.left),
        transform: 'translateY(-100%)',
      }
    case 'left':
      return {
        top: clampTop(box.top),
        left: box.left - GAP,
        transform: 'translateX(-100%)',
      }
    case 'right':
      return { top: clampTop(box.top), left: box.left + box.width + GAP }
    case 'bottom':
    case 'center':
    default:
      return { top: box.top + box.height + GAP, left: clampLeft(box.left) }
  }
}

/**
 * Renders the guided tour: a dimming spotlight cut around the current step's
 * target element plus a small explanation card with Back / Next / Skip. Starts
 * itself once after onboarding and can be replayed from Settings.
 */
export function TourOverlay() {
  const active = useTourStore((s) => s.active)
  const stepIndex = useTourStore((s) => s.stepIndex)
  const start = useTourStore((s) => s.start)
  const next = useTourStore((s) => s.next)
  const prev = useTourStore((s) => s.prev)
  const stop = useTourStore((s) => s.stop)

  const loaded = useSettingsStore((s) => s.loaded)
  const onboarded = useSettingsStore((s) => s.settings.onboarded)
  const tutorialDone = useSettingsStore((s) => s.settings.tutorialDone)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)

  const navigate = useNavigate()
  const location = useLocation()

  const step = active ? TOUR_STEPS[stepIndex] : undefined
  const isLast = stepIndex === TOUR_STEPS.length - 1
  const [box, setBox] = useState<Box | null>(null)

  // Auto-start the tour once per session, after the user has onboarded and only
  // if they have not seen it yet.
  const autostarted = useRef(false)
  useEffect(() => {
    if (autostarted.current) return
    if (loaded && onboarded && !tutorialDone) {
      autostarted.current = true
      start()
    }
  }, [loaded, onboarded, tutorialDone, start])

  // Pin to the step's route.
  useEffect(() => {
    if (!step?.route) return
    if (location.pathname !== step.route) navigate(step.route)
  }, [step, location.pathname, navigate])

  // Measure the spotlight target, polling so it survives navigation, scrolling
  // and layout shifts. Centered steps (no target) are gated out at render time,
  // so stale boxes are never shown.
  const targeted = Boolean(step?.target)
  useEffect(() => {
    if (!active || !step?.target) return
    const selector = `[data-tour="${step.target}"]`
    let scrolled = false
    const tick = () => {
      const el = document.querySelector(selector)
      if (!el) return
      const r = el.getBoundingClientRect()
      const measured: Box = {
        top: r.top - SPOTLIGHT_PAD,
        left: r.left - SPOTLIGHT_PAD,
        width: r.width + SPOTLIGHT_PAD * 2,
        height: r.height + SPOTLIGHT_PAD * 2,
      }
      setBox((prev) => (sameBox(prev, measured) ? prev : measured))
      if (!scrolled) {
        scrolled = true
        el.scrollIntoView({ block: 'nearest' })
      }
    }
    // rAF for the first measure keeps setState out of the effect body.
    const raf = requestAnimationFrame(tick)
    const id = window.setInterval(tick, 150)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(id)
    }
  }, [active, step])

  const finish = useCallback(() => {
    stop()
    if (!tutorialDone) void updatePrefs({ tutorialDone: true })
  }, [stop, tutorialDone, updatePrefs])

  const advance = useCallback(() => {
    if (isLast) finish()
    else next()
  }, [isLast, finish, next])

  // Keyboard: Esc skips, Enter / → advance, ← goes back.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, stepIndex, advance, prev, finish])

  const spotlight = targeted ? box : null
  const positioned = useMemo(
    () => (spotlight ? cardStyle(spotlight, step?.placement ?? 'bottom') : null),
    [spotlight, step?.placement],
  )

  if (!active || !step) return null

  const card = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      className="pointer-events-auto fixed z-[201] w-[340px] max-w-[calc(100vw-16px)] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl"
      style={
        positioned ?? {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }
      }
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </span>
        <button
          type="button"
          onClick={finish}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon name="x" className="size-3.5" />
          Skip tutorial
        </button>
      </div>

      <h2 className="text-sm font-semibold">{step.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {step.body}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={
                i === stepIndex
                  ? 'size-1.5 rounded-full bg-primary'
                  : 'size-1.5 rounded-full bg-muted'
              }
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <Button variant="ghost" size="sm" onClick={prev}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={advance}>
            {isLast ? (
              <>
                <Icon name="check" />
                Finish
              </>
            ) : (
              <>
                Next
                <Icon name="arrow-right" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {spotlight ? (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-primary transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" />
      )}
      {card}
    </div>,
    document.body,
  )
}
