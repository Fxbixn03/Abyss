/**
 * Unit tests for core/validation.ts runValidation (node:test).
 *
 * Each test creates a fresh temp directory, writes specific config files, and
 * asserts that runValidation produces exactly the right finding(s). Temp dirs
 * are cleaned up after every test.
 *
 * We use real built-in agent IDs (claude, cursor) so the readAgentConfigFile
 * helper can look them up from the registry. Capabilities and configFiles are
 * narrowed per test to keep each check isolated.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { runValidation } from '@core/validation'
import type { ValidationAgentInput } from '@core/validation'
import { claudeDefinition, cursorDefinition } from '@/shared/agents/defs'
import type { AgentDefinition } from '@/shared/types/agent'

// ── helpers ───────────────────────────────────────────────────────────────────

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

/**
 * Return a copy of a definition with all capabilities set to false, then apply
 * the provided overrides. Strips configFiles to an empty array by default so
 * checkInstructionFile is a no-op. Pass `keepConfigFiles: true` when instruction
 * file checking is the focus of the test.
 */
function withCapabilities(
  def: AgentDefinition,
  caps: Partial<AgentDefinition['capabilities']>,
  opts: { keepConfigFiles?: boolean } = {},
): AgentDefinition {
  return {
    ...def,
    configFiles: opts.keepConfigFiles ? def.configFiles : [],
    capabilities: {
      instructions: false,
      mcp: false,
      permissions: false,
      modelEnv: false,
      agents: false,
      commands: false,
      skills: false,
      hooks: false,
      rules: false,
      rawSettings: false,
      chats: false,
      statusLine: false,
      plugins: false,
      ...caps,
    },
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

test('runValidation: missing instruction file emits a warn finding', async () => {
  const base = await tmp('abyss-val-missing-')
  try {
    // Use claude definition (instruction file: CLAUDE.md) with only instructions
    // enabled. keepConfigFiles ensures checkInstructionFile actually runs.
    const def = withCapabilities(
      claudeDefinition,
      { instructions: true },
      { keepConfigFiles: true },
    )
    const input: ValidationAgentInput[] = [{ def, basePath: base }]
    const findings = await runValidation(input)

    assert.equal(findings.length, 1)
    const [f] = findings
    assert.equal(f.severity, 'warn')
    assert.equal(f.agentId, 'claude')
    assert.ok(
      f.message.includes('does not exist'),
      `expected "does not exist" in message, got: "${f.message}"`,
    )
    assert.equal(f.suggestedAction, 'create-file')
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('runValidation: empty instruction file emits a warn finding', async () => {
  const base = await tmp('abyss-val-empty-')
  try {
    // Write an empty CLAUDE.md
    await fs.writeFile(path.join(base, 'CLAUDE.md'), '', 'utf8')

    const def = withCapabilities(
      claudeDefinition,
      { instructions: true },
      { keepConfigFiles: true },
    )
    const input: ValidationAgentInput[] = [{ def, basePath: base }]
    const findings = await runValidation(input)

    assert.equal(findings.length, 1)
    const [f] = findings
    assert.equal(f.severity, 'warn')
    assert.equal(f.agentId, 'claude')
    assert.ok(
      f.message.includes('empty'),
      `expected "empty" in message, got: "${f.message}"`,
    )
    assert.equal(f.suggestedAction, 'open-raw-editor')
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('runValidation: corrupt settings.json emits an error finding', async () => {
  const base = await tmp('abyss-val-settings-')
  try {
    // Write deliberately invalid JSON to settings.json
    await fs.writeFile(
      path.join(base, 'settings.json'),
      '{ "foo": 1, oops invalid',
      'utf8',
    )

    // Claude has rawSettings: true. Strip configFiles so the instruction
    // check does not also fire (CLAUDE.md won't exist in the temp dir).
    const def = withCapabilities(claudeDefinition, { rawSettings: true })
    const input: ValidationAgentInput[] = [{ def, basePath: base }]
    const findings = await runValidation(input)

    assert.equal(findings.length, 1)
    const [f] = findings
    assert.equal(f.severity, 'error')
    assert.equal(f.agentId, 'claude')
    assert.ok(
      f.message.toLowerCase().includes('invalid json'),
      `expected "invalid json" in message, got: "${f.message}"`,
    )
    assert.equal(f.route, '/raw-settings')
    assert.equal(f.suggestedAction, 'repair-settings')
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('runValidation: corrupt MCP JSON emits an error finding', async () => {
  const base = await tmp('abyss-val-mcp-')
  try {
    // Cursor reads MCP from <base>/mcp.json — write corrupt JSON there.
    await fs.writeFile(
      path.join(base, 'mcp.json'),
      '{ "mcpServers": { broken json',
      'utf8',
    )

    // Cursor agent with only mcp enabled. Strip configFiles so the
    // instruction check does not also fire (.cursorrules won't exist).
    const def = withCapabilities(cursorDefinition, { mcp: true })
    const input: ValidationAgentInput[] = [{ def, basePath: base }]
    const findings = await runValidation(input)

    assert.equal(findings.length, 1)
    const [f] = findings
    assert.equal(f.severity, 'error')
    assert.equal(f.agentId, 'cursor')
    assert.ok(
      f.message.toLowerCase().includes('mcp config'),
      `expected "mcp config" in message, got: "${f.message}"`,
    )
    assert.equal(f.route, '/mcp')
    assert.equal(f.suggestedAction, 'open-mcp')
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('runValidation: valid config produces no findings', async () => {
  const base = await tmp('abyss-val-valid-')
  try {
    // Write a non-empty CLAUDE.md
    await fs.writeFile(
      path.join(base, 'CLAUDE.md'),
      '# My Instructions\n\nAlways be helpful.',
      'utf8',
    )

    // Only instructions enabled — file exists and is non-empty, no finding expected.
    const def = withCapabilities(
      claudeDefinition,
      { instructions: true },
      { keepConfigFiles: true },
    )
    const input: ValidationAgentInput[] = [{ def, basePath: base }]
    const findings = await runValidation(input)

    assert.equal(
      findings.length,
      0,
      `expected no findings, got: ${JSON.stringify(findings)}`,
    )
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})
