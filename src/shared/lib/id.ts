/** Renderer-side unique id helper (Web Crypto, available under Electron). */
export function genId(): string {
  return crypto.randomUUID()
}
