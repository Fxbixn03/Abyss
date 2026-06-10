/**
 * Portable prompt-template pack — the on-disk shape for exporting/importing
 * templates between machines or sharing them with others. Pure types so they
 * are safe to import from the renderer, the Electron main process and the CLI.
 */

export interface TemplatePackItem {
  id: string
  title: string
  description: string
  tags: string[]
  content: string
  agentIds?: string[]
}

export interface TemplatePack {
  kind: 'abyss-template-pack'
  version: 1
  templates: TemplatePackItem[]
}
