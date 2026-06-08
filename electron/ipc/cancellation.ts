/**
 * Cancellation registry for long-running IPC operations (discovery searches,
 * MCP health checks). The renderer tags a cancelable call with a `requestId`;
 * the main process registers an AbortController under that id and hands its
 * signal to the worker. A later CancelRequest aborts the matching controller,
 * killing the orphaned fetch/spawn instead of letting it run to completion.
 */

const inflight = new Map<string, AbortController>()

/** Register an abortable request. Returns its controller, or `undefined` when
 * no id was supplied (the caller didn't opt into cancellation). */
export function beginRequest(id?: string): AbortController | undefined {
  if (!id) return undefined
  // A reused id means a stale request is still mapped — abort it first.
  inflight.get(id)?.abort()
  const controller = new AbortController()
  inflight.set(id, controller)
  return controller
}

/** Stop tracking a request once it has settled. */
export function endRequest(id?: string): void {
  if (id) inflight.delete(id)
}

/** Abort an in-flight request by id. Returns whether one was found. */
export function cancelRequest(id: string): boolean {
  const controller = inflight.get(id)
  if (!controller) return false
  controller.abort()
  inflight.delete(id)
  return true
}
