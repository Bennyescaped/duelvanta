# DUELVANTA – Schritt 7A: positiver synthetischer B2C-E2E

23.09.2026. **PASS: reguläres Browser-Listing → Käufer-Preisangebot → Verkäuferannahme → B2C-Vertrag → zweistufiger Käufer-Widerruf.** Ausschließlich Staging. Replay-Nachweise nach Ausführungsart unten getrennt. Schritt 7B nicht begonnen.

## Basis

Verbindlich V46, fachlicher Ablauf V44; V45 historischer inzwischen geschlossener Fixture-Blocker; Schritt 6 nach V43 abgeschlossen. Diese Dokumente wurden im zusammenhängenden Auftrag vollständig gelesen.

- Ausgangsremote `402056062bdbbf71cba0dd492ae32b73e169577e`, Bennyescaped/duelvanta, marketplace-ux-v1.
- Gegen V45-Head `21377c92b7c1d2a4000354cada070c29fd3f07de` genau ein Commit, ausschließlich V46 hinzugefügt; keine technischen Änderungen.
- main `50f88213571be13255bb52eb489cc28cca660001`, unverändert; PR5 offen/Draft/unmerged, vor Dokumentationsveröffentlichung erneut geprüft.
- Staging `xhmjxrcskfhbovhitdej`; Production `enifiaqsnqtbzylnfrpi` ausschließlich Negativgrenze, nicht verbunden.
- Vorhandene READY-Preview `dpl_GRZaur1M6n6Hf2h2Mcw6npTWrLLy`, Codehead `260f5f3133e354ae0dd1f875bb623714a77f3897`.
- https://duelvantav5vision-8bv09tebl-bennyescaped-3783.vercel.app
- Work Cloud Browser, kein TinyFish. Keine Tokens oder Credentials dokumentiert. Keine neue Bereitstellung für diesen Test.

Preflight 13:05:46 UTC: Trader active, Readiness compatible=true/revision=trade-legal-contract-model-v1.2, Stripe false/false, erwartete acht Datenzahlen. Kein erneutes Onboarding. V46 dokumentiert die vorausgegangene administrative Tax-Fixture und reguläre Owner-Freigabe; diese Vorbereitung ist kein Browser-Produktnachweis. Kein weiterer Tax-/Policy-Eingriff in diesem E2E.

## Identitäten und dauerhaft erhaltene IDs

| Objekt | ID / Referenz |
|---|---|
| Normaler Buyer | e81841df-2b08-45c1-a2d7-2671f8c58f7d |
| Normaler Trader | 2fe2dfab-2802-46ac-8c7b-2804eae2be8e |
| Listing | 19e7bdbe-aea4-481b-9bce-49160e7c3030 |
| Offer | e334e1a0-179c-4d68-aeee-7b9e2b5aea7e |
| Deal | ae2c4fd7-8c7b-4eb0-9c85-9fcf2b16c53e |
| Order | 42d7cd8a-1705-4197-9017-ad029288c812 |
| Ordernummer | DV-260923-000014 |
| Contract Snapshot | 801ae92b-9569-4178-a1c2-2ece5165d6a3 |
| Verbrauchter Withdrawal Draft | 089da355-a7a1-4992-a621-c1b99ca3031b |
| Withdrawal | 7b0f82d7-9d3c-40f0-8f7f-851737efab94 |

Vorhandene synthetische Konten test-kaeufer@duelvanta.de und test-verkaeufer@duelvanta.de, beide player/beta. Browser-Identität vor jeder Seite kontrolliert. Ein Rollenwechsel öffnete zunächst erneut den Käufer; keine Verkäuferaktion damit ausgeführt. Ein fehlgeschlagener Verkäuferlogin wurde vom Nutzer im Work-Browser abgeschlossen; danach sichtbar „Willkommen, verkaeufer.“. Keine neue Registrierung, kein Reset, kein Magic-Link, keine Owner-/Admin-Session für Produktaktionen.

## Listing und Käuferangebot – PASS

Genau ein Listing über + VERKAUFEN → SEALED → normalen Veröffentlichungsbutton erstellt. Titel `DV STEP7A SYNTHETIC B2C TEST – DO NOT BUY`, Set STEP7A-TEST, TCG other, Kategorie other, Menge1, sale/negotiable, EUR2 Warenwert, parcel/EUR1 Versand. Eine eigens erzeugte Testgrafik nennt ausdrücklich „KEINE REALE WARE“, keine echte Produktdarstellung. Der Upload war erforderlich; kein zusätzlicher Produktdatensatz angelegt.

Listing erstellt 13:08:02.900265 UTC, vor Angebot updated_at 13:08:04.172260 UTC, active, quantity_available=stock_quantity=1. UI hatte zunächst vorhandene Abholvorgabe übernommen; regulär auf Paket und EUR1 umgestellt, kein Guard verändert.

Normaler Buyer öffnete PREIS VORSCHLAGEN. Sichtbarer Review: DUELVANTA STAGING TESTHÄNDLER STEP7A / Gewerblicher Verkäufer, eindeutiges Testprodukt, Menge1, EUR2 plus EUR1, Gesamt EUR3. Hinweis auf Vertragsschluss erst durch Verkäuferannahme sichtbar. Review nutzt vorgesehenen review_market_price_offer_v1-/create_market_offer_v3-Pfad; kein Legacy-v2 oder Admin-Insert. Datenbank belegt den eingefrorenen tatsächlichen Review und consumer/b2c. Die sichtbare Kurzansicht nennt „Gewerblicher Verkäufer“, nicht zusätzlich das technische Wort consumer; letzteres ist DB-Nachweis.

Angebot am 13:10:26.356218 UTC über PREISANGEBOT VERBINDLICH SENDEN regulär erstellt. offer_type=price, status=pending, requested_quantity=1, buyer_type_snapshot=consumer. contract_review_snapshot.snapshot_version=price-offer-contract-v1, seller_type=trader, contract_classification=b2c. Reviewhash `96444fa69e4000a7ce78dd0a8e5b7cc69fe65a4989e080cc78d9d3cd2700fd27`. Synthetische Nachricht: keine reale Ware, Zahlung oder Zustellung. Vor Annahme exakt0 Deals für das Listing.

## Verkäuferannahme und Vertragsnachweis – PASS

Trader öffnete PREISANGEBOTE. Sichtbar EINGEGANGEN/OFFEN, Käufer testKaeufer, identisches Testprodukt, Menge1, Warenwert EUR2, Versand EUR1, Gesamt EUR3, „Noch kein Vertrag“. Einmal VERBINDLICH ANNEHMEN im vorgesehenen respond_to_market_offer-Acceptance-Pfad.

13:26:17 UTC: Offer accepted, genau1 Deal, genau1 zugehörige Order, genau1 Snapshot. Kein zweiter Checkout. payment_provider=manual_beta, payment_status=not_required, payout_status=not_applicable, kein Payment Attempt für diesen Vertrag.

Snapshot checkout-contract-v2: seller_type=trader, buyer_type=consumer, b2c, withdrawal_eligible=true; eingefrorene synthetische Seller Party und Produkt; Menge1, Stückpreis/Warenwert EUR2, Paketversand EUR1, Gesamt EUR3. Contract-formed-at 13:26:17.931782 UTC. Eingefrorener Händler enthält die synthetische öffentliche Empfängeradresse dv-step7a-trader@invalid.example.

Buyer-Bestellansicht zeigt DV-260923-000014, korrekte Beträge, Beta ohne Onlinezahlung, BESTELLBESTÄTIGUNG und VERTRAG WIDERRUFEN. Dokumentdialog zeigt genau1 Vertragsnachweis, checkout-contract-v2 und gespeicherten SHA256. DB-confirmation_text enthält richtige Order, Produkt, Händler, Menge, Preis, Versand und B2C. Dokument-Hash `f736fd45f67cba0411580fe65976daa7ccc185abbf69b52cea29114f43bf3091`. Kein erneuter Vertrag und keine fremden Dokumentinhalte in diesem Bericht.

## Zweistufiger Widerruf – PASS

Normaler Buyer klickte VERTRAG WIDERRUFEN ausschließlich an dieser Order. Synthetischer Name DUELVANTA STEP7A SYNTHETIC BUYER, Bestätigungsadresse dv-step7a-buyer@invalid.example. Reguläre prepare_market_withdrawal_v1-Stufe. Zweite Browserstufe zeigte exakt Snapshot-ID, Order-ID, Testprodukt, Testhändler, Vertragsschluss und EUR3. Danach einmal WIDERRUF BESTÄTIGEN über confirm_market_withdrawal_v1.

13:30:24.500581 UTC: Browser zeigt WIDERRUF EINGEGANGEN, richtige Withdrawal-Referenz und SHA256. Keine erfolgreiche E-Mail-Zustellung behauptet; nur vorgemerkt. Genau1 market_withdrawals mit contract_domain=marketplace_b2c und korrekten Buyer/Seller/Deal/Order/Contract-IDs. Evidence Snapshot vorhanden.

Live read-only Neuberechnung mittels digest(convert_to(evidence_snapshot::text,'UTF8'),'sha256') entspricht content_sha256:

`1095dacf2956c285225cde0a261f520b27c45f9d8de6cefa7de3f463db5bda7c`

Immutable-Trigger für Contract-Snapshots und Withdrawals vorhanden und aktiviert (O), BEFORE UPDATE OR DELETE. Keine destruktive Probe auf Live-Evidenz.

## Outbox – PASS, keine Zustellung

Je genau1 Eintrag, alle pending, attempts=0, sent_at/delivered_at=NULL, kein Provider-Versand:

| Art | ID | Dedupe-Key |
|---|---|---|
| order_confirmation | 8ace21bf-07fa-4318-9041-48d5be1bf5cf | order_confirmation:801ae92b-9569-4178-a1c2-2ece5165d6a3 |
| withdrawal_receipt | d16ace19-316a-454b-8e05-33873b2f3ac2 | withdrawal_receipt:801ae92b-9569-4178-a1c2-2ece5165d6a3 |
| withdrawal_notice | b625605e-0662-4ba6-b342-7b81fe3fd2b5 | withdrawal_notice:801ae92b-9569-4178-a1c2-2ece5165d6a3 |

Beide Widerrufs-Payloads enthalten den richtigen Evidence-SHA256. Trader-Empfänger stimmt exakt mit eingefrorener seller_party.public_email überein; Käufernachricht richtige Buyer-ID und synthetische Bestätigungsadresse. order_confirmation nicht als Widerrufsnachweis gezählt.

## Replay – Nachweisarten ausdrücklich getrennt

Live-Browser: Nach Schließen und erneutem Aufruf BESTELLUNGEN kein weiterer Widerrufsbutton für diesen bereits widerrufenen Vertrag. Keine zweite Order/Annahme/Erklärung durch Öffnen erzeugt. Die UI entfernt den Bestätigungsbutton nach Erfolg; deshalb kein zweiter Browser-POST behauptet.

Zusätzlicher Live-DB-Replay als technische read-only Prüfung: BEGIN READ ONLY; SET LOCAL ROLE authenticated; transaktionslokale request.jwt.claim.sub auf die synthetische Buyer-ID; Aufruf derselben confirm_market_withdrawal_v1 mit dem bereits verbrauchten Draft; ROLLBACK. Liefert replayed=true, exakt dieselbe Withdrawal-ID, Eingangszeit und SHA256. Keine erneute Erklärung erzeugt; READ ONLY schließt Schreibpfade aus. Dies ist ein administrativ gestarteter DB-Test mit nachgebildetem Buyer-Kontext, ausdrücklich keine echte Browser-Session und kein Ersatz für die bereits vollständig regulär ausgeführten Produktaktionen.

Zusätzlich vorhandener nativer PG17-Test bestätigt zwei parallele authenticated-Aufrufe auf denselben Draft → gleiche ID/Hash und einmal replayed=false/einmal true. Testdatei tests/trade-legal-withdrawal-database-test.mjs. Vorhandene CI auf technischem Head: Scanner #698 Run35856415940 SUCCESS; Battle #174 Run35856416016 SUCCESS, frisch per GitHub bestätigt. Diese CI wird nicht als neuer Live-Browser-Replay ausgegeben.

## Vorher/Nachher und Abschlussgrenzen

| Objekt | 13:05:46 UTC | 13:33:52 UTC |
|---|---:|---:|
| Listings | 14 | 15 |
| Offers | 2 | 3 |
| Deals | 8 | 9 |
| Orders | 6 | 7 |
| Contract snapshots | 8 | 9 |
| Withdrawal drafts | 0 | 0 |
| Withdrawals | 0 | 1 |
| Payment attempts | 2 | 2 |

Ein Draft wurde regulär angelegt und bei Bestätigung verbraucht; Endstand0 ist beabsichtigt. Änderungen aus dem synthetischen Fall sowie reguläre zugehörige Order-/Notification-/Outbox-/Tax-Audit-Effekte; keine fremden Daten gezielt geändert. Keine unspezifizierte Reparatur ausgeführt. Zähler sind kein vollständiger Feld-für-Feld-Dump aller Tabellen.

Listing bereits reserved/quantity_available=0, somit nicht mehr aktiv kaufbar. Kein zusätzliches Beenden mit möglichen Vertragsnebenwirkungen; kein Storno, Versand, Rückgabeautomatismus oder Refund. Deal weiterhin accepted, paid_at/cancelled_at=NULL, manual_beta/not_required/not_applicable. Synthetische Evidenz bleibt erhalten; nichts löschen.

Stripe sandbox_enabled=false/live_mode=false; keine Stripe API, Checkout Session, echte Zahlung, Refund oder Payout. COMPLIANCE_EMAIL_DELIVERY_ENABLED weiterhin unset laut manuellem Vercel-Nutzer-Nachweis aus V43/V46, nicht als neuer API-Read ausgegeben. Keine Test-E-Mail/Dispatch-Probe. Live-Outbox attempts0 bestätigt fehlenden Zustellversuch für diese Nachrichten.

Readiness weiterhin compatible=true/revision1.2; Migration History unverändert 20260923081953/trade_legal_contract_model_v1. Keine Migration, Schema- oder Codeänderung. Keine neue technische CI erforderlich. Dokumentationsveröffentlichung nur auf marketplace-ux-v1; main/Production unverändert, PR5 offen/Draft/unmerged. Lokale saubere Arbeitskopie inventarisiert, Fetch ohne Reset/Branchwechsel; nur neue Dokumente auf Remote-Tree veröffentlicht.

**Schritt 7A im beschriebenen synthetischen Staging-E2E bestanden.** Kein HARD STOP eingetreten. V47 danach STOP. Schritt 7B weiterhin separat zu autorisieren. Keine Produktions-, Rechts-, Stripe-Live-, Merge- oder kommerzielle Freigabe.
