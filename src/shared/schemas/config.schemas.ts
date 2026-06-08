/**
 * Runtime (zod) schemas mirroring the config payload types in
 * `shared/types/config.ts`. They give us one validation layer reused three ways:
 *
 *   - the config-IO boundary in `core/` (replacing unchecked `as T` casts),
 *   - inline form validation in the renderer (e.g. the MCP server dialog),
 *   - the Validation page lint.
 *
 * Pure module (no Node, no React) so every layer can import it.
 */

import { z } from 'zod'

export const mcpServerSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, 'Name is required'),
    type: z.enum(['stdio', 'http', 'sse']),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'stdio') {
      if (!value.command?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['command'],
          message: 'Command is required for stdio servers',
        })
      }
    } else if (!value.url?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'URL is required for http/sse servers',
      })
    } else {
      try {
        new URL(value.url)
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['url'],
          message: 'Enter a valid URL (e.g. https://example.com/mcp)',
        })
      }
    }
  })

export const permissionRulesSchema = z.object({
  allow: z.array(z.string()),
  deny: z.array(z.string()),
  ask: z.array(z.string()),
})

export const modelEnvSchema = z.object({
  model: z.string().optional(),
  env: z.record(z.string(), z.string()),
})

/**
 * Lenient app-settings schema: each field falls back to `undefined` when it has
 * the wrong shape (and the whole thing to `{}` when it isn't even an object), so
 * a partly-corrupt settings file degrades to defaults instead of crashing the
 * app. The store layers these over {@link DEFAULT_APP_SETTINGS}.
 */
export const appSettingsSchema = z
  .object({
    agentPaths: z
      .record(z.string(), z.string())
      .optional()
      .catch(undefined),
    startupAgentId: z.string().optional().catch(undefined),
    defaultProjectDir: z.string().optional().catch(undefined),
    confirmDiffBeforeSave: z.boolean().optional().catch(undefined),
    launchOnStartup: z.boolean().optional().catch(undefined),
    onboarded: z.boolean().optional().catch(undefined),
    tutorialDone: z.boolean().optional().catch(undefined),
    billingMode: z.enum(['subscription', 'api']).optional().catch(undefined),
    showCosts: z.boolean().optional().catch(undefined),
    currency: z.enum(['usd', 'eur']).optional().catch(undefined),
    weeklyTokenBudget: z.number().optional().catch(undefined),
    sessionTokenBudget: z.number().optional().catch(undefined),
    autoBackup: z.boolean().optional().catch(undefined),
    backupDir: z.string().optional().catch(undefined),
    backupKeep: z.number().optional().catch(undefined),
    sandboxAcknowledged: z.boolean().optional().catch(undefined),
  })
  .catch({})

export type StoredAppSettings = z.infer<typeof appSettingsSchema>

/** Collapse a zod error into a `{ fieldPath: message }` map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!out[key]) out[key] = issue.message
  }
  return out
}
