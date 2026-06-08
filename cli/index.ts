#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import { Command } from 'commander'
import { resolveOsEnv } from '@core/os-env'
import { detectAllAgentPaths } from '@core/agent-paths'
import { applyBundle, exportBundle } from '@core/bundle'
import { redactBundleSecrets } from '@core/bundle-redact'
import type { ExportBundle } from '@core/bundle'
import { getActiveAgentDefinitions } from '@/shared/agents/defs'

const program = new Command()

program
  .name('abyss')
  .description('Abyss CLI — manage AI coding agent config from the terminal.')
  .version('1.0.0')

program
  .command('detect')
  .description('Show auto-detected config locations for each agent.')
  .action(async () => {
    const env = resolveOsEnv()
    const detected = await detectAllAgentPaths(env)
    for (const def of getActiveAgentDefinitions()) {
      console.log(`\n${def.displayName} (${def.id})`)
      for (const candidate of detected[def.id] ?? []) {
        console.log(`  ${candidate.exists ? '✓' : '·'} ${candidate.path}`)
      }
    }
  })

program
  .command('export')
  .description('Export agent config into a portable bundle.')
  .option('-a, --agent <id...>', 'limit to specific agent ids')
  .option('-o, --out <file>', 'write to a file instead of stdout')
  .option(
    '--include-secrets',
    'keep real MCP env tokens in the bundle (redacted by default)',
  )
  .action(
    async (opts: {
      agent?: string[]
      out?: string
      includeSecrets?: boolean
    }) => {
      const env = resolveOsEnv()
      const raw = await exportBundle(env, { agentIds: opts.agent })
      const { bundle, redactedCount } = opts.includeSecrets
        ? { bundle: raw, redactedCount: 0 }
        : redactBundleSecrets(raw)
      const json = JSON.stringify(bundle, null, 2)
      if (opts.out) {
        await fs.writeFile(opts.out, `${json}\n`, 'utf8')
        console.log(`Exported ${bundle.agents.length} agent(s) to ${opts.out}`)
        if (redactedCount > 0) {
          console.log(
            `Redacted ${redactedCount} secret(s) — use --include-secrets to keep them.`,
          )
        }
      } else {
        console.log(json)
      }
    },
  )

program
  .command('apply')
  .description('Apply a config bundle to disk.')
  .argument('<file>', 'bundle JSON file produced by `abyss export`')
  .option('--dry-run', 'show what would change without writing')
  .action(async (file: string, opts: { dryRun?: boolean }) => {
    const raw = await fs.readFile(file, 'utf8')
    const bundle = JSON.parse(raw) as ExportBundle
    const changes = await applyBundle(bundle, { dryRun: opts.dryRun })
    const changed = changes.filter((c) => c.changed)

    if (changed.length === 0) {
      console.log('Everything is already up to date.')
      return
    }

    console.log(opts.dryRun ? 'Planned changes:' : 'Applied changes:')
    for (const change of changed) {
      console.log(`  ~ [${change.agentId}/${change.kind}] ${change.target}`)
    }
    if (opts.dryRun) {
      console.log(
        `\n${changed.length} target(s) would change. Re-run without --dry-run to apply.`,
      )
    }
  })

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
