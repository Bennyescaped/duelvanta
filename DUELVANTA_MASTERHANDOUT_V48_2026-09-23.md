# DUELVANTA – MASTERHANDOUT V48

Stand: 23.09.2026 · Repository `Bennyescaped/duelvanta` · ausschließlich Branch `marketplace-ux-v1`.

**Schritt 7A ist bestanden. V48 autorisiert ausschließlich Schritt 7B: einen positiven Festpreis-End-to-End-Test über Stripe TEST/Sandbox auf DUELVANTA-STAGING. Stripe Sandbox darf dafür temporär ausschließlich auf Staging/Preview aktiviert werden und muss am Ende – auch bei Fehler – wieder vollständig OFF sein. Stripe Live, Production und echtes Geld sind strikt verboten.**

---

## 1. Verbindliche Basis

Zuerst vollständig lesen:

1. `DUELVANTA_MASTERHANDOUT_V48_2026-09-23.md`
2. `DUELVANTA_MASTERHANDOUT_V47_2026-09-23.md`
3. `DUELVANTA_TRADE_SCHRITT7A_POSITIVE_B2C_E2E_ABSCHLUSS_2026-09-23.md`
4. `DUELVANTA_MASTERHANDOUT_V46_2026-09-23.md`
5. `STRIPE_CONNECT_SANDBOX_ACCEPTANCE.md`

V48 ist für Schritt 7B verbindlich.

### Repository

- erwarteter Ausgangs-Remote-Head vor V48: `24a419f7d77a9df022af8dbb48f61db27d9d5058`
- `main`: `50f88213571be13255bb52eb489cc28cca660001`
- PR #5: offen, Draft, unmerged

Vor Beginn Remote-Head erneut prüfen. Keine fremden Änderungen überschreiben.

### Umgebungen

- Staging: `xhmjxrcskfhbovhitdej`
- Production: `enifiaqsnqtbzylnfrpi` – ausschließlich harte Negativgrenze

Kein Reset. Kein Force-Push. Kein Branchwechsel. Kein Merge.

---

# 2. Schritt 6 und 7A nicht erneut aufrollen

Schritt 6 abgeschlossen.

Migration History:

`20260923081953 / trade_legal_contract_model_v1`

Readiness:

- `compatible=true`
- `revision=trade-legal-contract-model-v1.2`

Migration niemals erneut anwenden.

Schritt 7A PASS:

Preisangebot → Trader-Annahme → B2C-Vertrag → Widerruf regulär im Browser.

Die dort erzeugte Evidenz nicht löschen oder verändern.

---

# 3. Aktuelle Staging-Baseline vor 7B

Frisch read-only verifiziert:

- Listings: 15
- Offers: 3
- Deals: 9
- Orders: 7
- Contract snapshots: 9
- Withdrawal drafts: 0
- Withdrawals: 1
- Payment attempts: 2

Stripe DB-Konfiguration:

- `sandbox_enabled=false`
- `live_mode=false`
- `platform_fee_bps=0`
- `platform_fee_fixed_cents=0`
- policy_version = `stripe-connect-sandbox-v1`

Readiness weiterhin grün.

---

# 4. Bereits vorhandener Stripe-Testverkäufer

Für denselben synthetischen Trader aus 7A:

`2fe2dfab-2802-46ac-8c7b-2804eae2be8e`

existiert bereits ein Stripe TEST Connected Account:

`acct_1UFU7JDwFcjtFwoY`

Verifizierter Staging-Zustand:

- live_mode = false
- onboarding_status = ready
- charges_enabled = true
- payouts_enabled = true
- details_submitted = true
- Onboarding Request = completed

**Kein neues Stripe-Onboarding durchführen.**

Keine neuen Connected Accounts anlegen.

Dieser vorhandene Testaccount ist für 7B zu verwenden.

---

# 5. STAGING TEST AUTHORITY MODE gilt weiter

Work soll Schritt 7B als **einen zusammenhängenden Block** durchführen.

Kleine Staging-Test-/Fixture-Probleme dürfen im selben Auftrag sicher behoben werden.

Keine neue Handout-/Chat-Runde wegen kleiner Testhindernisse.

## HARD STOP nur bei:

1. möglicher Production-Auswirkung
2. Stripe-Live-Konfiguration / Live-Key / Live-Objekt
3. echter Geldwirkung
4. nicht eindeutig synthetischer Datenänderung
5. unbekannter Datenkorruption
6. notwendiger globaler Sicherheits-/Compliance-Lockerung
7. neuer rechtlicher Produktentscheidung
8. nicht sicher isolierbarem Architekturfehler

---

# 6. AUSDRÜCKLICH AUTORISIERTE TEMPORÄRE ÄNDERUNGEN

Nur für Schritt 7B, nur Staging/Preview:

## 6.1 Vercel Preview

Temporär erlaubt:

`STRIPE_CONNECT_SANDBOX_ENABLED=true`

Ausschließlich für **Preview / marketplace-ux-v1**.

Nicht für Production.

Nicht global auf Production anwenden.

Folgende Live-Schalter müssen zu jeder Zeit false/unset bleiben:

- `STRIPE_CONNECT_LIVE_ENABLED`
- `STRIPE_CONNECT_LIVE_PAYMENTS_ENABLED`
- `STRIPE_CONNECT_LIVE_WEBHOOKS_ENABLED`
- `STRIPE_CONNECT_LIVE_ONBOARDING_ENABLED`
- `STRIPE_CONNECT_LIVE_REFUNDS_ENABLED`

Keine Live-Variable aktivieren.

## 6.2 Staging-Datenbank

Temporär erlaubt:

`dv_market_private.market_payment_configuration.sandbox_enabled=true`

Dabei zwingend:

`live_mode=false`

Keine Änderung der Production-Datenbank.

## 6.3 Preview-Deployment

Ein temporäres neues Preview-Deployment mit aktivierter Sandbox ist erlaubt.

Nach Rücksetzung ist ein abschließendes Preview-Deployment mit Sandbox OFF erlaubt und erforderlich, wenn die Environment-Änderung erst mit Redeploy wirksam wird.

**Kein Production-Deployment.**

---

# 7. FAIL-SAFE REIHENFOLGE DER AKTIVIERUNG

Vor Aktivierung:

1. Remote-Head prüfen
2. Staging Project Ref prüfen
3. Vercel-Ziel = Preview / marketplace-ux-v1 prüfen
4. alle Live-Schalter als false/unset bestätigen
5. DB `live_mode=false` bestätigen
6. Test Connected Account ready bestätigen
7. Ausgangszähler erfassen

Dann:

1. Preview-`STRIPE_CONNECT_SANDBOX_ENABLED=true`
2. Staging DB `sandbox_enabled=true, live_mode=false`
3. nötiges Preview-Redeploy
4. neues Deployment exakt Branch `marketplace-ux-v1`, target=null bestätigen
5. Runtime ausschließlich Staging bestätigen

Falls irgendein Schritt unklar ist:

**sofort Rollback nach Abschnitt 16.**

---

# 8. Stripe-Key-Modus

Keine Secret-Werte dokumentieren.

Der Servercode muss selbst den Modus erzwingen.

Im Sandboxmodus gilt:

- `STRIPE_SECRET_KEY` muss ein TEST-Key sein
- Server akzeptiert nur `sk_test_...`
- bei falschem Key muss `stripe_test_key_required` entstehen
- in diesem Fall darf kein Stripe-Providercall erfolgt sein

Wenn der vorhandene Preview-Key nicht TEST ist:

HARD STOP.

Keinen neuen Stripe-Key ohne ausdrückliche Nutzerfreigabe anlegen oder ersetzen.

---

# 9. JETZT GENAU EIN SYNTHETISCHES FESTPREISLISTING

Verwende:

### Trader

`2fe2dfab-2802-46ac-8c7b-2804eae2be8e`

### Buyer

`e81841df-2b08-45c1-a2d7-2671f8c58f7d`

Beide normale Produktrollen.

Erzeuge über den regulären Seller-Browserpfad genau ein neues Festpreislisting.

Eindeutiger Titel:

`DV STEP7B SYNTHETIC FIXED PRICE TEST – DO NOT BUY`

oder gleichwertig eindeutig.

Anforderungen:

- keine reale Ware
- regulärer Verkauf
- pricing_mode = fixed
- Menge = 1
- Preis klein, aber > 0
- vollständige Versandart
- vollständige Versandkosten
- Trader aus 7A
- keine bestehende echte Ware/Listing verwenden

Listing-ID dokumentieren.

---

# 10. Buyer Review

Mit normalem Buyer im echten Browser:

1. neues Listing öffnen
2. Button muss `JETZT KAUFEN` sein
3. Kaufdialog öffnen
4. serverseitigen Review abwarten
5. sichtbare Werte prüfen:
   - B2C / gewerblicher Verkäufer
   - Trader-Vertragspartner
   - synthetisches Produkt
   - Menge
   - Stückpreis
   - Warenwert
   - Versand
   - Gesamtpreis
   - Käuferstatus consumer
6. Button muss exakt:
   `Zahlungspflichtig bestellen`
   anzeigen

Noch nicht klicken, bevor Review vollständig dokumentiert ist.

---

# 11. POSITIVER FESTPREIS-VERTRAG

Dann genau einmal:

`Zahlungspflichtig bestellen`

klicken.

Erwarteter realer Produktpfad:

1. Buyer gibt verbindliches Kaufangebot ab
2. `prepare_fixed_price_market_offer_v1`
3. kurze technische Reservation
4. Stripe TEST Checkout Session wird serverseitig erstellt
5. Session-ID muss Testmodus sein, erwartbar `cs_test_...`
6. `accept_fixed_price_market_offer_v1`
7. dadurch Vertragsschluss
8. genau ein Deal
9. genau eine Order
10. genau ein Contract Snapshot
11. genau ein Payment Attempt
12. genau eine passende Payment Allocation
13. Browser erhält ausschließlich `https://checkout.stripe.com/... `

Kein Client darf Deal/Order/Snapshot direkt erzeugen.

---

# 12. WICHTIG: KEINE ZAHLUNG AUSFÜHREN

Der Test endet beim erfolgreichen Erzeugen der Stripe TEST-Zahlungsaufforderung und dem bereits serverseitig gebildeten Vertrag.

Wenn Browser zu Stripe weiterleitet:

- Stripe TEST Checkout darf sichtbar geladen werden
- keine Kartendaten eingeben
- keinen Testcard-Payment abschließen
- keine Zahlung simulieren
- keinen Payment-Webhook künstlich als bezahlt setzen

Ziel von 7B ist:

**Festpreis-Vertrag + echte Stripe TEST Checkout Session, nicht Payment-Erfolg.**

---

# 13. DB-NACHWEIS FESTPREIS

Read-only für genau diesen synthetischen Testfall prüfen:

## Offer

- `offer_type='fixed_price'`
- korrektes Listing
- korrekter Buyer/Trader
- Checkout Request ID vorhanden
- Checkout Hash vorhanden
- Stripe Account Snapshot = vorhandener TEST Connected Account
- `payment_live_mode_snapshot=false`
- Session ID Testmodus
- Status nach Acceptance gemäß vorgesehenem Modell
- Reservation korrekt verbraucht/gelöst

## Deal

Genau 1.

## Order

Genau 1.

Erwartet:

- `payment_provider='stripe_connect'`
- `payment_status='pending'`
- paid_amount = 0

## Contract Snapshot

Genau 1.

Erwartet:

- snapshot_version = `checkout-contract-v2`
- seller_type = trader
- buyer_type = consumer
- contract_classification = b2c
- withdrawal_eligible = true
- payment_provider = stripe_connect
- eingefrorene Seller-/Produkt-/Preis-/Versanddaten korrekt

## Payment Attempt

Genau 1 neuer Attempt für diesen Vertrag.

Erwartet:

- live_mode = false
- state passend zur erstellten Session
- TEST Connected Account
- amount_due_cents korrekt
- platform_fee_cents gemäß aktueller Konfiguration
- `stripe_checkout_session_id` = Testsession

## Allocation

Genau eine passende Allocation auf den neuen Contract Snapshot.

Keine Doppelobjekte.

---

# 14. Replay / Idempotenz im sicheren Umfang

Keine Parallelitätslast auf Live-Staging erzeugen.

Native PostgreSQL-17-CI bleibt maßgeblich für harte Parallelität.

Live darf ausschließlich sicher geprüft werden:

- Browser-Doppelklick erzeugt nicht zwei Requests
- erneut geöffnete Order/Listing erzeugt keinen zweiten Vertrag
- kein zweiter Deal
- keine zweite Order
- kein zweiter Snapshot
- kein zweiter Payment Attempt für dieselbe Checkout Request ID

Falls eine identische Request-ID sicher über den vorgesehenen bestehenden Recovery-Pfad erneut geprüft werden kann, muss derselbe Vertrag / dieselbe Session zurückkommen.

Keinen neuen künstlichen Providercall nur zum Erzeugen von Replay-Evidenz durchführen.

---

# 15. Nach Vertragsschluss

Das synthetische Festpreislisting darf nach Vertragsschluss nicht erneut aktiv kaufbar sein.

Vertragsevidenz nicht löschen:

- Offer
- Deal
- Order
- Contract Snapshot
- Payment Attempt
- Allocation

Stripe TEST Checkout Session darf unbezahlt bestehen bleiben.

Keine Zahlung nachholen.

Keine Refunds, weil keine Zahlung erfolgt.

Keinen Widerruf in 7B ausführen; positiver B2C-Widerruf ist bereits in 7A bewiesen.

Optional nur read-only prüfen, dass der erzeugte B2C-Snapshot grundsätzlich withdrawal_eligible ist.

---

# 16. ZWINGENDER ROLLBACK – AUCH BEI FEHLER

**Der Block ist NICHT fertig, solange Sandbox noch aktiv ist.**

Fail-safe Rücksetzreihenfolge:

## Zuerst Datenbank

Staging:

- `sandbox_enabled=false`
- `live_mode=false`

Unmittelbar read-only bestätigen.

## Dann Vercel Preview

- `STRIPE_CONNECT_SANDBOX_ENABLED=false` oder auf vorherigen OFF/unset-Zustand zurück
- alle Live-Schalter weiterhin false/unset

## Danach

Falls für Environment-Werte nötig:

- neues sauberes Preview-Deployment auf demselben Branch
- target=null
- kein Production-Deploy

## Abschlussprüfung

- DB sandbox=false
- DB live=false
- Preview Sandbox OFF
- API im OFF-Zustand muss vor Auth/Providercall wieder `stripe_sandbox_disabled` liefern
- keine Stripe API wird bei diesem OFF-Nachweis aufgerufen
- Production unverändert

Rollback gilt:

- bei PASS
- bei FAIL
- bei Browserabbruch
- bei Providerfehler
- bei Zeitüberschreitung

---

# 17. Erwartete Datenänderung bei PASS

Ausgangsbasis:

- Listings 15
- Offers 3
- Deals 9
- Orders 7
- Snapshots 9
- Withdrawals 1
- Payment attempts 2

Bei erfolgreichem 7B ist ungefähr zu erwarten:

- +1 synthetisches Listing
- +1 fixed_price Offer
- +1 Deal
- +1 Order
- +1 Contract Snapshot
- +1 Payment Attempt
- +1 Payment Allocation

Withdrawals bleiben unverändert.

Tatsächliche Werte dokumentieren; keine Werte erfinden.

Zusätzliche Notification-/Outbox-/Auditdaten dürfen aus dem regulären Produktpfad entstehen und müssen als solche eingeordnet werden.

---

# 18. CODEFEHLER WÄHREND 7B

Staging Test Authority Mode gilt.

Bei kleinem reproduzierbarem technischen Fehler:

1. Fehler isolieren
2. minimal auf `marketplace-ux-v1` beheben
3. vollständige relevante Scanner-/Battle-CI
4. neues Preview
5. Sandbox nur falls nötig wieder kontrolliert aktivieren
6. Test an derselben Stelle fortsetzen

Vor Codearbeit Sandbox möglichst zuerst OFF setzen, wenn die Fehleranalyse keinen aktiven Provider benötigt.

Kein Zwischen-Masterhandout wegen Mini-Fehler.

HARD STOP nur nach Abschnitt 5.

---

# 19. TECHNISCHE CI

Wenn keine Codeänderung nötig ist:

- vorhandenen Code-CI-Stand nicht als neuen Live-Test umetikettieren
- separate 7B-Live-Evidenz

Wenn Code geändert wird:

vollständige Scanner V16 und Battle WebRTC CI müssen grün sein.

Stripe-relevante Tests nicht abschalten:

- Connect contract/API/database
- live-mode default-off/API/database
- fixed-price PG17 concurrency
- legal contract model
- order browser
- runtime routing

---

# 20. ABSCHLUSSKRITERIEN SCHRITT 7B

7B ist nur PASS, wenn:

- Sandbox ausschließlich Staging/Preview temporär aktiviert wurde
- Live jederzeit OFF blieb
- TEST Connected Account verwendet wurde
- genau ein synthetisches Festpreislisting
- echter Browser-Review PASS
- genau eine TEST Checkout Session erzeugt
- Vertrag bei Payment-Request-Erstellung gebildet
- genau 1 Deal
- genau 1 Order
- genau 1 Snapshot
- genau 1 Payment Attempt
- Allocation korrekt
- keine Zahlung abgeschlossen
- kein Refund/Payout
- kein echter E-Mail-Versand
- keine Production-Auswirkung
- anschließend DB Sandbox OFF
- anschließend Preview Sandbox OFF
- abschließender OFF-Nachweis PASS

---

# 21. Dokumentation erst am Ende

Bei PASS erstellen:

`DUELVANTA_TRADE_SCHRITT7B_FIXED_PRICE_STRIPE_SANDBOX_E2E_2026-09-23.md`

und danach:

`DUELVANTA_MASTERHANDOUT_V49_2026-09-23.md`

Dokumentieren:

- Ausgangshead
- verwendete Preview-Deployments Sandbox ON/OFF
- Staging Project Ref
- Buyer/Trader IDs
- vorhandener TEST Connected Account
- Listing ID
- Offer ID
- Stripe TEST Checkout Session ID
- Deal ID
- Order ID
- Contract Snapshot ID
- Payment Attempt ID
- Allocation
- Preise/Mengen
- Replay-/Dedupe-Nachweise
- Vor-/Nach-Zähler
- Sandbox ON-Zeitfenster
- finaler Sandbox-OFF-Nachweis
- Live immer OFF
- keine Zahlung
- keine Refunds/Payouts
- E-Mail OFF
- Production/main unverändert
- PR #5 Draft/unmerged

Keine Secret Keys dokumentieren.

---

# 22. Danach STOP

Nach 7B PASS:

**Nicht automatisch Schritt 8 beginnen.**

Der nächste separat zu autorisierende Block ist:

`Schritt 8 – Production Readiness Preflight`

Dabei noch immer kein Merge und keine Production-Migration ohne separate Freigabe.

---

## Harte Schlussgrenze

JETZT NUR SCHRITT 7B.

Stripe Sandbox nur temporär auf Staging/Preview.

Stripe Live niemals.

Production niemals.

Keine echte Zahlung.

Kein Refund.

Kein Payout.

Keine echte Compliance-E-Mail.

Nach Test Sandbox vollständig OFF.

Danach V49 und STOP.
