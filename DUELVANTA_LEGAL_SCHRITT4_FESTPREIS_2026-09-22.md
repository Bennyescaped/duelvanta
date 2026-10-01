# DUELVANTA – Legal Schritt 4: Festpreisablauf-Hardening

Stand: **22.09.2026** · Repository: `Bennyescaped/duelvanta` · Entwicklungsbranch: `marketplace-ux-v1`

**Status: Schritt 4 technisch umgesetzt, veröffentlicht und vollständig in CI bestanden. Die Legal-Migration bleibt unangewandt. Stripe Sandbox/Live bleiben deaktiviert. Keine Rechts-, Migrations-, Gesamt- oder Produktionsfreigabe. Schritt 5 wurde nicht begonnen.**

## 1. Verifizierter Endstand

| Merkmal | Stand |
|---|---|
| Ausgangs-Dokumentationshead Schritt 3 | `be6bd495c897a782d459ba571449e5bb33fef62d` |
| CI-geprüfter technischer Schritt-4-Head | `826eb4ad866974bcf682796bcdfd51746e3218fc` |
| `main` | unverändert `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | offen, Draft, unmerged |
| Scanner V16 Check | #667 · Run `35764186692` · **SUCCESS** |
| Battle WebRTC Check | #143 · Run `35764186676` · **SUCCESS** |
| Vercel Preview | `dpl_3FpFvwqJqKKBniJJyqKBXWrYp4c9` · **READY** |
| Preview-Host | `duelvantav5vision-kvujrxk1e-bennyescaped-3783.vercel.app` |
| Deployment-Quelle | git · Branch `marketplace-ux-v1` · exakt `826eb4ad…` · target=null |

Das Vercel-Deployment ist nur ein Build-/Auslieferungsnachweis. Da die Legal-Migration bewusst **nicht** auf Staging angewandt wurde, ist dies keine praktische Freischaltung oder Transaktionsabnahme des neuen Festpreisablaufs.

## 2. Durchgehende Snapshot- und Betragsbindung

Der weiterhin unangewandte Legal-Migrationskandidat friert für neue Festpreiskäufe vor der Zahlungsaufforderung nun den vollständigen geprüften Stand ein.

Zusätzlich zu dem vorhandenen Checkout-Review werden im internen Fixed-Price-Angebot gespeichert:

- vollständiger `contract_review_snapshot`,
- Review-/Checkout-Hash,
- erwartete Listing-Version,
- Stripe-Connected-Account-Snapshot,
- Sandbox-/Live-Modus-Snapshot,
- Gesamtbetrag in Cent,
- Plattformgebühr in Cent,
- Käuferstatus,
- Menge,
- Warenwert,
- Versandart und Versandkosten,
- Produkt-/Fulfillment-Snapshot einschließlich relevanter Verpackungs-/Gewichtsdaten.

Wird dieselbe `request_key` wiederverwendet, muss sie weiterhin zu **demselben Listing, derselben Menge, demselben Checkout-Hash und derselben ursprünglichen Listing-Version** gehören. Andernfalls wird mit `fixed_checkout_request_reused` abgebrochen.

Beim Replay werden Gesamtbetrag, Plattformgebühr, Stripe-Konto und Zahlungsmodus nicht aus inzwischen geänderten Listing-/Konfigurationswerten neu berechnet.

## 3. Vertragsschluss verwendet ausschließlich den eingefrorenen Festpreisstand

`accept_fixed_price_market_offer_v1` prüft vor dem Vertragsschluss:

- Snapshot-Version `checkout-contract-v2`,
- Integrität des gespeicherten Snapshot-Hashes,
- Listing-/Seller-/Buyer-Zuordnung,
- Consumer-Käuferstatus,
- C2C/B2C-Klassifikation,
- Menge und Warenwert,
- Währung EUR,
- Stripe-Provider,
- vollständigen Seller-/Product-/Fulfillment-Snapshot,
- eingefrorenen Gesamtbetrag,
- eingefrorene Plattformgebühr,
- eingefrorenes Stripe-Connected-Account,
- eingefrorenen Sandbox-/Live-Modus.

Deal, Bestellnachweis und Zahlungsnachweis verwenden anschließend diese eingefrorenen Werte. Spätere Änderungen an Listingpreis, Versandkosten oder Plattformgebühren ändern den bereits vorbereiteten Festpreisvorgang nicht.

Der Order-Item-Titel wird bei vorhandener Vertragsreview ebenfalls aus dem eingefrorenen Produkt-Snapshot übernommen und nicht erst aus einem später veränderten Listing rekonstruiert.

## 4. Idempotenz und Doppelvertragsschutz

Die vorhandenen und ergänzten Eindeutigkeitsgrenzen werden jetzt zusammen getestet:

- Käufer + `checkout_request_id` eindeutig,
- `payment_attempt_id` eindeutig,
- Stripe Checkout Session eindeutig,
- Deal pro `offer_id` eindeutig,
- Zahlungszuordnung pro Attempt/Contract-Snapshot eindeutig.

Die Annahme nutzt einen replay-sicheren Deal-Insert. Ein zweiter gleichzeitiger oder wiederholter Annahmeversuch lädt den bereits entstandenen Vertrag statt einen zweiten Deal zu erzeugen.

Auch Payment-Attempt und Allocation werden bei Replay nicht dupliziert und anschließend auf exakte Übereinstimmung mit den eingefrorenen Beträgen und dem Stripe-Konto geprüft.

## 5. Unbekannte Provider- oder Datenbankantworten

Der frühere problematische Fehlerpfad wurde entfernt: Bei einem unklaren Ergebnis nach Erstellung einer Stripe Checkout Session wird die Session **nicht mehr vorschnell abgelaufen gesetzt** und die Reservierung **nicht destruktiv freigegeben**.

Die API unterscheidet jetzt explizit:

### Vor nicht sicher nachgewiesenem Vertrag

Ein unbekanntes Stripe-/DB-Ergebnis liefert:

`fixed_checkout_outcome_unknown`

mit HTTP 503 und `retryable=true`.

Der Browser behält dieselbe Request-ID. Ein erneuter Versuch verwendet dadurch dieselbe Stripe-Idempotency-Key-Bindung und denselben Datenbankvorgang.

### Vertrag bereits sicher entstanden

Kann der Datenbankzustand eindeutig als bereits angenommen bestimmt werden, wird kein zweiter Kauf erzeugt. Die vorhandene Stripe Session wird serverseitig gelesen und streng gegen den eingefrorenen Vorgang geprüft.

Mögliche Recovery-Zustände:

- vorhandene offene, gültige Session: ursprüngliche Checkout-URL wiederverwenden,
- Session vollständig/abgeschlossen: `contract_formed_payment_processing`,
- Session abgelaufen: `contract_formed_payment_retry_required`,
- Providerzustand nicht sicher lesbar: `fixed_checkout_payment_recovery_unknown` mit `contract_formed=true`.

Damit wird ein bereits entstandener Vertrag nicht fälschlich als „kein Vertrag“ behandelt und es wird nicht aufgrund einer bloßen Transportunsicherheit ein zweiter Festpreiskauf gestartet.

## 6. Stripe-Session-Validierung

Bevor eine neue Provider-Session als vertragsbildende Zahlungsaufforderung verwendet wird, werden geprüft:

- Test-/Live-Präfix passend zum aktuellen Modus,
- erwartete Session-ID bei Recovery,
- exakter Gesamtbetrag,
- EUR,
- exakte `client_reference_id` = Payment Attempt,
- Metadata `duelvanta_attempt_id`,
- Metadata `duelvanta_fixed_offer_id`,
- gültiger Provider-Zeitstempel,
- bei vorhandener URL ausschließlich HTTPS auf `checkout.stripe.com`.

Unvollständige oder widersprüchliche Providerantworten werden nicht als erfolgreicher Vertragsschluss interpretiert.

## 7. Echte PostgreSQL-Parallelitätsprüfung

Neu:

`tests/trade-legal-fixed-price-concurrency-test.mjs`

Die Prüfung läuft in GitHub Actions gegen **PostgreSQL 17** in einer isolierten Wegwerf-Datenbank und verwendet mehrere echte, getrennte Verbindungen.

Tatsächlich in Scanner #667 bestanden:

> PASS: fixed-price PostgreSQL concurrency uses separate authenticated/service-role connections; same request replays once, final inventory cannot oversell, acceptance creates one deal/order/payment evidence

Geprüfte Fälle:

1. **Gleicher Käufer + gleiche Request-ID parallel**
   - echte Advisory-Lock-Blockade zwischen zwei Verbindungen beobachtet,
   - erster Vorgang reserviert,
   - zweiter Vorgang replayt denselben Offer-/Attempt-Datensatz,
   - Bestand wird nur einmal reduziert.

2. **Zwei Käufer konkurrieren um das letzte Stück**
   - echte PostgreSQL-Lock-Blockade beobachtet,
   - genau ein Vorgang gewinnt,
   - zweiter Vorgang kann nach Freigabe nicht überverkaufen,
   - genau eine Reservation entsteht.

3. **Zwei Service-Role-Annahmen desselben Festpreisangebots**
   - echte Row-Lock-Blockade beobachtet,
   - erster Aufruf bildet Vertrag,
   - zweiter Aufruf ist Replay,
   - genau ein Deal,
   - genau eine Order,
   - genau ein Payment Attempt,
   - genau eine Allocation.

4. **Snapshot-Stabilität**
   - nach Prepare wurden im Test Listingpreis, Versand und Gebührenkonfiguration verändert,
   - Annahme blieb an eingefrorenen Warenwert, Versand, Plattformgebühr und Stripe-Konto gebunden.

5. **Request-Key-Missbrauch**
   - dieselbe Request-ID mit verändertem Review-Hash wird abgewiesen.

CI-Umgebung: PostgreSQL **17.11**, Isolation `read committed`.

Eigenes CI-Artefakt:

- `trade-fixed-price-postgres-evidence`
- Artifact ID `10710804474`

## 8. Vollständiger CI-Nachweis

Scanner V16 Check #667:

| Job | Ergebnis |
|---|---|
| `validate` · Job `106869434924` | **SUCCESS** |
| `collect_f3_database` · Job `106869434510` | **SUCCESS** |
| `quota_database` · Job `106869435043` | **SUCCESS** |

Im selben `validate`-Job bestanden unter anderem:

- 42 Legal-Readiness-Assertions,
- 52 Profil-Fixture-Prüfungen,
- 50 Private-Buyer-Checkout-Prüfungen,
- 92 Bestelllese-Grenzen,
- 35 isolierte Private-Buyer-SQL-/Rollenszenarien,
- 4 reale Chromium-Profil-/Guard-Szenarien,
- Step-3 Preisangebotsregression,
- Stripe-API-Mocks einschließlich neuer Unknown-/Recovery-Pfade,
- Stripe-Sandbox-/Ledger-/Replay-/Refund-Regressionspakete,
- Stripe-Live-Default-Off-Grenzen,
- komplette TRADE UI-Selbsttests,
- TRADE Mobile und Desktop Browser Acceptance,
- 13 reale Chromium-Guard-/Loader-Szenarien,
- 9 Chromium-Bestelllese-Szenarien.

Die UI-Selbsttests endeten mit:

`ALL UI TESTS PASSED — mocks only, no live transaction.`

Battle WebRTC Check #143:

- `battle_webrtc` · Job `106869435260` · **SUCCESS**
- `spectator_database` · Job `106869434849` · **SUCCESS**

Diese Battle-Wiederholung ist nur Regressionsschutz; die abgeschlossene BATTLE-Abnahme wurde nicht neu aufgerollt.

## 9. Zwischenfehler und gezielte Korrekturen

Die Schritt-4-Zwischenläufe haben ausschließlich enge, reproduzierbare Test-/Kompatibilitätsbefunde offengelegt:

- Checkout-Modulversion in einer bestehenden Contract-Assertion war noch `2.1` statt `2.2`.
- Ein alter Test verlangte noch destruktives Stripe-`/expire` bei unklarem Finalize.
- Readiness-Mock erwartete noch HTTP 409 statt des neuen retrybaren HTTP 503.
- Ein Fixed-Price-Happy-Path-Mock enthielt die nun verpflichtende eingefrorene Währung `EUR` noch nicht.

Diese Erwartungen/Fixtures wurden an das gehärtete Modell angepasst. Kein Schutztest wurde abgeschaltet.

## 10. Unveränderte Grenzen

Nicht erfolgt:

- keine Anwendung der Legal-Migration auf Staging,
- kein Schema-Freigabemarker,
- keine Stripe-Sandbox-Aktivierung,
- keine Stripe-Live-Aktivierung,
- keine echte Stripe Session,
- keine echte Zahlung,
- keine Bestellung oder Angebotsannahme auf Staging,
- keine Refunds/Payouts,
- keine E-Mails,
- kein manueller Vercel-Deploy,
- kein Merge,
- keine Änderung an `main`,
- keine Änderung an Production oder Production-Supabase.

Der neue Vercel-Preview-Build ist deshalb **kein praktischer Festpreis-Transaktionsnachweis**. Solange das neue Schema absichtlich unangewandt bleibt, muss der Legal-Guard neue Vertragsaktionen weiterhin geschlossen halten.

## 11. Abschluss und Fortsetzung

**Schritt 4 ist technisch abgeschlossen: veröffentlicht + vollständige CI PASS + echte PostgreSQL-Parallelität PASS.**

Der nächste getrennte Block gemäß V32 ist **Schritt 5 – Widerruf fertigstellen**: Erklärung, Vertragsteil, Bestätigung/Zustellung und Datenrechte vollständig prüfen; Storno/Refund bleiben davon fachlich getrennt.

Schritt 5 wurde in diesem Block nicht begonnen. Die Gesamtmigration bleibt bis zur vorgesehenen kontrollierten Staging-Übernahme unangewandt.
