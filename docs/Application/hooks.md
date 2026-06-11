# Hooks

> Route: `/hooks` · Gruppe: **System** · Komponente:
> [`HooksPage.tsx`](../../src/features/hooks/pages/HooksPage.tsx)

**Zweck:** Verwaltung der **Lifecycle-Hooks** des aktiven Agenten – Befehle, die
zu bestimmten Ereignissen ausgeführt werden.

## Agenten-Verfügbarkeit
Agenten mit Hook-Unterstützung (Adapter-Sektion „Hooks“): u. a. **Claude,
Cursor, Gemini**. Sonst: „{agent} has no hooks – Switch to an agent that supports
lifecycle hooks.“ Ohne Config-Ort führt ein Button nach [Settings](./settings.md).

## Was die Seite zeigt / kann
- Hooks nach Lifecycle-Ereignis gruppiert, mit Anlegen/Bearbeiten/Löschen.
- **Copy to** – einen Hook per Dropdown zu einem anderen Agenten kopieren.
- Test-/Hilfs-Aktionen je Hook.

## Datenquelle & Schreibziel
Liest/schreibt die Hook-Konfiguration des Agenten über `core/` (Snapshot vorher).

## Verwandte Seiten
[Permissions](./permissions.md) · [Sandbox](./sandbox.md) (Hooks testen) ·
[Doctor](./doctor.md)
