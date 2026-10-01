# DUELVANTA – MASTERHANDOUT V34

Stand: **22.09.2026** · Verbindlicher Entwicklungsbranch: `marketplace-ux-v1`

**Schritte 1, 3, 4 und 5 sind im jeweils dokumentierten Umfang technisch abgeschlossen. Schritt 2 ist technisch abgeschlossen; sein angemeldeter Preview-Nachtest bleibt im vorhandenen Datenzustand TEIL-PASS / REST BLOCKIERT, ohne beobachteten FAIL. Die Legal-Migration bleibt unangewandt, der Legal-Guard bleibt geschlossen, Stripe und reale Compliance-E-Mail-Zustellung bleiben deaktiviert. Schritt 6 wurde nicht begonnen. Keine Rechts-, Gesamt-, Migrations-, Staging- oder Produktionsfreigabe.**

## 1. Verbindlichkeit und Arbeitsgrenzen

V34 ersetzt V33 als konsolidierten Fortsetzungsstand. Bei widersprüchlichen Statusangaben gilt V34 vor V33 und vor älteren Zwischenberichten. Die Detailberichte der einzelnen Schritte bleiben für ihren ausdrücklich geprüften Umfang maßgeblich.

Repository: `Bennyescaped/duelvanta`.

Einziger Entwicklungsbranch: `marketplace-ux-v1`.

PR #5 bleibt offen, Draft und unmerged.

Unverändert verboten bzw. außerhalb eines später ausdrücklich gestarteten Blocks:

- `main` verändern oder PR #5 mergen,
- Production oder Production-Supabase verändern,
- die Legal-Migration ungeprüft anwenden,
- einen Schema-Freigabemarker erfinden,
- Stripe Sandbox oder Live aktivieren,
- echte Payments, Refunds, Payouts oder Compliance-E-Mails,
- Schutzmechanismen für Tests abschalten,
- abgeschlossene COLLECT-/BATTLE-Abnahmen ohne neuen reproduzierbaren Befund wieder aufrollen.

## 2. Verifizierte Git-/CI-Basis

| Kennung | Bedeutung |
|---|---|
| `d71b72d96a214c8f18697fd31ac750092e213288` | CI-geprüfter technischer Schritt-5-Endstand |
| `9d1e6ca49f3cd7c7199034bd0c126bec55d176bd` | Dokumentationshead V33 / Ausgangsbasis Schritt 5 |
| `826eb4ad866974bcf682796bcdfd51746e3218fc` | CI-geprüfter technischer Schritt-4-Endstand |
| `2cab1572eec0e8a83e423c8633dcb57fc14ffa2b` | CI-geprüfter technischer Schritt-3-Endstand |
| `6ed31d7c9b9c9076968d5220bee236a21ca9cc3e` | CI-geprüfter technischer Schritt-2-Endstand |
| `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` | Technischer Schritt-1-Endstand |
| `50f88213571be13255bb52eb489cc28cca660001` | unveränderter `main`-Head |
| PR #5 | offen, Draft, unmerged |
| Staging-Project-Ref | `xhmjxrcskfhbovhitdej` |
| Production-Project-Ref, nur Negativgrenze | `enifiaqsnqtbzylnfrpi` |

Der V34-Dokumentationscommit liegt nur dokumentarisch über `d71b72d9…`. Technische Schritt-5-Abnahme bleibt Scanner #673 / Battle #149 auf exakt `d71b72d9…`.

## 3. Gesamtstatus Legal-Schritte

| Schritt | Stand | Fortsetzungsgrenze |
|---|---|---|
| 1 – Kompatibilitätsschutz | **VERÖFFENTLICHT + CI PASS + angemeldeter Read-only-Preview-Nachtest PASS** | abgeschlossen im definierten Umfang |
| 2 – bestehenden Privatkäuferzugang wiederverwenden | **TECHNISCH + CI PASS; Preview TEIL-PASS / REST BLOCKIERT** | kein beobachteter FAIL; fehlender offener Angebotszustand wurde nicht künstlich erzeugt |
| 3 – Preisangebotsmodell | **VERÖFFENTLICHT + vollständige CI PASS** | technisch abgeschlossen; Migration weiter unangewandt |
| 4 – Festpreisablauf | **VERÖFFENTLICHT + vollständige CI PASS + echte PostgreSQL-Parallelität PASS** | technisch abgeschlossen; Migration weiter unangewandt |
| 5 – Widerruf | **VERÖFFENTLICHT + vollständige CI PASS + PostgreSQL-17-/Chromium-Evidenz PASS** | technisch abgeschlossen; Migration weiter unangewandt |
| 6 – kontrollierte Gesamtmigration auf Staging | **NICHT BEGONNEN / GESPERRT** | nur nach separatem Auftrag und kontrollierter Übernahmeentscheidung |

## 4. Schritt 1 – unveränderter Status

Der Legal-Guard bleibt Version `1.1` und fail-closed.

Der angemeldete Read-only-Preview-Nachtest bleibt PASS für die tatsächlich geprüften Lesepfade. Fehlendes Legal-Schema öffnet den Guard nicht.

Referenzen:

- `DUELVANTA_LEGAL_SCHRITT1_VEROEFFENTLICHUNG_CI_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT1_PREVIEW_NACHTEST_2026-09-22.md`

## 5. Schritt 2 – unveränderter Status

Der Kandidat verwendet den vorhandenen Privatkäuferzugang. B2B/C2B bleiben aus dem aktuellen Release-Scope entfernt.

Der angemeldete Preview-Nachtest bleibt:

- PASS für Profil, bestehende Bestellung/Nachweis, Guard und beobachtete deaktivierte Aktion,
- BLOCKIERT für die praktische Annahme eines offenen eingegangenen Angebots, weil im vorhandenen Testkonto kein geeigneter Zustand existierte,
- kein beobachteter FAIL,
- keine neuen Testdaten nur für diesen Read-only-Nachweis erzeugt.

Referenzen:

- `DUELVANTA_LEGAL_SCHRITT2_PRIVATKAEUFER_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT2_PREVIEW_NACHTEST_2026-09-22.md`

## 6. Schritt 3 – Preisangebotsmodell

Technischer Endstand: `2cab1572eec0e8a83e423c8633dcb57fc14ffa2b`.

Für neue Preisangebote wird der vollständige Vertragsreview eingefroren. Der Käufer sendet das verbindliche Angebot; Vertrag entsteht bei Verkäuferannahme. Kein zweiter vertragsschließender Checkout. Replay erzeugt keinen zweiten Deal/keine zweite Order.

Referenz:

`DUELVANTA_LEGAL_SCHRITT3_PREISANGEBOTE_2026-09-22.md`

## 7. Schritt 4 – Festpreisablauf

Technischer Endstand: `826eb4ad866974bcf682796bcdfd51746e3218fc`.

Festpreisvorgänge sind an eingefrorenen Review-/Betrags-/Seller-/Fulfillment-/Stripe-Modus-Snapshot gebunden. Unklare Provider-/DB-Ergebnisse werden fail-safe und wiederaufnehmbar behandelt. Die echte PostgreSQL-17-Parallelitätsprüfung bestätigt Replay-Sicherheit, kein Overselling sowie genau einen Deal, eine Order, einen Payment Attempt und eine Allocation.

Referenz:

`DUELVANTA_LEGAL_SCHRITT4_FESTPREIS_2026-09-22.md`

## 8. Schritt 5 – Widerruf

Technischer Endstand: `d71b72d96a214c8f18697fd31ac750092e213288`.

### 8.1 Vertragsgrenze

Widerruf bezieht sich ausschließlich auf den konkreten unveränderbaren Marketplace-B2C-Vertragssnapshot:

- B2C,
- Händler-Seller,
- Consumer-Buyer,
- `withdrawal_eligible=true`,
- Käufer muss Snapshot-Käufer sein,
- Händlerempfänger muss als `seller_party.public_email` im Snapshot eingefroren sein.

C2C, nicht berechtigte/fremde Verträge und Snapshot ohne eingefrorenen Händlerempfänger bleiben gesperrt.

Keine Vermischung mit einem eigenen DUELVANTA-Plattformvertrag; Domain des Widerrufsnachweises ist `marketplace_b2c`.

### 8.2 Einmaligkeit und Evidenz

- genau ein aktiver Draft pro Käufer/Vertrag,
- genau ein Widerruf pro Contract-Snapshot,
- Vertrags-Advisory-Lock plus Datenbank-Unique-Invariante,
- paralleler Mehrfachklick replayt denselben Nachweis,
- `market_withdrawals` immutable gegen UPDATE/DELETE,
- `evidence_snapshot` + SHA256,
- Browserrollen ohne direkten Tabellenzugriff.

### 8.3 Nachrichten

- Käuferbestätigung dedupliziert pro Contract-Snapshot,
- Händlernotice dedupliziert pro Contract-Snapshot,
- Händlerempfänger ausschließlich aus eingefrorenem `seller_party.public_email`,
- Evidenz-SHA256 in beiden Payloads/Renderings,
- reale E-Mail-Zustellung bleibt default-off.

### 8.4 Rückabwicklung bleibt getrennt

Widerruf löst technisch keinen Storno, Refund, Payout-Ausgleich, Payment-Status-Wechsel oder Warenrückgabeprozess aus.

### 8.5 Datenrechte

Widerrufsevidenz wurde dem eigenen Datenexport hinzugefügt. Keine neue Retention-Frist wurde eingeführt. Bestehender `contract_evidence`-Hold, Löschblocker/-holds und Verarbeitungssperren bleiben maßgeblich.

### 8.6 Nachweise

Scanner #673 · Run `35771766205` · **SUCCESS**

- `validate` `106894958533` SUCCESS,
- `collect_f3_database` `106894958900` SUCCESS,
- `quota_database` `106894958686` SUCCESS.

Battle #149 · Run `35771766294` · **SUCCESS**

- `spectator_database` `106894958982` SUCCESS,
- `battle_webrtc` `106894959332` SUCCESS.

PostgreSQL-Artifact:

- `trade-withdrawal-postgres-evidence`,
- Artifact ID `10714118810`,
- tatsächliche PASS-Zeile: `PASS: withdrawal is B2C-snapshot-bound, replay-safe, immutable, deduplicated and separated from order/payment mutation`.

Chromium-PASS:

`PASS: withdrawal UI shows the exact frozen contract before confirmation and renders immutable receipt hash without refund/cancel action`.

Vollständiger Detailbericht:

`DUELVANTA_LEGAL_SCHRITT5_WIDERRUF_2026-09-22.md`

## 9. Weiterhin unangewandte Legal-Migration

Datei:

`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`

Stand unter V34:

- weiterhin **nicht** auf Staging angewandt,
- kein Schema-Freigabemarker,
- Legal-Guard geschlossen,
- neue Schritt-2–5-Vertragslogik deshalb nicht als Staging-Transaktionsfluss freigeschaltet,
- kein praktischer End-to-End-Widerruf auf Staging erzeugt.

CI-Prüfung des Kandidaten ist keine Migrations- oder Staging-Abnahme.

## 10. Stripe, E-Mail und Production

Weiterhin:

- Stripe Sandbox deaktiviert,
- Stripe Live deaktiviert,
- keine echten Payments,
- keine echten Refunds,
- keine Payouts,
- Compliance-E-Mail-Delivery deaktiviert,
- `main` unverändert,
- Production-Supabase unverändert,
- kein Merge,
- keine Produktionsfreigabe.

## 11. COLLECT/BATTLE/Scanner – nicht neu aufrollen

Ohne neuen reproduzierbaren Befund bleiben außerhalb des nächsten Legal-Blocks:

- COLLECT F1–F3/Mobile,
- BATTLE Spectator Media,
- Scanner-Release-Gate.

Die Battle-CI-Wiederholungen in Schritt 5 waren Regressionsschutz, keine neue Spectator-Media-Abnahme.

## 12. Fortsetzung

**Schritt 6 ist nicht begonnen.**

Vor einem später ausdrücklich gestarteten Schritt 6 zuerst:

1. V34 vollständig lesen.
2. Tatsächlichen Remote-Head verifizieren.
3. Arbeitskopien/unversionierte Dateien inventarisieren.
4. Prüfen, dass `main`, Production, Stripe und reale E-Mail-Zustellung unverändert sind.
5. Legal-Migration nicht anwenden, bevor der Schritt-6-Plan und die Schema-Readiness-Grenze ausdrücklich festgelegt wurden.
6. Keine Freigabe aus den Schritt-1–5-Einzeltests ableiten.

V34 dokumentiert ausschließlich den erreichten technischen Stand bis einschließlich Schritt 5.
