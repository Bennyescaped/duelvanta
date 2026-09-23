# DUELVANTA – MASTERHANDOUT V44

Stand: 23.09.2026 · ausschließlich Repository `Bennyescaped/duelvanta`, Branch `marketplace-ux-v1`.

**V43 ist der abgeschlossene Schritt-6-Checkpoint. V44 definiert den einzigen nächsten Entwicklungsblock eindeutig: Schritt 7A – kontrollierter positiver Staging-E2E-Nachweis für Preisangebot und daraus entstehenden B2C-Widerruf mit ausschließlich synthetischen, klar markierten Testzuständen. Festpreis/Stripe-Sandbox ist NICHT Bestandteil von 7A und bleibt für einen separaten Schritt 7B gesperrt.**

---

## 1. Verbindliche Ausgangsbasis

Zuerst vollständig lesen:

1. `DUELVANTA_MASTERHANDOUT_V44_2026-09-23.md`
2. `DUELVANTA_MASTERHANDOUT_V43_2026-09-23.md`
3. `DUELVANTA_LEGAL_SCHRITT6_FINAL_BROWSER_PROOF_2026-09-23.md`

V44 hat für den **nächsten Arbeitsauftrag** Vorrang. V43 bleibt verbindlich für den abgeschlossenen Schritt-6-Stand.

### Repository

- Repository: `Bennyescaped/duelvanta`
- einziger Entwicklungsbranch: `marketplace-ux-v1`
- Ausgangs-Remote-Head vor V44: `0cc9a6f2e83737deb7b6e15181c085e49817086e`
- finaler technischer Schritt-6-/Diagnosehead darunter: `260f5f3133e354ae0dd1f875bb623714a77f3897`
- `main`: `50f88213571be13255bb52eb489cc28cca660001`
- PR #5: offen, Draft, unmerged

Vor jeder Arbeit tatsächlichen Remote-Head erneut prüfen und Abweichungen vollständig einordnen.

Kein Reset. Kein Force-Push. Kein Branchwechsel. Keine fremden Änderungen überschreiben.

### Umgebungen

- DUELVANTA-STAGING: `xhmjxrcskfhbovhitdej`
- Production: `enifiaqsnqtbzylnfrpi` – ausschließlich harte Negativgrenze

Production niemals verbinden oder verändern.

---

## 2. Schritt 6 ist abgeschlossen – nicht erneut aufrollen

Die Legal-Gesamtmigration ist bereits erfolgreich auf Staging angewandt.

Migration History:

`20260923081953 / trade_legal_contract_model_v1`

Angewandte Datei:

`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`

Git-Blob:

`c7b5df68a6d4dd37804e0efd59f9a076957b3dc8`

SHA256:

`c7d061943629d692ada147ba27c9909105507929756deacc6a3a8cedb259b5c6`

**Migration niemals erneut anwenden.**

Bestätigter Schritt-6-Stand:

- PostgreSQL 17.6
- 266/266 relevante Live-Katalogprüfungen PASS
- Readiness `compatible=true`
- Revision `trade-legal-contract-model-v1.2`
- Guard/Loader-Reihenfolge PASS
- vier direkte private Browserzugriffe HTTP 406 / PGRST106
- Archiv-Order-Fix technisch + live PASS
- Bestellbestätigungsdownload PASS
- Stripe Sandbox OFF
- Stripe Live OFF
- `COMPLIANCE_EMAIL_DELIVERY_ENABLED=unset`
- keine Production-Mutation
- kein Merge

Finale V43-Dokumentations-CI:

- Scanner V16 #699 SUCCESS
- Battle WebRTC #175 SUCCESS

---

# 3. JETZT AUSSCHLIESSLICH: SCHRITT 7A

## Ziel

Die zwei bislang mangels sicherem Testzustand BLOCKIERTEN positiven Pfade

1. **neues verbindliches Preisangebot → Verkäuferannahme → echter Vertragssnapshot**
2. **berechtigter B2C-Vertrag → elektronischer Widerruf**

sollen auf **Staging** einmal vollständig end-to-end bewiesen werden.

Diese beiden Nachweise sollen bewusst in **einem kontrollierten synthetischen B2C-Testfall** verbunden werden:

- synthetischer gewerblicher Testverkäufer
- synthetischer Verbraucher-Testkäufer
- synthetisches eindeutig bezeichnetes Listing
- Käufer gibt verbindliches Preisangebot ab
- Verkäufer nimmt an
- dadurch entsteht der tatsächliche B2C-Vertrag
- der erzeugte Snapshot muss `withdrawal_eligible=true` sein
- Käufer widerruft anschließend genau diesen synthetischen Vertrag
- keine echte E-Mail wird versandt
- keine Stripe-Aktion
- keine echte wirtschaftliche Transaktion

**Schritt 7A ist ausdrücklich ein autorisierter Staging-Test mit synthetischen Daten.**

---

## 4. Was Schritt 7A ausdrücklich NICHT tun darf

Nicht Bestandteil dieses Blocks:

- Festpreis-Kauf
- `prepare_fixed_price_market_offer_v1`
- Stripe Checkout
- Stripe Sandbox aktivieren
- Stripe Live aktivieren
- Vercel-Stripe-Environment verändern
- DB-`sandbox_enabled` verändern
- echte Zahlung
- Refund
- Payout
- Production
- erneute Legal-Migration
- Schemaänderung
- main-Merge
- echte Compliance-E-Mail

Der positive Festpreisfall ist **Schritt 7B** und benötigt später eine separate ausdrückliche Autorisierung, weil der aktuelle positive Fixed-Price-Vertrag technisch eine Stripe-Test-Zahlungsaufforderung voraussetzt.

Work darf Schritt 7B NICHT automatisch beginnen.

---

# 5. PHASE A – Preflight und Bestandsaufnahme

Vor jeder Mutation:

1. tatsächlichen Remote-Head feststellen
2. `main` prüfen
3. PR #5 offen/Draft/unmerged bestätigen
4. Staging Project Ref exakt `xhmjxrcskfhbovhitdej` bestätigen
5. Production als Negativgrenze verifizieren
6. Migration History read-only bestätigen
7. Readiness read-only bestätigen:
   - `compatible=true`
   - `revision=trade-legal-contract-model-v1.2`
8. Stripe read-only bestätigen:
   - `sandbox_enabled=false`
   - `live_mode=false`
9. vorhandene Datenzahlen dokumentieren:
   - Listings
   - Offers
   - Deals
   - Orders
   - Contract snapshots
   - Withdrawal drafts
   - Withdrawals
   - Payment attempts
10. prüfen, ob bereits eindeutig synthetische Staging-Testkonten für normalen Käufer und gewerblichen Verkäufer existieren

Keine Testmutation vor abgeschlossenem Preflight.

---

# 6. PHASE B – Testidentitäten festlegen

## Bevorzugt

Bereits vorhandene eindeutig synthetische Staging-Testkonten wiederverwenden, **wenn**:

- sie keine realen Personen darstellen
- keine produktiven Daten besitzen
- Käufer normale Marketplace-Rechte hat
- Verkäufer für B2C als Trader konfigurierbar/konfiguriert ist
- keine Owner-/Admin-Sonderrechte den Test verfälschen

## Falls keine geeigneten synthetischen Konten existieren

Work darf für Schritt 7A **ausschließlich auf Staging** zwei neue synthetische Auth-Testkonten anlegen, sofern dies ohne Versand einer echten E-Mail möglich ist.

Empfohlene eindeutige Kennzeichnung:

- Buyer: `dv-step7a-buyer-20260923@invalid.example`
- Trader: `dv-step7a-trader-20260923@invalid.example`

Regeln:

- keine echte Maildomain
- keine E-Mail senden
- kein Magic-Link
- kein Passwort-Reset
- keine Production-Auth
- Passwörter/Secrets niemals committen oder in Evidenz schreiben
- Accounts als Staging-Testfixtures dokumentieren
- keine Owner-/Admin-Rollen vergeben

Wenn sichere Account-Erstellung ohne E-Mail-Wirkung technisch nicht möglich ist: **STOP und BLOCKIERT dokumentieren.**

Keine improvisierte Umgehung.

---

# 7. PHASE C – Rollen und B2C-Voraussetzungen

Der Test muss einen echten B2C-Snapshot aus dem vorgesehenen Produktfluss erzeugen.

### Käufer

Der synthetische Käufer muss gemäß existierender Architektur als:

`consumer`

geführt werden.

Keine Business-Buyer-Variante.

### Verkäufer

Der synthetische Verkäufer muss als:

`trader`

geführt werden.

Die vorhandene Seller-Onboarding-/Legal-Profile-Architektur verwenden.

Der Vertragssnapshot muss einen vollständigen eingefrorenen Händlerdatensatz bilden können.

Ausschließlich synthetische Daten verwenden, klar als Staging-Test erkennbar.

Beispielhafte Kennzeichnung:

- Business Name: `DUELVANTA STAGING TESTHÄNDLER STEP7A`
- Legal Name: `DUELVANTA Staging Test Trader`
- Public Email: nicht zustellbare synthetische Adresse unter `.invalid.example`

Keine realen Händlerdaten erfinden oder kopieren.

Falls vorhandene Validierungen konkrete synthetische Adresswerte verlangen, nur formal gültige, eindeutig als Test erkennbare Werte verwenden.

Seller-Onboarding-/Freigabestatus nur über die bereits vorhandenen vorgesehenen Staging-Funktionen setzen. Keine direkten Tabellenmanipulationen, wenn dafür reguläre RPC-/Adminpfade existieren.

---

# 8. PHASE D – Synthetisches Listing

Erzeuge genau **ein** eindeutig markiertes Staging-Listing für Schritt 7A.

Kennzeichnung muss in sichtbaren Feldern eindeutig sein, z. B.:

`DV STEP7A SYNTHETIC B2C TEST – DO NOT BUY`

Anforderungen:

- Verkäufer = synthetischer Trader
- listing_type = regulärer Verkauf, kein Tausch
- Status aktiv
- Produktart so wählen, dass bestehende Preisangebotslogik unterstützt wird
- Menge mindestens 1
- Preis > 0
- vollständige Versandart
- vollständige Versandkosten
- keine echten Bilder erforderlich, sofern Architektur dies nicht verlangt
- keine reale Ware darstellen

Vor dem Angebot Listing-ID, Verkäufer-ID, Preis, Menge, `updated_at` und relevante Snapshotdaten dokumentieren.

Keine weiteren Listings erzeugen.

---

# 9. PHASE E – Positiver Preisangebots-E2E

## Käuferseite

Mit dem normalen synthetischen Käufer in der echten Staging-Preview:

1. synthetisches Listing öffnen
2. Preisangebot starten
3. tatsächlichen Vertragsreview über
   `review_market_price_offer_v1`
   verwenden
4. prüfen, dass sichtbar sind:
   - Verkäufer/Vertragspartner
   - Ware
   - Menge
   - Angebotspreis
   - Versand
   - Gesamtbetrag
   - B2C-Klassifikation
   - Käuferstatus consumer
5. verbindliches Preisangebot über den vorgesehenen Browserpfad absenden

Der erzeugte Datensatz muss:

- `offer_type='price'`
- `status='pending'`
- eingefrorenen `contract_review_snapshot`
- `offer_review_hash`
- `buyer_type_snapshot='consumer'`

enthalten.

Kein Legacy-`create_market_offer_v2`.

## Verkäuferseite

Mit dem synthetischen Trader:

1. eingegangenes Angebot öffnen
2. Reviewdaten mit Buyer-Snapshot vergleichen
3. exakt dieses Angebot über den vorgesehenen Verkäuferpfad annehmen

Serverseitiges Vertragsschlussereignis muss ausschließlich:

`respond_to_market_offer(..., 'accepted')`

bzw. dessen aktuelle vorgesehene UI-Verdrahtung sein.

Keinen zweiten Checkout.

---

# 10. PHASE F – Preisangebots-Vertragsnachweis

Nach Verkäuferannahme read-only beweisen:

Genau für den synthetischen Testfall:

- Offer status = accepted
- genau ein Deal für das Offer
- genau eine Order für den Deal
- genau ein Contract Snapshot für den Deal
- Snapshot-Version gemäß aktuellem Modell
- Seller Type = trader
- Buyer Type = consumer
- Contract Classification = b2c
- `withdrawal_eligible=true`
- Snapshot enthält eingefrorenen Händler
- Snapshot enthält eingefrorenes Produkt
- Menge korrekt
- angebotener Warenwert korrekt
- Versand korrekt
- Gesamtpreis korrekt
- Currency EUR
- keine zweite Order
- kein Doppel-Deal
- kein doppelter Snapshot
- kein Payment Attempt für diesen negotiated-price-Vertrag
- kein Stripe-Vorgang

Bestellbestätigung über den vorgesehenen Käufer-Lesepfad öffnen und strukturell prüfen.

---

# 11. PHASE G – Positiver B2C-Widerrufs-E2E

Nur wenn Phase F vollständig PASS ist.

Mit demselben synthetischen Käufer:

1. Order öffnen
2. prüfen, dass der elektronische Widerruf für den **genau erzeugten** B2C-Snapshot angeboten wird
3. Widerruf öffnen
4. sichtbaren konkreten Vertrag prüfen:
   - Contract Snapshot ID
   - Order
   - Produkt
   - Händler
   - Vertragsschluss
   - Preis
5. synthetischen Namen/Bestätigungsadresse verwenden
6. Widerruf über den vorgesehenen zweistufigen Pfad bestätigen:
   - `prepare_market_withdrawal_v1`
   - `confirm_market_withdrawal_v1`

Keine direkte Tabellenmutation.

---

# 12. PHASE H – Widerrufsnachweis

Danach read-only beweisen:

Für den synthetischen Snapshot existiert:

- genau **eine** `market_withdrawals`-Erklärung
- `contract_domain='marketplace_b2c'`
- richtige Contract Snapshot ID
- richtige Order
- richtiger Deal
- richtiger Buyer
- richtiger Trader
- unveränderbares `evidence_snapshot`
- SHA256 stimmt zum Evidence Snapshot
- keine zweite Erklärung bei Replay

Outbox:

- genau eine deduplizierte `withdrawal_receipt`
- genau eine deduplizierte `withdrawal_notice`
- Händlerempfänger stammt aus eingefrorenem Vertragssnapshot
- Käuferbestätigung ist dem synthetischen Käufer zugeordnet
- Evidence-SHA256 in Outbox stimmt

Zusätzlich bestehende `order_confirmation` nicht mit Widerruf verwechseln.

Keine E-Mail-Zustellung auslösen.

`COMPLIANCE_EMAIL_DELIVERY_ENABLED` bleibt unset.

---

# 13. PHASE I – Replay / Doppelclick

Ohne neue Vertrags- oder Widerrufsdaten zu erzeugen:

### Preisangebot

Prüfen, dass erneutes Laden/Öffnen keine zweite Annahme erzeugt.

### Widerruf

Erneute Bestätigung desselben bereits bestätigten Draft-/Contractpfads muss auf denselben Widerrufsnachweis zurückführen bzw. darf keinen zweiten Datensatz erzeugen.

Erwartung:

- 1 Offer
- 1 Deal
- 1 Order
- 1 Contract Snapshot
- 1 Withdrawal
- keine Duplikate

Keine künstliche Parallelitätslast auf Live-Staging; die harte Parallelität bleibt durch PG17-CI abgedeckt.

---

# 14. PHASE J – Daten- und Providergrenzen

Vorher/Nachher exakt dokumentieren.

Der Unterschied darf ausschließlich den synthetischen Step-7A-Testfall betreffen.

Stripe:

- sandbox_enabled=false
- live_mode=false
- keine Checkout Session
- keine Stripe API
- keine Payment Attempts für diesen Preisangebotsvertrag
- keine Refunds
- keine Payouts

E-Mail:

- `COMPLIANCE_EMAIL_DELIVERY_ENABLED=unset`
- Outbox-Einträge sind erlaubt
- tatsächliche Zustellung verboten

Production:

- unverändert

---

# 15. PHASE K – Umgang mit Testdaten

WICHTIG:

Contract Snapshots und bestätigte Widerrufe sind absichtlich unveränderbare Evidenz.

Deshalb **nicht versuchen**, den erfolgreichen Step-7A-Vertrag oder Widerruf nachträglich zu löschen.

Der synthetische Testfall bleibt auf Staging als eindeutig markierte Testevidenz erhalten.

Nach Abschluss:

- Listing darf über den regulären vorgesehenen Test-/Sellerpfad in einen nicht aktiven Zustand gebracht werden, sofern dies ohne Vertragsbeweis zu verändern möglich ist.
- keine Contract Snapshots löschen
- keine Withdrawals löschen
- keine Outbox-Beweise löschen
- keine Retention-Regeln umgehen
- keine Foreign-Key-Kaskade erzwingen

Alle erhaltenen Testfixtures im Abschlussbericht mit ihren IDs kennzeichnen, damit sie nie mit echten Daten verwechselt werden.

Keine personenbezogenen echten Daten in Evidenzdateien schreiben.

---

# 16. PHASE L – Regression / CI

Falls **keine Repositoryänderung** erforderlich ist:

- V43-/aktueller CI-Stand bleibt technischer Code-Nachweis.
- Step 7A erhält separate Live-Evidenz.
- Keine unnötige Codeänderung nur zum Auslösen von CI.

Falls ein reproduzierbarer technischer Fehler gefunden wird:

- sofort STOP
- keinen spontanen Fix im selben Live-E2E-Block
- Befund dokumentieren
- separaten Fixauftrag erstellen
- nach Fix vollständige Scanner-/Battle-CI
- anschließend Step 7A gezielt wiederholen

Keinen Test abschalten.

---

# 17. PHASE M – Abschlusskriterien Schritt 7A

Schritt 7A ist nur PASS, wenn alle folgenden Punkte tatsächlich bewiesen sind:

### Preisangebot

- normaler Verbraucher kann Review sehen
- verbindliches neues Angebot entsteht
- eingefrorener Review/Hash vorhanden
- Trader kann genau dieses Angebot annehmen
- Vertrag entsteht ausschließlich bei Verkäuferannahme
- genau 1 Deal
- genau 1 Order
- genau 1 Contract Snapshot
- kein zweiter Checkout
- kein Stripe

### B2C

- Snapshot = b2c
- Seller = trader
- Buyer = consumer
- `withdrawal_eligible=true`

### Widerruf

- Widerrufsbutton für diesen Snapshot sichtbar
- konkreter Vertrag wird vor Bestätigung angezeigt
- genau 1 immutable Widerruf
- SHA256-Evidenz korrekt
- Käufer-/Trader-Outbox dedupliziert
- keine E-Mail gesendet
- kein Refund
- kein Storno
- keine Rückgabeautomatik

### Grenzen

- Production unverändert
- main unverändert
- PR #5 Draft/unmerged
- Migration nicht erneut angewandt
- Stripe Sandbox/Live unverändert OFF

---

# 18. Dokumentation nach PASS

Erstelle:

`DUELVANTA_TRADE_SCHRITT7A_POSITIVE_B2C_E2E_2026-09-23.md`

Dokumentiere mindestens:

- Ausgangs-Remote-Head
- verwendete Preview/Deployment-ID
- Staging Project Ref
- synthetische Buyer-/Seller-IDs, jedoch keine Credentials
- Listing-ID
- Offer-ID
- Deal-ID
- Order-ID
- Contract Snapshot ID
- Withdrawal-ID
- relevante Outbox-Dedupe-Keys
- Vor-/Nach-Datenzahlen
- sichtbare UI-Nachweise
- Contract Classification
- Withdrawal Eligibility
- Hash-/Replay-Nachweise
- Stripe OFF
- E-Mail OFF/unset
- keine Production-Mutation
- keine echte wirtschaftliche Transaktion

Danach neues Masterhandout:

`DUELVANTA_MASTERHANDOUT_V45_2026-09-23.md`

V45 muss festhalten:

- Schritt 7A PASS oder exakt BLOCKIERT/FAIL
- welche synthetischen Fixtures auf Staging verbleiben
- ob Schritt 7B freigegeben werden kann

---

# 19. Nach Schritt 7A STOP

Auch bei vollständigem PASS:

**Schritt 7B NICHT beginnen.**

Schritt 7B ist der positive Festpreis-/Stripe-Sandbox-Test und benötigt einen separaten Folgeauftrag.

Grund:

Das aktuelle Fixed-Price-Modell erzeugt den Vertrag erst nach erfolgreicher Erstellung einer Stripe-Zahlungsaufforderung. Mit `sandbox_enabled=false` ist ein echter positiver Festpreisvertrag auf Staging absichtlich nicht möglich.

Eine spätere Step-7B-Freigabe muss daher separat regeln:

- ausschließlich Stripe TEST/Sandbox
- welche Vercel-/DB-Schalter temporär geändert werden dürfen
- vorhandener oder synthetischer Stripe-Test-Connected-Account
- Rücksetzung auf OFF nach Test
- keine realen Zahlungen
- keine Production-Auswirkung

Work darf diese Entscheidung in Schritt 7A nicht selbst treffen.

---

# 20. Roadmap danach

Nur zur Orientierung, NICHT jetzt ausführen:

1. **Schritt 7A** – Preisangebot + B2C-Widerruf positiv auf Staging
2. **Schritt 7B** – positiver Festpreisfall mit separat autorisiertem Stripe-Sandbox-Test
3. danach **Schritt 8 – Production-Readiness-Preflight**
4. erst deutlich später und separat autorisiert:
   - Merge
   - Production-Migration
   - Stripe Live
   - kommerzieller Start

Keine dieser späteren Freigaben aus V44 ableiten.

---

## Harte Schlussgrenze

JETZT NUR SCHRITT 7A.

Kein Schritt 7B.
Kein Production.
Kein Merge.
Kein Stripe Sandbox aktivieren.
Kein Stripe Live.
Keine echte Zahlung.
Kein Refund.
Kein Payout.
Keine echte Compliance-E-Mail.
Keine erneute Legal-Migration.
