# Dashboard

> Route: `/` (Index) · Gruppe: **Overview** · Komponente:
> [`DashboardPage.tsx`](../../src/features/dashboard/pages/DashboardPage.tsx)

**Zweck:** Landing- und Übersichtsseite. Fasst den Zustand des aktuell
ausgewählten Agenten an einem Ort zusammen – „One place to manage every AI
coding agent on your machine.“ Der Titel passt sich dem aktiven Agenten an
(„Configure Claude Code“).

## Agenten-Verfügbarkeit
Für **alle** Agenten verfügbar. Inhalt und Kennzahlen beziehen sich auf den
aktiven Agenten.

## Was die Seite zeigt / kann
- Schnellüberblick über den Agenten: Config-Status, vorhandene Komponenten und
  Nutzung (Nav-Beschreibung: „Overview, agents and usage“).
- **Refresh dashboard** – lädt die Detektion/Kennzahlen neu.
- **Reveal config directory** – öffnet das Config-Verzeichnis des Agenten im
  Datei-Explorer des Betriebssystems.
- Einstiegspunkte zu den wichtigsten Detailseiten.

## Datenquelle
Liest den erkannten Agenten-Zustand über `core/` (Detection, Config-IO) via IPC.
Schreibt selbst nichts – reine Übersicht.

## Verwandte Seiten
[Instructions](./instructions.md) · [Analytics](./analytics.md) ·
[Discover](./discover.md) · [Doctor](./doctor.md)
