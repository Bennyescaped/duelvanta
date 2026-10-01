# DUELVANTA – MASTERHANDOUT V41

Stand: 23.09.2026 · Entwicklungsbranch ausschließlich `marketplace-ux-v1`.

**Der V40-Archiv-Order-FAIL ist technisch behoben. Scanner V16 #691 und Battle WebRTC #167 vollständig SUCCESS. Staging-Migration bleibt erfolgreich angewandt und wurde nicht erneut ausgeführt. Schritt 6 benötigt nur noch den gezielten angemeldeten Live-Nachtest des Fixes und die verbleibenden sicheren Read-only-Integrationsprüfungen.**

## 1. Verbindlicher Stand

V41 ersetzt V40 hinsichtlich des Archivfehlers. V40 bleibt Nachweis des angemeldeten reproduzierbaren FAILs. V39 bleibt Nachweis der erfolgreichen Staging-Migration und Live-Readiness. V38 bleibt technischer Migrationskandidaten-/Readiness-Nachweis.

- Technischer Archiv-Fixhead: `4bfe6c986c52a7889c163ce383a72f7a7fc42d92`.
- Vorheriger V40-Dokumentationshead: `918c2aa334ad966e2fb554d28539ef2ac1624cba`.
- `main`: `50f88213571be13255bb52eb489cc28cca660001`.
- PR #5: offen, Draft, unmerged.
- Staging: `xhmjxrcskfhbovhitdej`.
- Production: `enifiaqsnqtbzylnfrpi`, ausschließlich Negativgrenze.
- Migration History unverändert: `20260923081953 / trade_legal_contract_model_v1`.
- Migration **nicht erneut anwenden**.

## 2. Archiv-Order-Fix

Ursache: Die aus dem Archiv explizit geöffnete abgeschlossene Order wurde korrekt gerendert, aber der aktive Orders-Archivfilter blendete sie über den Grid-MutationObserver aus, bevor die bislang verzögerte Zielmarkierung gesetzt wurde.

Fix:

- Zielorder wird synchron beim Rendern markiert.
- Der aktive Filter lässt genau diesen expliziten Archiv-Zieldatensatz sichtbar.
- Normaler Orders-Render ohne Ziel behält die bestehende Trennung: completed/cancelled bleiben ausgeblendet.
- Keine Daten-, RPC-, SQL- oder Schemaänderung.

Detailbericht:
`DUELVANTA_LEGAL_SCHRITT6_ARCHIVE_ORDER_FIX_2026-09-23.md`.

## 3. CI

Technischer Head `4bfe6c986c52a7889c163ce383a72f7a7fc42d92`:

- Scanner V16 #691 / Run `35847846921`: SUCCESS.
  - validate `107138206621`
  - quota_database `107138206463`
  - collect_f3_database `107138206709`
- Battle WebRTC #167 / Run `35847846912`: SUCCESS.
  - battle_webrtc `107138206436`
  - spectator_database `107138206595`

Neuer realer Chromium-Regressionsnachweis auf Mobile/Desktop PASS.

## 4. Bereits bestätigter Staging-Stand

Unverändert aus V39/V40:

- Migration erfolgreich auf Staging.
- 266/266 Live-Katalogprüfungen PASS.
- Readiness `compatible=true`.
- Revision `trade-legal-contract-model-v1.2`.
- Stripe OFF.
- Compliance-E-Mail-Delivery manuell als `unset` bestätigt.
- keine Production-Mutation.
- keine echten Payments/Refunds/Payouts/E-Mails.

## 5. Verbleibende Abschlussgrenze

Jetzt ausschließlich ein gezielter angemeldeter Live-Nachtest des Archivfixes.

Mit vorhandenem Testkäufer:

- Archivierte Order erneut über „ORDER ÖFFNEN“ öffnen.
- Zielorder muss sichtbar sein.
- Normale aktive Orders bleiben korrekt.
- Keine Mutation.

Danach dürfen die in V40 wegen STOP nicht mehr ausgeführten read-only Browsergrenzen fortgesetzt werden, soweit vorhandene sichere Datenzustände dies erlauben.

Positive neue Preisangebots-/Festpreis-/B2C-Widerrufsszenarien dürfen weiterhin BLOCKIERT bleiben, wenn dafür keine vorhandenen sicheren Testzustände existieren. Keine Fixtures oder wirtschaftlichen Vorgänge nur zum Schließen eines Nachtests erzeugen.

## 6. Harte Grenzen

- Migration nicht erneut anwenden.
- Kein Schema-Fix.
- Kein Merge nach main.
- Kein Production-Deploy/-Migration.
- Kein Stripe Live.
- Keine echten Zahlungen/Refunds/Payouts.
- Keine Compliance-E-Mails.
- Keine künstlichen Deals/Orders/Widerrufe.

Nach erfolgreichem gezieltem Live-Nachtest Schritt-6-Abschlussstatus neu dokumentieren.
