# Bundles

> Route: `/bundles` · Gruppe: **Tools** · Komponente:
> [`BundlesPage.tsx`](../../src/features/bundles/pages/BundlesPage.tsx)

**Zweck:** Config **exportieren und auf einem anderen Rechner anwenden**.
Untertitel: „Export your config and apply it on another machine.“

## Agenten-Verfügbarkeit
Agnostisch – ein Bundle kann mehrere Agenten umfassen.

## Was die Seite zeigt / kann
- **Export:** ausgewählte Agenten/Bereiche in ein portables Bundle packen.
- **Apply:** ein Bundle einspielen. Vor dem Überschreiben Bestätigung: „Apply
  this bundle? This overwrites the selected agents' real config files. A snapshot
  of each file is taken first (see History), so changes can be undone.“

## Datenquelle & Schreibziel
Nutzt `core/bundle` (export/apply). Apply schreibt die echten Config-Dateien der
gewählten Agenten; je Datei wird zuvor ein Snapshot angelegt.

## Abgrenzung
- **Bundles:** portables Paket zum Mitnehmen/Teilen zwischen Maschinen.
- [Profiles](./profiles.md): benannte Config-Sets **auf derselben Maschine** zum
  Umschalten.

## Verwandte Seiten
[Profiles](./profiles.md) · [Compare](./compare.md) · [History](./history.md)
