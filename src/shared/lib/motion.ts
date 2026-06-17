/**
 * Returns the appropriate `ScrollBehavior` value based on the user's
 * `prefers-reduced-motion` system preference.
 *
 * Use this instead of hard-coding `behavior: 'smooth'` so that users who
 * have requested reduced motion get immediate (`'instant'`) scrolling.
 */
export function scrollBehavior(): ScrollBehavior {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'instant'
  }
  return 'smooth'
}
