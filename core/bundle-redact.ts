/**
 * Strip secrets out of an export bundle before it leaves the machine. Node-free
 * (pure data), shared by the Electron export handlers and the `abyss` CLI.
 *
 * The concrete leak vector is `mcpServers[].env`: MCP servers are routinely
 * configured with API tokens there (`GITHUB_TOKEN`, `BRAVE_API_KEY`, …). A bundle
 * is meant to be shared / committed / carried to another machine, so we replace
 * the value of any secret-looking env key with a visible placeholder. The
 * recipient sees which variables to set without ever receiving the secret.
 *
 * Locally-stored profiles are intentionally NOT redacted — they need the real
 * values to re-apply — so redaction lives at the export boundary, not in
 * `exportBundle` itself.
 */

import type { ExportBundle } from '@/shared/types/bundle'

/** What a redacted secret is replaced with — recognizable + obviously not real. */
export const REDACTED_PLACEHOLDER = '***REDACTED***'

/**
 * Env keys whose value we treat as a secret. Deliberately broad: over-redacting
 * a non-secret in a *shared* export is harmless (the recipient re-enters it),
 * while leaking a token is not.
 */
const SECRET_KEY = /TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|KEY|AUTH/i

export function isSecretEnvKey(key: string): boolean {
  return SECRET_KEY.test(key)
}

export interface RedactionResult {
  bundle: ExportBundle
  /** How many env values were replaced (0 = nothing sensitive found). */
  redactedCount: number
}

/**
 * Return a copy of `bundle` with secret-looking MCP env values replaced by
 * {@link REDACTED_PLACEHOLDER}. Empty values are left as-is.
 */
export function redactBundleSecrets(bundle: ExportBundle): RedactionResult {
  let redactedCount = 0

  const agents = bundle.agents.map((agent) => {
    if (!agent.mcpServers) return agent
    const mcpServers = agent.mcpServers.map((server) => {
      if (!server.env) return server
      const env: Record<string, string> = {}
      for (const [key, value] of Object.entries(server.env)) {
        if (value !== '' && isSecretEnvKey(key)) {
          env[key] = REDACTED_PLACEHOLDER
          redactedCount++
        } else {
          env[key] = value
        }
      }
      return { ...server, env }
    })
    return { ...agent, mcpServers }
  })

  return { bundle: { ...bundle, agents }, redactedCount }
}
