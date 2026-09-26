# DUELVANTA – Legal Schritt 5: Widerruf

Stand: **22.09.2026** · Repository: `Bennyescaped/duelvanta` · Entwicklungsbranch: `marketplace-ux-v1`

**Status: Schritt 5 technisch umgesetzt, veröffentlicht und vollständig in CI bestanden. Die Legal-Migration bleibt unangewandt. Der Legal-Guard bleibt geschlossen. Stripe Sandbox/Live und reale Compliance-E-Mail-Zustellung bleiben deaktiviert. Keine Rechts-, Migrations-, Staging-, Gesamt- oder Produktionsfreigabe. Schritt 6 wurde nicht begonnen.**

## 1. Verifizierter Endstand

| Merkmal | Stand |
|---|---|
| Ausgangs-Dokumentationshead V33 | `9d1e6ca49f3cd7c7199034bd0c126bec55d176bd` |
| CI-geprüfter technischer Schritt-5-Head | `d71b72d96a214c8f18697fd31ac750092e213288` |
| Technischer Schritt-4-Head darunter | `826eb4ad866974bcf682796bcdfd51746e3218fc` |
| `main` | unverändert `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | offen, Draft, unmerged |
| Scanner V16 Check | #673 · Run `35771766205` · **SUCCESS** |
| Battle WebRTC Check | #149 · Run `35771766294` · **SUCCESS** |
| Withdrawal PostgreSQL Artifact | `trade-withdrawal-postgres-evidence` · ID `10714118810` |

Die technische Prüfung lief ausschließlich gegen isolierte CI-Fixtures/Wegwerf-Datenbanken. Es wurde keine Legal-Migration auf Staging oder Production angewandt und kein echter Widerruf erzeugt.

## 2. Inventarisierter Ausgangspfad

Vor der Änderung waren bereits vorhanden:

- `market_contract_snapshots.withdrawal_eligible`,
- `dv_market_private.market_withdrawal_drafts`,
- `dv_market_private.market_withdrawals`,
- `get_my_market_withdrawable_contracts`,
- `prepare_market_withdrawal_v1`,
- `confirm_market_withdrawal_v1`,
- Outbox-Arten `withdrawal_receipt` und `withdrawal_notice`,
- Widerrufsoberfläche in `trade-orders.js`,
- Compliance-Message-Dispatcher,
- bestehender eigener Datenexport und Lösch-/Retention-Mechanismus,
- Legal-/Rollen-/Browser-Regressionspakete.

Der relevante technische GAP war die Einmaligkeit auf Vertragsebene: `market_withdrawals` war nur über `draft_id` eindeutig. Zwei verschiedene Drafts desselben Vertragssnapshots hätten deshalb nicht als Datenbankinvariante ausgeschlossen werden können. Zusätzlich fehlten Widerrufsdaten im eigenen Datenexport und ein eigener realer PostgreSQL-/Chromium-Nachweis des vollständigen Widerrufspfads.

## 3. Vertragssnapshot- und Berechtigungsgrenze

Der Widerrufspfad akzeptiert ausschließlich einen konkreten vorhandenen Marketplace-Vertragssnapshot mit allen folgenden Eigenschaften:

- `contract_classification='b2c'`,
- `withdrawal_eligible=true`,
- `seller_type='trader'`,
- `buyer_type='consumer'`,
- eingeloggter Nutzer ist der im Snapshot gespeicherte Käufer,
- im unveränderbaren `seller_party`-Snapshot ist eine Händler-`public_email` gespeichert.

C2C, nicht widerrufsberechtigte Snapshots, fremde Käufer und B2C-Snapshots ohne eingefrorenen Händlerempfänger bleiben fail-closed.

Es wurde kein eigener DUELVANTA-Plattformvertrag als Warenvertrag modelliert und kein Plattformempfänger erfunden. Der technische Widerrufspfad trägt ausdrücklich `contract_domain='marketplace_b2c'`.

## 4. Genau eine unveränderbare Erklärung

Neu bzw. gehärtet:

- Unique-Index `market_withdrawals_contract_snapshot_uq` → maximal ein Widerruf pro Vertragssnapshot.
- Unique-Index `market_withdrawal_drafts_contract_buyer_uq` → maximal ein aktiver Draft pro Käufer/Vertrag.
- Vertragsbezogener PostgreSQL-Advisory-Lock in Prepare/Confirm.
- Confirm behandelt parallele Mehrfachklicks als Replay desselben Widerrufs.
- Bereits bestätigter Vertrag kann nicht erneut vorbereitet werden.
- `market_withdrawals` bleibt per Trigger gegen UPDATE/DELETE unveränderbar.
- Browserrollen erhalten weiterhin keine direkten Tabellenrechte auf Drafts oder Widerrufe.

Der bestätigte Datensatz speichert zusätzlich ein `evidence_snapshot`. `content_sha256` wird über die kanonische JSONB-Evidenz berechnet. Die Evidenz bindet insbesondere:

- Marketplace-B2C-Domain,
- Contract-Snapshot,
- Order und Deal,
- Käufer und Händler,
- eingefrorene Händler-E-Mail,
- Name des Verbrauchers,
- Bestätigungs-E-Mail,
- Erklärungstext,
- Eingangszeitpunkt.

Replay liefert dieselbe Widerrufs-ID und denselben Nachweis-Hash zurück.

## 5. Händlerempfänger und deduplizierte Nachrichten

Die Händlerbenachrichtigung verwendet ausschließlich:

`market_contract_snapshots.seller_party.public_email`

also den Händlerempfänger des unveränderbaren Warenvertragssnapshots, nicht einen später neu gelesenen Profilwert.

Die Outbox-Deduplizierung ist vertragssnapshotbezogen:

- `withdrawal_receipt:<contract_snapshot_id>`,
- `withdrawal_notice:<contract_snapshot_id>`.

Beide Payloads tragen den Evidenz-SHA256. Der Compliance-Dispatcher rendert diesen Nachweis in Käuferbestätigung und Händlerhinweis.

Reale Zustellung bleibt weiterhin standardmäßig aus:

`COMPLIANCE_EMAIL_DELIVERY_ENABLED !== 'true'` → Dispatcher verarbeitet keine echten E-Mails.

Die vorhandene Idempotency-Key-Bindung beim Provider wurde nicht abgeschwächt.

## 6. Strikte Trennung von Rückabwicklung

`confirm_market_withdrawal_v1` führt weiterhin **nicht** aus:

- Storno,
- Stripe Refund,
- Auszahlungskorrektur,
- Payment-Status-Änderung,
- Warenrückgabe,
- automatische Order-Stornierung.

Der PostgreSQL-Test verifiziert zusätzlich, dass Order- und Payment-Zustand durch die Widerrufserklärung unverändert bleiben.

Die UI erklärt weiterhin, dass Storno, Rücksendung und Erstattung getrennte Vorgänge sind.

## 7. Eigener Datenexport, Löschung und Retention

Der bestehende `export_my_duelvanta_data()` wurde um eigene Widerrufsevidenz ergänzt. Exportiert werden die widerrufsbezogenen Nachweisfelder, nicht die interne Outbox-/Delivery-Infrastruktur.

Es wurde **keine neue Aufbewahrungsfrist erfunden**.

Der bereits vorhandene Retention-/Löschpfad bleibt maßgeblich:

- Widerruf verweist per `ON DELETE RESTRICT` auf den unveränderbaren Vertragssnapshot.
- Der bestehende `contract_evidence`-Hold deckt Vertragsevidenz bereits ab.
- Dessen vorhandene Regel bleibt unverändert: keine neue automatische Frist; Löschung/Frist ist anhand Dokument/Anspruch zu prüfen.
- Vorhandene Verarbeitungssperren und staged account erasure wurden nicht gelockert.

Die bestehenden Account-Data-Rights-Regressionspakete liefen im finalen Scanner-Lauf vollständig grün.

## 8. UI-Hardening

`trade-orders.js` zeigt vor der endgültigen Erklärung jetzt den konkret vorbereiteten Snapshot mit:

- Contract-Snapshot-ID,
- Order-ID,
- Produkt,
- eingefrorenem Händler,
- Vertragsschlusszeit,
- Gesamtpreis,
- Verbrauchername,
- Bestätigungs-E-Mail.

Prepare- und Confirm-Buttons werden während des jeweiligen RPC-Aufrufs deaktiviert. Nach Erfolg zeigt die Oberfläche:

- Eingangszeitpunkt,
- Widerrufsreferenz,
- `Nachweis-SHA256`.

Cache-/Modulstand des Widerrufs-Orderpfads wurde auf `trade-orders.js?v=1.8` / Modul `1.8` angehoben.

## 9. Neue Tests

### 9.1 Echte PostgreSQL-17-Prüfung

Neu:

`tests/trade-legal-withdrawal-database-test.mjs`

Der Test läuft im vorhandenen isolierten PostgreSQL-17-CI-Service und prüft unter anderem:

1. nur berechtigter B2C-Snapshot wird gelistet,
2. C2C bleibt gesperrt,
3. `withdrawal_eligible=false` bleibt gesperrt,
4. fehlender eingefrorener Händlerempfänger bleibt gesperrt,
5. fremder Käufer erhält keinen Zugriff,
6. wiederholtes Prepare erzeugt nur einen Draft,
7. Browserrolle kann private Widerrufstabellen nicht direkt lesen,
8. zwei parallele Confirm-Aufrufe liefern dieselbe Widerrufs-ID; genau einer ist Replay,
9. genau ein unveränderbarer Widerruf entsteht,
10. Käufer-Receipt und Händler-Notice entstehen je genau einmal,
11. Händleradresse entspricht exakt dem eingefrorenen Snapshot,
12. gespeicherter SHA256 entspricht der gespeicherten Evidenz,
13. Order-/Payment-Zustand bleibt unverändert,
14. zweiter Widerruf desselben Vertragssnapshots scheitert an der Datenbankinvariante,
15. UPDATE/DELETE des Widerrufsnachweises bleibt gesperrt.

Tatsächliche PASS-Zeile in Scanner #673:

> PASS: withdrawal is B2C-snapshot-bound, replay-safe, immutable, deduplicated and separated from order/payment mutation

Eigenes Artifact:

- Name: `trade-withdrawal-postgres-evidence`
- Artifact ID: `10714118810`
- ZIP-SHA256 laut Actions-Upload: `30721aa5e550378939736f348884a3adc7b4119751d290039b12c359f9b942c9`

### 9.2 Reale Chromium-Prüfung

Neu:

`tests/trade-legal-withdrawal-browser-test.mjs`

Der Test führt die **tatsächliche Widerrufsfunktion aus `trade-orders.js`** mit synthetischen RPC-Fixtures in realem Chromium bei 390 px und 1280 px aus.

Geprüft:

- konkreter Vertrag vor Confirm sichtbar,
- Order/Produkt/Händler/Name/E-Mail sichtbar,
- nur Prepare- und Confirm-RPC,
- Nachweis-SHA256 nach Erfolg sichtbar,
- kein externer Request,
- kein Refund-/Cancel-Aufruf.

Tatsächliche PASS-Zeile in Scanner #673:

> PASS: withdrawal UI shows the exact frozen contract before confirmation and renders immutable receipt hash without refund/cancel action

## 10. Vollständiger CI-Nachweis

### Scanner V16 Check #673

Run: `35771766205` · Head: exakt `d71b72d96a214c8f18697fd31ac750092e213288` · **SUCCESS**

| Job | Ergebnis |
|---|---|
| `validate` · Job `106894958533` | **SUCCESS** |
| `collect_f3_database` · Job `106894958900` | **SUCCESS** |
| `quota_database` · Job `106894958686` | **SUCCESS** |

Im finalen `validate`-Job bestanden unter anderem:

- Legal-Model-/Schema-Guard-Regressionspaket,
- Preisangebots-Regression Schritt 3,
- Festpreis-/Stripe-/Order-Regressionspakete Schritt 4,
- Compliance-Dispatcher,
- Data-Export-/Deletion-/Retention-Regressionspakete,
- 13 reale Chromium Guard-/Loader-Szenarien,
- 9 Chromium Order-Reader-Szenarien,
- neuer Chromium-Widerrufstest,
- nachgelagerte Scanner/COLLECT-Regressionspakete.

### Battle WebRTC Check #149

Run: `35771766294` · Head: exakt `d71b72d96a214c8f18697fd31ac750092e213288` · **SUCCESS**

| Job | Ergebnis |
|---|---|
| `spectator_database` · Job `106894958982` | **SUCCESS** |
| `battle_webrtc` · Job `106894959332` | **SUCCESS** |

Diese Battle-Wiederholung ist ausschließlich Regressionsschutz. Spectator Media wurde nicht funktional erweitert oder erneut abgenommen.

## 11. Zwischenläufe

Vor dem finalen grünen Head gab es drei Scanner-Zwischenläufe mit jeweils genau einer veralteten Cache-Versionsassertion:

- Scanner #670: `trade-marketplace-ux-contract-test.mjs` erwartete noch Orders-Cache `1.7` / Modul `1.5`.
- Scanner #671: `trade-legal-readiness-test.mjs` erwartete noch Orders-Cache `1.7`.
- Scanner #672: `market-stripe-connect-contract-test.mjs` erwartete noch Orders-Cache `1.7`.

Die Runtime-Widerrufslogik und der neue PostgreSQL-Nachweis waren dabei nicht die Fehlerursache. Es wurden ausschließlich die stale Testassertionen an den bewusst angehobenen Cache-/Modulstand `1.8` angepasst.

Finaler Nachweis ist ausschließlich Scanner #673 / Battle #149 auf `d71b72d9…`.

## 12. Unveränderte Sperren

Weiterhin gilt:

- `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql` **NICHT** auf Staging angewandt,
- kein Schema-Freigabemarker,
- Legal-Guard geschlossen,
- Stripe Sandbox deaktiviert,
- Stripe Live deaktiviert,
- keine echten Payments,
- keine echten Refunds,
- keine Payouts,
- keine echten Compliance-E-Mails,
- keine Staging-Transaktion nur für diesen Nachweis,
- kein Merge nach `main`,
- PR #5 bleibt Draft,
- keine Gesamt-, Rechts-, Staging- oder Produktionsfreigabe.

**Schritt 5 ist damit ausschließlich im dokumentierten technischen Umfang abgeschlossen. Schritt 6 ist nicht begonnen.**
