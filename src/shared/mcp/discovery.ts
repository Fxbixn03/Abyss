/**
 * MCP-specific discovery payload + conversion to an editable {@link McpServerEntry}.
 * Pure (no Node): shared by the core provider (which produces the spec) and the
 * renderer (which turns a chosen result into a prefilled form entry).
 */

import type { McpServerEntry } from '@/shared/types/config'
import { genId } from '@/shared/lib/id'

/** Install data carried in a discovered MCP server's `DiscoveryResult.payload`. */
export interface McpInstallSpec {
  transport: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  url?: string
  /** Environment variables the server expects; `default` prefills the value. */
  env: { name: string; default?: string }[]
}

/** Make `name` unique against the servers already configured. */
function uniqueName(name: string, existingNames: string[]): string {
  let candidate = name
  let i = 1
  while (existingNames.includes(candidate)) candidate = `${name}-${++i}`
  return candidate
}

/** Turn a discovered MCP install spec into a fresh, editable server entry. */
export function installSpecToEntry(
  spec: McpInstallSpec,
  name: string,
  existingNames: string[],
): McpServerEntry {
  return {
    id: genId(),
    name: uniqueName(name, existingNames),
    type: spec.transport,
    command: spec.command,
    args: spec.args,
    url: spec.url,
    env: Object.fromEntries(spec.env.map((e) => [e.name, e.default ?? ''])),
    enabled: true,
  }
}
