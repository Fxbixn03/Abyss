# Permissions / Approvals

> Route: `/permissions` · Gruppe: **System** · Komponente:
> [`PermissionsPage.tsx`](../../src/features/permissions/pages/PermissionsPage.tsx)

**Zweck:** Verwaltung der **Tool-Berechtigungen** des aktiven Agenten – welche
Tools/Befehle erlaubt bzw. verweigert sind.

## Agenten-Verfügbarkeit
Agenten, die Permissions exponieren. **Claude** zeigt die Sektion als
„Permissions“, **Codex** als „Approvals“. Sonst: „{agent} has no permission rules
– Switch to an agent that exposes tool permissions to edit them here.“ Ohne
Config-Ort: „No config location set“.

## Was die Seite zeigt / kann
- Allow-/Deny-Regeln für Tools und Befehle.
- Anlegen, Bearbeiten und Entfernen von Regeln.

## Datenquelle & Schreibziel
Liest/schreibt die Permission-Settings des Agenten über `core/claude-settings`
(bzw. agentenspezifisches Pendant). Snapshot vorher.

## Verwandte Seiten
[Model & Env](./model-env.md) · [Settings (raw)](./settings-file.md) ·
[Doctor](./doctor.md)
