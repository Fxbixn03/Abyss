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

/** A config write was denied by the OS (EACCES or EPERM). */
export class ConfigWriteError extends Error {
  readonly code = IpcErrorCode.WritePermission
  readonly filePath: string

  constructor(filePath: string, cause?: unknown) {
    super(`Permission denied writing ${filePath}`, { cause })
    this.name = 'ConfigWriteError'
    this.filePath = filePath
  }
}

/** A config read was denied by the OS (EACCES or EPERM). */
export class ConfigReadError extends Error {
  readonly code = IpcErrorCode.ReadPermission
  readonly filePath: string

  constructor(filePath: string, cause?: unknown) {
    super(`Permission denied reading ${filePath}`, { cause })
    this.name = 'ConfigReadError'
    this.filePath = filePath
  }
}

/** A config write failed because the disk is full (ENOSPC) or a cross-device rename was attempted (EXDEV). */
export class ConfigDiskError extends Error {
  readonly code = IpcErrorCode.DiskFull
  readonly filePath: string

  constructor(filePath: string, cause?: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    super(`Disk write failed for ${filePath}: ${reason}`, { cause })
    this.name = 'ConfigDiskError'
    this.filePath = filePath
  }
}
