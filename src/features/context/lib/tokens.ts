/**
 * Rough token estimation. The agents' real tokenizers aren't available in the
 * renderer, so we use the well-known ~4-characters-per-token heuristic. Good
 * enough to compare layers and flag a context that's getting heavy.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
