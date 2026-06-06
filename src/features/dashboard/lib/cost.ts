/**
 * Rough token-cost estimate. Abyss can't know the exact model per session, so
 * this uses a single Sonnet-class default rate and is labelled an estimate.
 */
const RATE_USD = { input: 3, output: 15 } // USD per 1M tokens
const EUR_PER_USD = 0.92

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * RATE_USD.input +
    (outputTokens / 1_000_000) * RATE_USD.output
  )
}

export function formatMoney(usd: number, currency: 'usd' | 'eur'): string {
  const value = currency === 'eur' ? usd * EUR_PER_USD : usd
  const symbol = currency === 'eur' ? '€' : '$'
  return `${symbol}${value.toFixed(2)}`
}
