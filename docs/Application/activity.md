# Activity

> Route: `/activity` · Gruppe: **Runtime** · Komponente:
> [`ActivityPage.tsx`](../../src/features/activity/pages/ActivityPage.tsx)

**Zweck:** Chronologisches **Änderungsprotokoll** – jede Datei, die Abyss
geändert hat, neueste zuerst, mit **Ein-Klick-Undo**. Untertitel: „Every file
Abyss changed — newest first, with one-click undo.“

## Agenten-Verfügbarkeit
Agnostisch – protokolliert Änderungen über alle Agenten hinweg. Ohne Daten:
„No activity yet – Abyss logs every config file it overwrites here, so you can
review and undo any change it made.“

## Was die Seite zeigt / kann
- Zeitleiste aller von Abyss überschriebenen Config-Dateien.
- **Undo** je Eintrag, um eine konkrete Änderung zurückzunehmen.

## Datenquelle & Schreibziel
Basiert auf dem Änderungs-/Snapshot-Log aus `core/`. Undo schreibt den
vorherigen Stand zurück.

## Abgrenzung
- [History](./history.md): rohe Snapshots pro Datei zum Wiederherstellen.
- **Activity:** kuratiertes „Was hat Abyss getan“ mit direktem Undo.

## Verwandte Seiten
[History](./history.md) · [Doctor](./doctor.md)
