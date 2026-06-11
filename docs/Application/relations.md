# Relations

> Route: `/relations` · Gruppe: **Overview** · Komponente:
> [`RelationsPage.tsx`](../../src/features/relations/pages/RelationsPage.tsx)

**Zweck:** Visualisiert, wie die Bausteine eines Agenten zusammenhängen –
„Visualize how components connect“. Macht sichtbar, welche Instructions, MCP-
Server, Hooks, Commands, Skills usw. miteinander in Beziehung stehen.

## Agenten-Verfügbarkeit
Für alle Agenten, **sofern ein Config-Verzeichnis gesetzt ist**. Ohne Pfad
erscheint der Leerzustand „No config location set – Set a config directory in
Settings to map this agent's components.“

## Was die Seite zeigt / kann
- Map/Graph der Komponenten des aktiven Agenten und ihrer Verbindungen.
- Hilft, Lücken und Abhängigkeiten zwischen Konfigurationsteilen zu erkennen.

## Datenquelle
Aggregiert die erkannten Komponenten des Agenten über `core/` via IPC. Nur
lesend.

## Verwandte Seiten
[Context](./context.md) · [Validation](./validation.md) ·
[Settings](./settings.md)
