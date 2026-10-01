# DUELVANTA – Schritt 6: Archiv-Order-Navigationsfix

Stand: 23.09.2026 · Repository `Bennyescaped/duelvanta` · ausschließlich Branch `marketplace-ux-v1`.

**Der in V40 reproduzierte Fehler „ARCHIV → ORDER ÖFFNEN“ ist technisch behoben und vollständig in CI geprüft. Keine erneute Migration, keine Schema- oder Datenänderung, keine wirtschaftliche Aktion. Ein gezielter angemeldeter Live-Nachtest des Fixes bleibt separat erforderlich.**

## 1. Ausgangsbasis

- Ausgangs-Dokumentationshead V40: `918c2aa334ad966e2fb554d28539ef2ac1624cba`.
- Finaler technischer Fixhead: `4bfe6c986c52a7889c163ce383a72f7a7fc42d92`.
- `main`: unverändert `50f88213571be13255bb52eb489cc28cca660001`.
- PR #5: offen, Draft, unmerged.
- Staging-Migration `20260923081953 / trade_legal_contract_model_v1` wurde **nicht erneut angewandt**.
- Keine Production-Verbindung oder -Mutation.

## 2. Reproduzierter V40-Fehler

Angemeldeter Testkäufer:

1. TRADE → ARCHIV.
2. Abgeschlossene Order auswählen.
3. „ORDER ÖFFNEN“ klicken.
4. Wechsel in die Bestellansicht erfolgte.
5. Die Zielorder blieb unsichtbar.

Zweimal reproduziert, danach STOP gemäß V40.

## 3. Ursache

Der Archivpfad ruft korrekt `window.DV_TRADE_ORDERS.open(orderId)` auf.

`renderOrders(target)` rendert anschließend auch abgeschlossene Orders. Der globale Archiv-/Aktivfilter beobachtet jedoch Änderungen am Grid und blendet in der normalen Orders-Ansicht Karten mit Status `completed` oder `cancelled` aus.

Die Zielmarkierung wurde zuvor erst 80 ms später gesetzt. Dadurch lief der MutationObserver-/Filterpfad vorher und versteckte die gerade aus dem Archiv geöffnete Order.

Es lag kein Datenverlust, RPC-, Schema- oder Migrationsfehler vor.

## 4. Minimaler Fix

Geändert ausschließlich:

- `trade-orders.js`
- `trade-search-archive.js`
- fokussierte Regressionstests/CI-Wiring

`renderOrders(target)` markiert die explizit angeforderte Order jetzt **synchron direkt nach dem Rendern** mit einem DOM-Zielmarker, bevor der aktive Archivfilter laufen kann.

Der Orders-Aktivfilter lässt ausschließlich diesen explizit geöffneten archivierten Ziel-Datensatz sichtbar. Ein normaler Aufruf der Bestellansicht ohne Zielmarker blendet abgeschlossene/cancelled Orders weiterhin wie bisher aus.

Der temporäre visuelle Highlight-Effekt bleibt getrennt; der Sichtbarkeitsmarker überlebt dessen Entfernung bis zum nächsten vollständigen Orders-Render.

Keine Änderung an Orderdaten, Statuswerten, RPCs, RLS, Migration oder Archivpersistenz.

## 5. Neue Regression

Neu:

`tests/trade-archive-order-browser-test.mjs`

Der reale Chromium-Test verwendet die tatsächlichen Funktionen:

- `renderOrders(target)` aus `trade-orders.js`
- `applyActiveFilters()` aus `trade-search-archive.js`

Geprüft bei 390 px und 1363 px:

- explizit geöffnete abgeschlossene Archivorder bleibt sichtbar,
- Zielmarker existiert vor dem Filter,
- aktiver Orderdatensatz bleibt sichtbar,
- nach Entfernen des temporären Highlights bleibt die Zielorder sichtbar,
- erneutes Filtern versteckt die explizite Zielorder nicht,
- normaler Orders-Render ohne Archivziel versteckt abgeschlossene Orders weiterhin,
- keine externen Requests,
- keine Browserfehler.

Tatsächliche CI-PASS-Zeile:

> PASS: archived ORDER ÖFFNEN stays visible on mobile and desktop while normal completed-order filtering remains intact

## 6. CI

Finaler technischer Head:
`4bfe6c986c52a7889c163ce383a72f7a7fc42d92`

### Scanner V16 #691

Run `35847846921` – **SUCCESS**

- `validate` – Job `107138206621` – SUCCESS
- `quota_database` – Job `107138206463` – SUCCESS
- `collect_f3_database` – Job `107138206709` – SUCCESS

### Battle WebRTC #167

Run `35847846912` – **SUCCESS**

- `battle_webrtc` – Job `107138206436` – SUCCESS
- `spectator_database` – Job `107138206595` – SUCCESS

Zwischenlauf Scanner #690 scheiterte ausschließlich an der Position einer neuen statischen Testassertion vor deren `orders`-Variablendeklaration. Die Runtime-Dateien waren dabei nicht Fehlerursache. Die Assertion wurde gezielt an die korrekte Stelle verschoben; finaler Lauf #691 vollständig grün.

## 7. Unveränderte Grenzen

- Legal-Migration nicht erneut angewandt.
- Staging-Daten nicht verändert.
- Keine Käufe, Angebote, Deals, Reservationen oder Widerrufe erzeugt.
- Stripe Sandbox/Live nicht aktiviert.
- Keine Payments, Refunds oder Payouts.
- `COMPLIANCE_EMAIL_DELIVERY_ENABLED` bleibt manuell bestätigtes `unset`.
- Keine E-Mails.
- `main`/Production unverändert.
- PR #5 offen, Draft, unmerged.

## 8. Nächster Schritt

Nur noch gezielter angemeldeter Live-Nachtest gegen die bereits migrierte Staging-Preview:

1. bestehender Testkäufer,
2. ARCHIV öffnen,
3. dieselbe abgeschlossene Order öffnen,
4. prüfen, dass sie sichtbar in der Orders-Ansicht erscheint,
5. aktive Orders weiterhin korrekt,
6. keine Datenmutation.

Danach die übrigen in V40 noch nicht abgeschlossenen read-only Browsergrenzen nur soweit mit vorhandenen sicheren Zuständen möglich fortsetzen.

**Keine erneute Migration. Keine künstlichen wirtschaftlichen Testzustände.**
