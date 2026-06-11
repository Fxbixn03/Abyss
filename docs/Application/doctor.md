# Doctor

> Route: `/doctor` · Gruppe: **System** · Komponente:
> [`DoctorPage.tsx`](../../src/features/doctor/pages/DoctorPage.tsx)

**Zweck:** **Ein-Klick-Health-Check über alle aktivierten Agenten** mit Auto-Fix.
Untertitel: „One-click health check across every enabled agent.“

## Agenten-Verfügbarkeit
Agnostisch – prüft **alle** aktivierten Agenten gemeinsam.

## Was die Seite zeigt / kann
- Sammelt Probleme bei **MCP-Servern, Hooks und Permissions**.
- Bei sauberem Zustand: „Everything looks healthy – No problems found in your
  agents' MCP servers, hooks or permissions.“
- **Auto-Fix** für behebbare Befunde.

## Datenquelle & Schreibziel
Liest die Config aller Agenten über `core/`; Auto-Fixes schreiben gezielt zurück
(Snapshot vorher).

## Abgrenzung
- [Validation](./validation.md): tiefer Lint für **einen** Agenten.
- **Doctor:** breiter Gesundheits-Check über **alle** Agenten.

## Verwandte Seiten
[Validation](./validation.md) · [MCP](./mcp.md) · [Hooks](./hooks.md) ·
[Permissions](./permissions.md)
