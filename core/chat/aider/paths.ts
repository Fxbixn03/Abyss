/**
 * Locating Aider's on-disk chat history. Aider writes every conversation to a
 * single Markdown file: `~/.aider.chat.history.md`. Each session is delimited
 * by a `#### aider chat started at …` header, making it one file with many
 * logical sessions rather than one file per session.
 */

import path from 'node:path'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to Aider's unified history Markdown file. */
export function aiderHistoryFile(env: OsEnv): string {
  return path.join(env.home, '.aider.chat.history.md')
}

/**
 * Returns a single-element array containing the history file path so the rest
 * of the chat infrastructure (usage aggregator, pagination) has a uniform list
 * interface — the entire history lives in one file.
 */
export async function listAiderSessionFiles(env: OsEnv): Promise<string[]> {
  const filePath = aiderHistoryFile(env)
  if (!(await pathExists(filePath))) return []
  return [filePath]
}
