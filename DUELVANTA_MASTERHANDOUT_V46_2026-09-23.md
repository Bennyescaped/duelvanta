# DUELVANTA – MASTERHANDOUT V46

Stand: 23.09.2026 · Repository `Bennyescaped/duelvanta` · ausschließlich Branch `marketplace-ux-v1`.

**V46 hebt den V45-Blocker S7A-B01 auf und führt für die weitere Staging-Abnahme den DUELVANTA STAGING TEST AUTHORITY MODE ein. Schritt 7A ist ab Listing-Erstellung sofort fortzusetzen. Work soll kleine, eindeutig begrenzte Staging-Testblocker innerhalb desselben Auftrags selbstständig schließen und danach den ursprünglichen E2E-Ablauf fortsetzen. Kein Stop-and-Go nach jedem Fixture-Hindernis.**

---

## 1. Verbindliche Dokumente

Zuerst vollständig lesen:

1. `DUELVANTA_MASTERHANDOUT_V46_2026-09-23.md`
2. `DUELVANTA_MASTERHANDOUT_V45_2026-09-23.md`
3. `DUELVANTA_TRADE_SCHRITT7A_POSITIVE_B2C_E2E_2026-09-23.md`
4. `DUELVANTA_MASTERHANDOUT_V44_2026-09-23.md`
5. `DUELVANTA_MASTERHANDOUT_V43_2026-09-23.md`

V46 ist für den aktuellen Arbeitsauftrag verbindlich.

V45 bleibt historische Evidenz des inzwischen geschlossenen Steuer-ID-Blockers.  
V44 bleibt die fachliche Definition von Schritt 7A, soweit V46 sie nicht konkretisiert.  
V43 bleibt der abgeschlossene Schritt-6-Checkpoint.

---

## 2. Repository / Umgebungen

### Erwarteter Ausgangsstand vor V46

- Remote-Head vor V46: `21377c92b7c1d2a4000354cada070c29fd3f07de`
- `main`: `50f88213571be13255bb52eb489cc28cca660001`
- PR #5: offen, Draft, unmerged

Vor jeder Arbeit tatsächlichen Remote-Head erneut prüfen.

### Staging

`xhmjxrcskfhbovhitdej`

### Production

`enifiaqsnqtbzylnfrpi`

Production ist ausschließlich harte Negativgrenze.

Kein Production-Zugriff.  
Keine Production-Mutation.  
Kein Merge.  
Kein Force-Push.  
Kein Reset.  
Kein Branchwechsel.

---

# 3. Schritt 6 bleibt abgeschlossen

Nicht erneut aufrollen.

Migration History:

`20260923081953 / trade_legal_contract_model_v1`

Readiness:

- `compatible=true`
- `revision=trade-legal-contract-model-v1.2`

Migration nicht erneut anwenden.

---

# 4. V45-BLOCKER S7A-B01 IST GESCHLOSSEN

Der in V45 dokumentierte Blocker war:

`seller_tax_identifier_required`

für den synthetischen Step-7A-Trader.

## Tatsächlich ausgeführte Staging-Fixture-Provisionierung

Ausschließlich auf DUELVANTA-STAGING wurde für den bereits vorhandenen eindeutig synthetischen Trader

`2fe2dfab-2802-46ac-8c7b-2804eae2be8e`

ein privater synthetischer Tax-Identifier-Fixture-Datensatz provisioniert.

Wichtig:

- kein realer Steueridentifikator
- kein Klartext-Steuerwert gespeichert
- keine Compliance-Policy abgeschaltet
- kein Schema geändert
- keine Migration ausgeführt
- keine Production-Aktion
- private Tabelle blieb privat
- Fixture-Wert ist opak/randomisiert
- Identifier-Hash wurde serverseitig aus demselben opaken Fixture-Wert erzeugt
- ausschließlich Staging-Testvoraussetzung

Danach wurde die **vorhandene reguläre** Owner-Review-Funktion

`review_market_seller_onboarding(..., 'approve', ...)`

verwendet.

Kein direktes UPDATE auf `onboarding_status='active'`.

## Verifizierter Zustand nach Fixture-Provisionierung

Seller:

`2fe2dfab-2802-46ac-8c7b-2804eae2be8e`

- seller_type = `trader`
- onboarding_status = `active`
- tax_identifier_present = `true`
- business_name = `DUELVANTA STAGING TESTHÄNDLER STEP7A`

Verifiziert am 23.09.2026 gegen Staging.

Der Händler muss NICHT erneut onboarded oder freigegeben werden.

---

# 5. Aktuelle Staging-Baseline nach Schließen von S7A-B01

Unverändert gegenüber V45 bei den wirtschaftlichen Kernobjekten:

- Listings: 14
- Offers: 2
- Deals: 8
- Orders: 6
- Contract snapshots: 8
- Withdrawal drafts: 0
- Withdrawals: 0
- Payment attempts: 2

Readiness:

- compatible = true
- revision = `trade-legal-contract-model-v1.2`

Stripe:

- sandbox_enabled = false
- live_mode = false

Kein Listing/Offer/Deal/Order/Snapshot/Withdrawal wurde beim Schließen von S7A-B01 erzeugt.

---

# 6. STAGING TEST AUTHORITY MODE – AB JETZT VERBINDLICH

Ziel: Credit- und Laufzeitverschwendung durch unnötige Stopps vermeiden.

Work soll kleine, klar begrenzte Staging-Testprobleme innerhalb desselben Auftrags eigenständig lösen und anschließend den ursprünglichen E2E-Test fortsetzen.

## 6.1 Work DARF innerhalb desselben Schritt-7A-Auftrags

Ausschließlich auf Staging:

- eindeutig synthetische Testfixtures anlegen
- synthetische Fixture-Felder ergänzen
- vorhandene Admin-/Owner-/Service-Role-Wege für Fixture-Setup benutzen
- private Fixture-Tabellen administrativ befüllen, wenn es dafür bewusst keinen Browserpfad gibt
- notwendige synthetische Testvoraussetzungen korrigieren
- kleine reproduzierbare Codefehler direkt beheben
- bei Codeänderung vollständige relevante CI ausführen
- nach grünem Fix den ursprünglichen 7A-E2E-Test im selben Auftrag fortsetzen
- read-only Prüfungen selbstständig ergänzen
- Evidenz sammeln
- am Ende einen Gesamtbericht erstellen

Keine neue Chat-/Handout-Runde für jeden Mini-Blocker.

## 6.2 Fixture-Adminwege dürfen NICHT als Produkt-PASS ausgegeben werden

Wichtige Trennung:

Administrative Fixture-Vorbereitung darf Service Role/Owner-Kontext verwenden.

Die eigentlichen zu beweisenden Produktaktionen müssen weiterhin über den vorgesehenen Produktpfad laufen:

- Buyer-Review im normalen Browser
- Buyer sendet Preisangebot regulär
- Trader sieht/akzeptiert Angebot regulär
- Vertrag entsteht serverseitig durch vorgesehenen Acceptance-Pfad
- Buyer sieht Widerruf regulär
- Buyer bestätigt Widerruf regulär

Admin-/Service-Role darf diese Produktaktionen NICHT künstlich vorspielen.

## 6.3 Work DARF NICHT

- Production verbinden oder verändern
- globale Compliance-Regeln abschalten
- `tax_identifier_required_for_activation` auf false setzen
- Schema verändern, außer ein echter reproduzierbarer Code-/Schemafehler verlangt einen separaten technisch notwendigen Fix und vollständige CI; in diesem Fall keine Migration stillschweigend live anwenden
- vorhandene echte/nicht eindeutig synthetische Nutzer- oder Vertragsdaten verändern
- Contract Snapshots löschen
- Withdrawals löschen
- Retention umgehen
- Stripe Sandbox aktivieren
- Stripe Live aktivieren
- echte E-Mail senden
- echte Zahlung, Refund oder Payout erzeugen
- main mergen
- Schritt 7B beginnen

---

# 7. HARD-STOP-KRITERIEN – NUR HIER STOPPEN

Work soll Schritt 7A nur stoppen, wenn mindestens einer dieser Fälle eintritt:

1. Production könnte betroffen sein.
2. Ein nicht eindeutig synthetischer Datensatz müsste verändert werden.
3. Unbekannte Datenkorruption wird gefunden.
4. Eine neue rechtliche Produktentscheidung ist erforderlich.
5. Echte Geldwirkung wäre nötig.
6. Echte E-Mail-/Kommunikationswirkung wäre nötig.
7. Ein Fix würde eine globale Sicherheits-/Compliance-Regel lockern.
8. Ein Schema-/Migrationsfehler erfordert einen nicht vorbereiteten produktionsrelevanten Architekturentscheid.
9. Ein reproduzierbarer technischer Fehler kann nicht sicher innerhalb des vorhandenen Staging-Auftrags isoliert werden.

Nicht stoppen wegen:

- fehlendem synthetischem Fixture-Feld
- fehlendem Test-Adminwert
- fehlender synthetischer Listing-Voraussetzung
- fehlendem klar markierten Testdatensatz
- kleiner Browser-/Testverdrahtung, die sicher korrigiert werden kann
- fehlender Dokumentation während des laufenden Blocks

Diese Punkte innerhalb desselben Auftrags lösen.

---

# 8. JETZT SOFORT FORTSETZEN: SCHRITT 7A AB LISTING

## Vorhandene Testidentitäten

### Buyer

`e81841df-2b08-45c1-a2d7-2671f8c58f7d`

Vorhandener normaler Staging-Testkäufer.

Erwartete Rolle:

- normale Marketplace-/Beta-Rolle
- Buyer Type = consumer

### Trader

`2fe2dfab-2802-46ac-8c7b-2804eae2be8e`

Status jetzt:

- trader
- active
- Tax-Fixture vorhanden
- Legal Profile synthetisch
- bereit für Listing

Keine erneute Seller-Freigabe durchführen.

---

# 9. PHASE A – genau ein synthetisches Listing

Erzeuge über den vorgesehenen normalen Seller-Produktpfad genau ein Listing.

Kennzeichnung:

`DV STEP7A SYNTHETIC B2C TEST – DO NOT BUY`

oder eindeutig gleichwertig.

Anforderungen:

- Seller = Step-7A-Trader
- regulärer Verkauf
- kein Trade/Swap
- aktiv
- Menge >= 1
- Preis > 0
- vollständige Versandart
- vollständige Versandkosten
- ausschließlich synthetische Ware

Wenn die UI wegen einer kleinen fehlenden Fixture-Voraussetzung blockiert:

- Ursache prüfen
- Fixture administrativ auf Staging korrigieren
- NICHT globalen Guard lockern
- dann denselben Ablauf fortsetzen

Listing-ID dokumentieren.

---

# 10. PHASE B – positiver Preisangebotsfall

Mit dem normalen Step-7A-Buyer:

1. Listing öffnen.
2. Preisangebot starten.
3. regulären `review_market_price_offer_v1`-Review anzeigen.
4. sichtbare Vertragsdaten prüfen.
5. verbindliches Preisangebot regulär absenden.

Erwartung:

- neues Offer
- `offer_type='price'`
- `status='pending'`
- `buyer_type_snapshot='consumer'`
- `contract_review_snapshot` vorhanden
- `offer_review_hash` vorhanden

Offer-ID dokumentieren.

Keine Admin-Insertion des Offers.

---

# 11. PHASE C – Trader nimmt regulär an

Mit dem Step-7A-Trader:

1. eingegangenes Angebot öffnen
2. Vertragsdaten prüfen
3. regulär annehmen

Verwendeter Vertragsschlusspfad muss der vorgesehene Preisangebots-Acceptance-Pfad sein.

Keine Admin-Erzeugung von Deal/Order/Snapshot.

Danach read-only nachweisen:

- Offer accepted
- genau 1 Deal
- genau 1 Order
- genau 1 Contract Snapshot
- kein Doppel-Deal
- keine Doppel-Order
- kein zweiter Checkout
- kein Stripe
- kein Payment Attempt für diesen Negotiated-Price-Vertrag

IDs dokumentieren:

- Deal
- Order
- Contract Snapshot

---

# 12. PHASE D – B2C-Snapshot prüfen

Der erzeugte Snapshot muss tatsächlich enthalten:

- seller_type = trader
- buyer_type = consumer
- contract_classification = b2c
- withdrawal_eligible = true
- eingefrorene Seller Party
- eingefrorenes Produkt
- richtige Menge
- richtige Preise
- richtige Versanddaten
- EUR
- Bestellbestätigung

Wenn dies nicht stimmt:

echter FAIL → Ursache isolieren.

Ein kleiner technischer Fehler darf im selben Auftrag behoben werden, sofern:

- keine neue Rechtsentscheidung
- keine Production-Auswirkung
- vollständige relevante CI nach Codeänderung
- danach gezielter 7A-Replay

---

# 13. PHASE E – positiver Widerruf

Mit demselben normalen Buyer:

1. erzeugte Order öffnen
2. Widerrufsaktion muss sichtbar sein
3. konkreten Vertrag anzeigen
4. Händler/Produkt/Order/Preis prüfen
5. Widerruf vorbereiten
6. Widerruf bestätigen

Produktpfad:

- `prepare_market_withdrawal_v1`
- `confirm_market_withdrawal_v1`

Keine direkte Admin-Erzeugung des Widerrufs.

---

# 14. PHASE F – Widerrufsevidenz

Read-only beweisen:

- genau 1 Withdrawal
- richtige Contract Snapshot ID
- richtige Order
- richtiger Deal
- Buyer korrekt
- Trader korrekt
- `contract_domain='marketplace_b2c'`
- Evidence Snapshot vorhanden
- SHA256 korrekt
- immutable
- genau 1 deduplizierte withdrawal_receipt Outbox
- genau 1 deduplizierte withdrawal_notice Outbox
- Trader-Empfänger aus eingefrorenem Snapshot
- keine echte E-Mail

Replay:

erneute Bestätigung darf keinen zweiten Withdrawal erzeugen.

---

# 15. PHASE G – Vorher/Nachher

Dokumentiere tatsächliche Zähler.

Ausgangsbasis aktuell:

- Listings 14
- Offers 2
- Deals 8
- Orders 6
- Snapshots 8
- Withdrawal drafts 0
- Withdrawals 0
- Payment attempts 2

Der erwartete Unterschied nach erfolgreichem 7A muss ausschließlich aus dem klar markierten synthetischen Testfall erklärbar sein.

Keine unspezifizierte Datenänderung.

Stripe bleibt:

- sandbox_enabled=false
- live_mode=false

E-Mail bleibt unset/off.

---

# 16. Testdaten nach Erfolg

Der synthetische Vertrag und der Widerruf bleiben als Staging-Evidenz bestehen.

Nicht löschen:

- Deal
- Order
- Contract Snapshot
- Withdrawal
- Evidence
- Outbox-Nachweise

Das Listing nach Abschluss über einen regulären vorgesehenen Pfad deaktivieren, wenn dies ohne Beweisverlust möglich ist.

Alle Step-7A-IDs im Abschlussbericht dokumentieren.

---

# 17. Wenn während 7A ein kleiner Codefehler gefunden wird

NICHT sofort STOPPEN.

Stattdessen:

1. reproduzierbaren Fehler isolieren
2. minimalen Fix auf `marketplace-ux-v1`
3. keine fremden Änderungen überschreiben
4. vollständige relevante Scanner-/Battle-CI
5. bei PASS dieselbe 7A-Stelle erneut prüfen
6. E2E-Auftrag fortsetzen

Nur bei HARD-STOP-Kriterium aus Abschnitt 7 abbrechen.

---

# 18. Keine Zwischen-Masterhandouts mehr

Während des laufenden 7A-Blocks:

- keine V47 nur wegen Mini-Blocker
- keine neue Übergabe nur wegen Fixture-Korrektur
- keine Dokumentation als Vorwand zum Stoppen

Erst am Ende:

### PASS

Erstelle:

`DUELVANTA_TRADE_SCHRITT7A_POSITIVE_B2C_E2E_ABSCHLUSS_2026-09-23.md`

und danach:

`DUELVANTA_MASTERHANDOUT_V47_2026-09-23.md`

### HARD STOP

Nur dann einen Blockerbericht erstellen und präzise dokumentieren, welches HARD-STOP-Kriterium zutrifft.

---

# 19. Schritt 7B bleibt gesperrt

Auch nach vollständigem 7A-PASS:

**NICHT automatisch mit Festpreis/Stripe weitermachen.**

Schritt 7B benötigt weiterhin separate Freigabe, weil ein positiver Fixed-Price-Vertrag die Stripe-Test-Zahlungsaufforderung voraussetzt.

Work soll nach V47 STOPPEN.

---

# 20. Ziel dieses Modus

Ab jetzt:

- weniger Work-Neustarts
- weniger Masterhandouts
- weniger unnötige Credits
- mehr zusammenhängende End-to-End-Blöcke

Sicherheitsgrenzen bleiben bestehen, aber reine Staging-Fixture-Probleme sind kein Grund mehr für einen neuen Chat-Zyklus.

**JETZT: Schritt 7A ab Listing-Erstellung bis Preisangebot → B2C-Vertrag → Widerruf vollständig durchführen.**
