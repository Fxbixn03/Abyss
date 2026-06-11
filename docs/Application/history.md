# History (Snapshots)

> Route: `/history` · Gruppe: **Runtime** · Sidebar-Label: „History“ ·
> Komponente: [`SnapshotsPage.tsx`](../../src/features/snapshots/pages/SnapshotsPage.tsx)

**Zweck:** Übersicht der **automatischen Snapshots**, die Abyss **vor jedem
Config-Speichern** anlegt – und Wiederherstellung. Untertitel: „Automatic
snapshots taken before every config save.“

## Agenten-Verfügbarkeit
Agnostisch – sammelt Snapshots aller Agenten. Ohne Daten: „No snapshots yet –
Abyss saves a snapshot automatically each time it overwrites a config file.“

## Was die Seite zeigt / kann
- Chronologische Liste aller Snapshots (welche Datei, wann).
- **Wiederherstellen** einer früheren Dateiversion.

## Datenquelle & Schreibziel
Snapshots werden von `core/` beim Überschreiben automatisch erzeugt; das
Wiederherstellen schreibt die alte Version zurück (erzeugt seinerseits einen
neuen Snapshot).

## Verwandte Seiten
[Activity](./activity.md) (was geändert wurde, mit Undo) ·
[Bundles](./bundles.md) · [Instructions](./instructions.md)
