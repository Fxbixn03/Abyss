/**
 * OpenAI Codex authentication lifecycle. Same model as Claude: Abyss drives the
 * CLI's own `codex login` / `codex logout` (native OAuth via the system browser)
 * and reads the CLI's `~/.codex/auth.json` to report status. Stores no tokens.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { readJsonFile } from '../../json-file'
import { findExecutable, runCommand } from '../cli'
import { codexAuthFile } from './paths'

interface CodexAuth {
  OPENAI_API_KEY?: string
  tokens?: { access_token?: string; refresh_token?: string }
}

let cachedBinary: string | null | undefined

export async function findCodexBinary(): Promise<string | null> {
  if (cachedBinary === undefined) cachedBinary = await findExecutable('codex')
  return cachedBinary
}

export async function codexAvailability(env: OsEnv): Promise<ChatAvailability> {
  const binary = await findCodexBinary()
  if (!binary) {
    return {
      installed: false,
      authenticated: false,
      reason: 'The `codex` CLI was not found on your PATH.',
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return { installed: true, authenticated: true, account: 'API key' }
  }
  const auth = await readJsonFile<CodexAuth>(codexAuthFile(env), {})
  const authenticated = Boolean(
    auth.OPENAI_API_KEY ||
    auth.tokens?.access_token ||
    auth.tokens?.refresh_token,
  )
  return {
    installed: true,
    authenticated,
    account: authenticated ? 'Codex' : undefined,
    reason: authenticated ? undefined : 'You are not signed in to Codex.',
  }
}

export async function codexLogin(
  env: OsEnv,
  apiKey?: string,
): Promise<ChatAvailability> {
  const binary = await findCodexBinary()
  if (!binary) return codexAvailability(env)
  if (apiKey && apiKey.trim() !== '') {
    return { installed: true, authenticated: true, account: 'API key' }
  }
  await runCommand(binary, ['login'], { cwd: env.home })
  return codexAvailability(env)
}

export async function codexLogout(env: OsEnv): Promise<void> {
  const binary = await findCodexBinary()
  if (!binary) return
  await runCommand(binary, ['logout'], { cwd: env.home })
}
