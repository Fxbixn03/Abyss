# Codex Subagents (Variante von /agents)

> Route: `/agents`, aber **nur wenn der aktive Agent `codex` ist** · Gruppe:
> **Development** · Komponente:
> [`CodexSubagentsPage.tsx`](../../src/features/subagents/pages/CodexSubagentsPage.tsx)

**Zweck:** Dedizierter Editor für **OpenAI-Codex-Subagenten**. Untertitel:
„Custom subagents for OpenAI Codex“. Codex speichert Subagenten als **TOML** mit
eigener Struktur – deshalb ein Spezialeditor statt der Markdown-Collection.

## Wann erscheint diese Seite?
[`AgentsPage`](./agents.md) prüft den aktiven Agenten und rendert diese Seite,
falls `agentId === 'codex'`. Für andere Agenten kommt der generische
CollectionManager.

## Agenten-Verfügbarkeit
Ausschließlich **OpenAI Codex**. Ohne gesetztes Config-Verzeichnis: „No config
location set – Set a Codex config directory in Settings to manage subagents.“

## Was die Seite zeigt / kann
- Anlegen, Bearbeiten und Löschen von Codex-Subagenten im TOML-Format.
- Editor passend zur Codex-Subagent-Struktur (keine freie Markdown-Datei).

## Datenquelle & Schreibziel
Codex-Subagent-TOML-Dateien im Codex-Config-Verzeichnis über `core/`.

## Verwandte Seiten
[Agents](./agents.md) · [Gemini Commands](./gemini-commands.md) (analoge
TOML-Sondervariante)
