# Validation

> Route: `/validation` · Gruppe: **System** · Komponente:
> [`ValidationPage.tsx`](../../src/features/validation/pages/ValidationPage.tsx)

**Zweck:** **Linter** für die Agenten-Config. Untertitel: „Lint {agent}'s config
for risks and rot.“ Findet Risiken und „Konfig-Fäulnis“ (veraltete/kaputte
Einträge).

## Agenten-Verfügbarkeit
Für den jeweils aktiven Agenten.

## Was die Seite zeigt / kann
- Liste der Befunde mit Schweregrad; bei sauberer Config: „All clear“.
- **Re-Lint/Refresh** über einen Header-Button.
- Pro Befund: **Reveal in folder** (Datei im Explorer öffnen) und weitere
  Aktions-Buttons (z. B. zum Beheben/Springen).

## Datenquelle
Analysiert die Config-Dateien des Agenten über `core/`. Lesend; Fix-Aktionen
können gezielt schreiben.

## Abgrenzung
- **Validation:** statische Lint-Befunde für **einen** Agenten.
- [Doctor](./doctor.md): Health-Check **über alle** Agenten mit Auto-Fix.

## Verwandte Seiten
[Doctor](./doctor.md) · [Context](./context.md) · [Relations](./relations.md)
