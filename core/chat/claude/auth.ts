/**
 * Claude Code authentication lifecycle. Abyss never stores tokens itself — it
 * drives the CLI's own `claude auth` commands and reads the CLI's credential
 * store (`~/.claude/.credentials.json`) to report status. Subscription login
 * uses native OAuth via the system browser (the CLI opens it).
 */

import path from 'node:path'
import type { OsEnv } from '@/shared/types/agent'
import type { ChatAvailability } from '@/shared/types/chat'
import { readJsonFile } from '../../json-file'
import { findExecutable, runCommand } from '../cli'

interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    subscriptionType?: string
  }
}

function credentialsPath(env: OsEnv): string {
  return path.join(env.home, '.claude', '.credentials.json')
}

let cachedBinary: string | null | undefined

export async function findClaudeBinary(): Promise<string | null> {
  if (cachedBinary === undefined) cachedBinary = await findExecutable('claude')
  return cachedBinary
}

export async function claudeAvailability(
  env: OsEnv,
): Promise<ChatAvailability> {
  const binary = await findClaudeBinary()
  if (!binary) {
    return {
      installed: false,
      authenticated: false,
      reason: 'The `claude` CLI was not found on your PATH.',
    }
  }

  // An explicit API key always works (it is used as env at run time).
  if (process.env.ANTHROPIC_API_KEY) {
    return { installed: true, authenticated: true, account: 'API key' }
  }

  const creds = await readJsonFile<ClaudeCredentials>(credentialsPath(env), {})
  const oauth = creds.claudeAiOauth
  // A refresh token means the CLI can re-mint access even once expired.
  const authenticated = Boolean(oauth?.accessToken || oauth?.refreshToken)
  return {
    installed: true,
    authenticated,
    account: authenticated
      ? oauth?.subscriptionType
        ? `Claude ${oauth.subscriptionType}`
        : 'Subscription'
      : undefined,
    reason: authenticated ? undefined : 'You are not signed in to Claude.',
  }
}

/** Run `claude auth login` (opens the system browser). API key short-circuits. */
export async function claudeLogin(
  env: OsEnv,
  apiKey?: string,
): Promise<ChatAvailability> {
  const binary = await findClaudeBinary()
  if (!binary) return claudeAvailability(env)

  if (apiKey && apiKey.trim() !== '') {
    // The key is supplied per-run via env; nothing to persist here.
    return { installed: true, authenticated: true, account: 'API key' }
  }

  await runCommand(binary, ['auth', 'login'], { cwd: env.home })
  return claudeAvailability(env)
}

export async function claudeLogout(env: OsEnv): Promise<void> {
  const binary = await findClaudeBinary()
  if (!binary) return
  await runCommand(binary, ['auth', 'logout'], { cwd: env.home })
}
