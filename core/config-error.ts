/**
 * Typed config-IO errors. Node-only (thrown from `core/`), but the `code` and
 * `filePath` fields are picked up by the IPC error normalizer so the renderer
 * can decode them back into a typed `IpcError` and offer the raw-text repair
 * flow instead of crashing. Codes are shared with the renderer via
 * {@link IpcErrorCode}.
 */

import { IpcErrorCode } from '@/shared/ipc/ipc-error'

/** A config file on disk could not be parsed (corrupt JSON/TOML). */
export class ConfigParseError extends Error {
  readonly code = IpcErrorCode.ConfigParse
  readonly filePath: string

  constructor(filePath: string, cause?: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    super(`Failed to parse ${filePath}: ${reason}`, { cause })
    this.name = 'ConfigParseError'
    this.filePath = filePath
  }
}

/** A config file parsed but failed schema validation. */
export class ConfigValidationError extends Error {
  readonly code = IpcErrorCode.ConfigInvalid
  readonly filePath: string

  constructor(filePath: string, message: string, cause?: unknown) {
    super(`Invalid config in ${filePath}: ${message}`, { cause })
    this.name = 'ConfigValidationError'
    this.filePath = filePath
  }
}
