import { BUILTIN_TEMPLATES } from '../presets'
import type { PromptTemplate } from '../types'

/**
 * The effective template list shown everywhere: custom templates first, then the
 * built-ins minus the ones the user hid, with their edits applied. Pure so the
 * page and the command palette stay in sync.
 */
export function resolveTemplates(args: {
  customTemplates: PromptTemplate[]
  builtinOverrides: Record<string, PromptTemplate>
  hiddenBuiltins: string[]
}): PromptTemplate[] {
  const { customTemplates, builtinOverrides, hiddenBuiltins } = args
  return [
    ...customTemplates,
    ...BUILTIN_TEMPLATES.filter((t) => !hiddenBuiltins.includes(t.id)).map(
      (t) => builtinOverrides[t.id] ?? t,
    ),
  ]
}
