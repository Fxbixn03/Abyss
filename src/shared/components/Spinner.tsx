import { cn } from '@/shared/lib/utils'
import { Icon } from './Icon'

export interface SpinnerProps {
  /** Screen-reader label announced while the spinner is visible. Defaults to 'Loading…' */
  label?: string
  /** Additional class names applied to the Icon element. */
  className?: string
}

/**
 * Accessible spinner that pairs an animated loader icon with a visually-hidden
 * screen-reader label so assistive technology knows something is in progress.
 *
 * Usage:
 *   <Spinner />                        → "Loading…" announced
 *   <Spinner label="Saving…" />        → "Saving…" announced
 *   <Spinner className="size-3" />     → custom size
 */
export function Spinner({ label = 'Loading…', className }: SpinnerProps) {
  return (
    <>
      <Icon
        name="loader"
        aria-hidden="true"
        className={cn('animate-spin', className)}
      />
      <span className="sr-only">{label}</span>
    </>
  )
}
