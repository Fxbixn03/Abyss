/**
 * Token-cost helpers. Cost is a cross-cutting concern — both the dashboard
 * usage panel and the chats feature surface it — so this lives in `shared/lib`
 * rather than any single feature.
 *
 * Abyss can't know the exact model behind a historical session, so
 * {@link estimateCostUsd} uses a single Sonnet-class rate and its output is
 * always shown as an estimate. Prefer a runtime-reported real cost where one
 * exists (live runs report `totalCostUsd`).
 */

/** Approximate list price per 1M tokens (USD), Sonnet-class default. */
export const TOKEN_RATE_USD_PER_MTOK = { input: 3, output: 15 }

/**
 * Approximate USD→EUR conversion. This is not a live rate — it is a static
 * approximation, surfaced as "approx" in the UI.
 */
export const APPROX_EUR_PER_USD = 0.92

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * TOKEN_RATE_USD_PER_MTOK.input +
    (outputTokens / 1_000_000) * TOKEN_RATE_USD_PER_MTOK.output
  )
}

export function formatMoney(usd: number, currency: 'usd' | 'eur'): string {
  const value = currency === 'eur' ? usd * APPROX_EUR_PER_USD : usd
  const symbol = currency === 'eur' ? '€' : '$'
  return `${symbol}${value.toFixed(2)}`
}
