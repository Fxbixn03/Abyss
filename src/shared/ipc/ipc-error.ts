/**
 * Cross-process error normalization for the typed IPC bridge.
 *
 * Electron only ferries an error's `message` across `ipcRenderer.invoke`, so
 * custom fields (`code`, `filePath`, …) would be lost. To keep structured error
 * info, the main-side {@link handle} wrapper encodes a normalized payload into
 * the thrown message behind a sentinel, and the renderer's IPC client decodes it
 * back into a typed {@link IpcError}. Pure module (no Node, no React) so both
 * the main process and the renderer can import it.
 */

/** Stable error codes the renderer can branch on. */
export const IpcErrorCode = {
  /** A JSON/TOML config file on disk could not be parsed (corrupt). */
  ConfigParse: 'CONFIG_PARSE_ERROR',
  /** A config file parsed but failed schema validation. */
  ConfigInvalid: 'CONFIG_INVALID',
  /** Operation was cancelled (AbortController). */
  Aborted: 'ABORTED',
  Unknown: 'UNKNOWN',
} as const

export type IpcErrorCode = (typeof IpcErrorCode)[keyof typeof IpcErrorCode]

export interface NormalizedError {
  code: string
  message: string
  /** Structured extras, e.g. `{ filePath }` for a parse error. */
  details?: Record<string, unknown>
}

/** A typed error reconstructed on the renderer side from a failed IPC call. */
export class IpcError extends Error {
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(payload: NormalizedError) {
    super(payload.message)
    this.name = 'IpcError'
    this.code = payload.code
    this.details = payload.details
  }

  /** The offending file path, when the error carries one. */
  get filePath(): string | undefined {
    const p = this.details?.filePath
    return typeof p === 'string' ? p : undefined
  }
}

const SENTINEL = '__ABYSS_IPC_ERROR__'

/** Collapse any thrown value into a {@link NormalizedError}. */
export function normalizeError(err: unknown): NormalizedError {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const code = typeof e.code === 'string' ? e.code : IpcErrorCode.Unknown
    const message =
      typeof e.message === 'string' && e.message ? e.message : String(err)
    const details: Record<string, unknown> = {}
    if (typeof e.filePath === 'string') details.filePath = e.filePath
    if (e.details && typeof e.details === 'object') {
      Object.assign(details, e.details as Record<string, unknown>)
    }
    return {
      code,
      message,
      details: Object.keys(details).length ? details : undefined,
    }
  }
  return { code: IpcErrorCode.Unknown, message: String(err) }
}

/** Encode an error into the wire `message` a main handler rethrows. */
export function encodeIpcError(err: unknown): string {
  return SENTINEL + JSON.stringify(normalizeError(err))
}

/** Decode a rejected `invoke` value back into a typed {@link IpcError}. */
export function decodeIpcError(err: unknown): IpcError {
  if (err instanceof IpcError) return err
  const raw = err instanceof Error ? err.message : String(err)
  const idx = raw.indexOf(SENTINEL)
  if (idx >= 0) {
    try {
      return new IpcError(
        JSON.parse(raw.slice(idx + SENTINEL.length)) as NormalizedError,
      )
    } catch {
      // Malformed envelope — fall through to a plain unknown error.
    }
  }
  return new IpcError({ code: IpcErrorCode.Unknown, message: raw })
}
