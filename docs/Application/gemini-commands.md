# Gemini Commands (Variante von /commands)

> Route: `/commands`, aber **nur wenn der aktive Agent `gemini` ist** · Gruppe:
> **Development** · Komponente:
> [`GeminiCommandsPage.tsx`](../../src/features/gemini-commands/pages/GeminiCommandsPage.tsx)

**Zweck:** Dedizierter Editor für **Gemini-CLI-Slash-Commands**. Untertitel:
„Custom slash commands for Gemini CLI“. Gemini-Commands sind **gruppierte
TOML-Dateien** mit eigener Struktur – daher ein Spezialeditor statt der
Markdown-Collection.

## Wann erscheint diese Seite?
[`CommandsPage`](./commands.md) rendert diese Seite, falls
`agentId === 'gemini'`. Für andere Agenten kommt der generische
CollectionManager.

## Agenten-Verfügbarkeit
Ausschließlich **Gemini CLI**. Ohne Config-Verzeichnis: „No config location set –
Set a Gemini config directory in Settings to manage commands.“

## Was die Seite zeigt / kann
- Anlegen, Bearbeiten und Löschen von Gemini-Commands im (gruppierten) TOML-Format.
- Editor passend zur Gemini-Command-Struktur.

## Datenquelle & Schreibziel
Gemini-Command-TOML-Dateien im Gemini-Config-Verzeichnis über `core/`.

## Verwandte Seiten
[Commands](./commands.md) · [Codex Subagents](./codex-subagents.md) (analoge
TOML-Sondervariante)
