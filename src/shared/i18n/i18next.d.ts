import 'i18next'
import type activity from './locales/en/activity.json'
import type bundles from './locales/en/bundles.json'
import type chats from './locales/en/chats.json'
import type common from './locales/en/common.json'
import type compare from './locales/en/compare.json'
import type config from './locales/en/config.json'
import type context from './locales/en/context.json'
import type dashboard from './locales/en/dashboard.json'
import type discovery from './locales/en/discovery.json'
import type doctor from './locales/en/doctor.json'
import type geminiCommands from './locales/en/geminiCommands.json'
import type hooks from './locales/en/hooks.json'
import type insights from './locales/en/insights.json'
import type marketplace from './locales/en/marketplace.json'
import type mcp from './locales/en/mcp.json'
import type modelEnv from './locales/en/modelEnv.json'
import type permissions from './locales/en/permissions.json'
import type plugins from './locales/en/plugins.json'
import type profiles from './locales/en/profiles.json'
import type relations from './locales/en/relations.json'
import type ruleActivation from './locales/en/ruleActivation.json'
import type sandbox from './locales/en/sandbox.json'
import type sessions from './locales/en/sessions.json'
import type settings from './locales/en/settings.json'
import type settingsFile from './locales/en/settingsFile.json'
import type snapshots from './locales/en/snapshots.json'
import type subagents from './locales/en/subagents.json'
import type templates from './locales/en/templates.json'
import type usage from './locales/en/usage.json'
import type validation from './locales/en/validation.json'
import type workspace from './locales/en/workspace.json'

/**
 * Teaches i18next about our namespaces so `t(…)` keys are checked at compile
 * time (the .resx-generated-accessor equivalent). English is the source of
 * truth for the key shape; other languages fall back to it. Generated from the
 * en locale folder — add a namespace JSON there, then mirror the import +
 * resource line here.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      activity: typeof activity
      bundles: typeof bundles
      chats: typeof chats
      common: typeof common
      compare: typeof compare
      config: typeof config
      context: typeof context
      dashboard: typeof dashboard
      discovery: typeof discovery
      doctor: typeof doctor
      geminiCommands: typeof geminiCommands
      hooks: typeof hooks
      insights: typeof insights
      marketplace: typeof marketplace
      mcp: typeof mcp
      modelEnv: typeof modelEnv
      permissions: typeof permissions
      plugins: typeof plugins
      profiles: typeof profiles
      relations: typeof relations
      ruleActivation: typeof ruleActivation
      sandbox: typeof sandbox
      sessions: typeof sessions
      settings: typeof settings
      settingsFile: typeof settingsFile
      snapshots: typeof snapshots
      subagents: typeof subagents
      templates: typeof templates
      usage: typeof usage
      validation: typeof validation
      workspace: typeof workspace
    }
    returnNull: false
  }
}
