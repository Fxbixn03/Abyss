# Abyss – Seiten-Dokumentation

Diese Doku beschreibt **jede einzelne Seite** der Abyss-Desktop-App. Jede Seite
entspricht einer Route im Hash-Router ([`src/app/router.tsx`](../../src/app/router.tsx))
und einer Feature-Komponente unter `src/features/<feature>/pages/`.

## Grundkonzepte

- **Aktiver Agent:** Fast jede Seite arbeitet auf dem **aktuell ausgewählten
  Agenten** (oben im Top-Bar umschaltbar). Unterstützt ein Agent eine Funktion
  nicht, zeigt die Seite einen Leerzustand („… has no …“) statt eines Fehlers.
- **Sidebar-Gruppen:** Die Navigation ist in fünf Gruppen plus *Settings*
  gebucketet (siehe [`src/app/navigation.ts`](../../src/app/navigation.ts)):
  `Overview · Development · Runtime · System · Tools`.
- **Agenten-spezifische Sektionen:** Welche der „System/Development“-Seiten ein
  Agent in der Sidebar zeigt, bestimmt sein Adapter
  (`src/features/agents/adapters/*.adapter.ts`). Beispiel: *Status Line*,
  *Spinner* und *Plugins* erscheinen nur bei Claude Code.
- **Schreiben auf echte Dateien:** Abyss liest/schreibt die echten Config-Dateien
  der Agenten über `core/` (Node) via getyptem IPC. Vor jedem Überschreiben wird
  automatisch ein Snapshot angelegt (siehe [History](./history.md)).

## Aktive Agenten

`claude` · `codex` · `gemini` · `cursor` · `copilot` · `windsurf` · `continue` ·
`aider` · `cline` (Quelle: `ACTIVE_AGENT_IDS` in `src/shared/agents/defs.ts`).
Zusätzlich sind eigene (custom) Agenten möglich.

## Seitenübersicht

### Overview
| Seite | Route | Doku |
| ----- | ----- | ---- |
| Dashboard | `/` | [dashboard.md](./dashboard.md) |
| Relations | `/relations` | [relations.md](./relations.md) |

### Development
| Seite | Route | Doku |
| ----- | ----- | ---- |
| Instructions | `/config` | [instructions.md](./instructions.md) |
| Agents / Subagents | `/agents` | [agents.md](./agents.md) |
| ↳ Codex Subagents | `/agents` (Codex) | [codex-subagents.md](./codex-subagents.md) |
| Commands | `/commands` | [commands.md](./commands.md) |
| ↳ Gemini Commands | `/commands` (Gemini) | [gemini-commands.md](./gemini-commands.md) |
| Skills | `/skills` | [skills.md](./skills.md) |
| Rules | `/rules` | [rules.md](./rules.md) |
| Templates | `/templates` | [templates.md](./templates.md) |
| Sandbox | `/sandbox` | [sandbox.md](./sandbox.md) |

### Runtime
| Seite | Route | Doku |
| ----- | ----- | ---- |
| Chats | `/chats` | [chats.md](./chats.md) |
| Sessions | `/sessions` | [sessions.md](./sessions.md) |
| Insights | `/insights` | [insights.md](./insights.md) |
| Context | `/context` | [context.md](./context.md) |
| Analytics | `/usage` | [analytics.md](./analytics.md) |
| History | `/history` | [history.md](./history.md) |
| Activity | `/activity` | [activity.md](./activity.md) |

### System
| Seite | Route | Doku |
| ----- | ----- | ---- |
| Validation | `/validation` | [validation.md](./validation.md) |
| Doctor | `/doctor` | [doctor.md](./doctor.md) |
| MCP Servers | `/mcp` | [mcp.md](./mcp.md) |
| Hooks | `/hooks` | [hooks.md](./hooks.md) |
| Permissions / Approvals | `/permissions` | [permissions.md](./permissions.md) |
| Model & Env | `/model-env` | [model-env.md](./model-env.md) |
| Status Line | `/statusline` | [statusline.md](./statusline.md) |
| Spinner | `/spinner` | [spinner.md](./spinner.md) |
| Plugins | `/plugins` | [plugins.md](./plugins.md) |
| Settings (raw) | `/settings-file` | [settings-file.md](./settings-file.md) |

### Tools
| Seite | Route | Doku |
| ----- | ----- | ---- |
| Bundles | `/bundles` | [bundles.md](./bundles.md) |
| Compare & Sync | `/compare` | [compare.md](./compare.md) |
| Discover | `/discover` | [discover.md](./discover.md) |
| Marketplace | `/marketplace` | [marketplace.md](./marketplace.md) |
| Profiles | `/profiles` | [profiles.md](./profiles.md) |

### Settings (unten angepinnt)
| Seite | Route | Doku |
| ----- | ----- | ---- |
| Settings | `/settings` | [settings.md](./settings.md) |
