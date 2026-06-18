/**
 * Reactive `prefers-reduced-motion` helper.
 *
 * The `MediaQueryList` instance is created once at module load and a
 * `'change'` listener keeps the cached boolean up-to-date whenever the
 * user toggles the OS accessibility setting at runtime — so long-lived
 * consumers (e.g. scroll handlers) always read a fresh value without
 * creating a new `matchMedia` query on every call.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

// Initialised once; null when running outside a browser (tests, SSR).
const _mql: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null

// Module-level cache — updated reactively via the listener below.
let _prefersReducedMotion: boolean = _mql?.matches ?? false

if (_mql !== null) {
  _mql.addEventListener('change', (e: MediaQueryListEvent) => {
    _prefersReducedMotion = e.matches
  })
}

/**
 * Returns `true` when the user has requested reduced motion.
 *
 * The value is kept in sync with the OS setting via a `MediaQueryList`
 * `'change'` event — no new query is created on each invocation.
 */
export function getPrefersReducedMotion(): boolean {
  return _prefersReducedMotion
}

/**
 * Returns the appropriate `ScrollBehavior` value based on the user's
 * `prefers-reduced-motion` system preference.
 *
 * Use this instead of hard-coding `behavior: 'smooth'` so that users who
 * have requested reduced motion get immediate (`'instant'`) scrolling.
 */
export function scrollBehavior(): ScrollBehavior {
  return _prefersReducedMotion ? 'instant' : 'smooth'
}
