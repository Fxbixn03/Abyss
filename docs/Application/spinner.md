# Spinner

> Route: `/spinner` · Gruppe: **System** · Komponente:
> [`SpinnerPage.tsx`](../../src/features/spinner/pages/SpinnerPage.tsx)

**Zweck:** Anpassung der **Spinner-Verben und -Tipps** von Claude Code (die
animierten „Spinning-Verbs“ während der Verarbeitung).

## Agenten-Verfügbarkeit
**Nur Claude Code.** Andere Agenten: „{agent} has no spinner customization –
Custom spinner verbs and tips are specific to Claude Code. Switch to Claude to
configure them.“ Ohne Config-Ort: „No config location set“.

## Was die Seite zeigt / kann
- Eigene Spinner-Verben pflegen.
- Eigene Tipps hinterlegen.

## Datenquelle & Schreibziel
Liest/schreibt die Spinner-Konfiguration über `core/claude-settings` (Snapshot
vorher).

## Verwandte Seiten
[Status Line](./statusline.md) · [Plugins](./plugins.md)
