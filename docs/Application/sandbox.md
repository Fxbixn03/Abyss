# Sandbox

> Route: `/sandbox` · Gruppe: **Development** · Komponente:
> [`SandboxPage.tsx`](../../src/features/sandbox/pages/SandboxPage.tsx)

**Zweck:** Sicherer Spielplatz, um **Commands, Hooks und Prompts auszuprobieren**,
ohne etwas in die echte Config zu schreiben. Untertitel: „Try out commands, hooks
and prompts safely — nothing is saved to your config.“

## Agenten-Verfügbarkeit
Agnostisch nutzbar.

## Was die Seite zeigt / kann
- Eingabe und Ausführung von Shell-Commands zum Testen.
- Ausprobieren von Hook-/Prompt-Verhalten ohne Persistenz.

## ⚠️ Sicherheitshinweis
Die Sandbox führt eingegebene Commands **direkt auf dem Rechner mit den Rechten
des angemeldeten Nutzers** aus. Vor dem ersten Lauf erscheint eine Bestätigung:
„Run shell commands on this machine? … Only run commands you trust, and prefer a
throwaway working directory. You won't be asked again.“ Nur vertrauenswürdige
Befehle ausführen.

## Datenquelle & Schreibziel
Führt Befehle über `core/`/Main-Prozess aus. **Schreibt nichts** in die
Agenten-Config (rein experimentell).

## Verwandte Seiten
[Hooks](./hooks.md) · [Templates](./templates.md) · [Commands](./commands.md)
