/**
 * Sandbox command execution result. The sandbox lets users try a hook or
 * command's shell snippet in a throwaway run and see exactly what it produces,
 * without wiring it into an agent first.
 */
export interface SandboxRunResult {
  stdout: string
  stderr: string
  /** Process exit code, or null when killed by signal/timeout. */
  exitCode: number | null
  durationMs: number
  timedOut: boolean
}
