# DUELVANTA – B07 Re-Review

Stand: 16.09.2026

Grundlage:
- `DUELVANTA_MASTERHANDOUT_V15_2026-09-16.md`
- `DUELVANTA_B07_IMPLEMENTATION_STATUS_2026-09-16.md`
- `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md`
- Entscheidung `DUELVANTA_B07_DECISION_L07-01_54_2026-09-16.md`
- technischer Code-Checkpoint `de8fcb12e790a09f0e2bf10f3d49009dab49e294`
- GitHub Actions Run #411 / Run-ID `35089710430`
- Supabase-Staging `xhmjxrcskfhbovhitdej`

Dieses Re-Review ist **keine Rechts-, Steuer- oder Paymentfreigabe**.

## 1. Ergebnis in Kurzform

- **Kategorie A:** kein neuer offener Befund.
- **Kategorie B:** kein aktuell offener konkreter Codebefund aus dem V15-Arbeitsauftrag.
- **Kategorie C:** externe Rechts-/Steuer-/Paymentfreigaben weiterhin offen und produktiv deaktiviert.
- **Kategorie D:** genau ein verbleibender Evidenzpunkt: browserseitiger Zwei-Rollen-C2C-E2E mit zwei regulär onboardeten privaten Staging-Accounts.

B07 ist damit **intern technisch weitgehend geschlossen**, aber weder vollständig freigegeben noch kommerziell produktionsbereit.

## 2. Kategorie A – bestehende Architektur

Ohne neuen Befund weiterverwendet:
- Sellerstatus-/Identitätsgrundlage;
- Festpreis-Checkout und bindende Bestellhandlung;
- Contract-/Order-/Shipping-Snapshot-Grundarchitektur;
- transaktionsbezogene Problem-/Hold-Struktur;
- GitHub-Main-Schutz mit PR-Pflicht und Required Checks `validate` + `quota_database`.

Bewertung: **A geschlossen / weiterverwendbar.**

## 3. Kategorie B – intern technisch korrigierbar

### Geschlossene Punkte

- Release-1 Eligibility / DE-only / 18+;
- Anti-Circumvention-Grundguard im Repository;
- Preisangebot → 2h-Reservierung statt Vertrag;
- Trackingpflicht >25 EUR / optional <=25 EUR;
- Versandfrist-Hardening;
- Owner-Zustellprüfung / 72h-Lifecycle;
- ungetrackter Abschluss nach 40 Tagen;
- Order-Pickup;
- C2C bilaterale revisionsgebundene Bindung;
- C2C-Versand;
- C2C-Problemfälle;
- C2C-Pickup;
- reale PostgreSQL-17-C2C-Regression;
- separater Pickup-Contract-Test im `validate`-Job;
- kompletter C2C-Stack auf Staging;
- Staging-RLS-/ACL-/RPC-Grenzen;
- reale Staging-Rollback-Abnahmen Versand / Problem / Pickup;
- realer Staging-Schema-Befund `market_offers.reservation_expires_at` korrigiert.

### Staging-Schema-Befund

Die erste reale Staging-Abnahme zeigte, dass `public.market_offers.reservation_expires_at` im tatsächlichen Staging-Schema nicht existiert, obwohl der frühere CI-Bootstrap diese Spalte künstlich enthielt.

Korrektur:
- `database/b07-l07-01-c2c-swap-v1-completion-compat.sql`
- `database/b07-l07-01-c2c-swap-v1-pickup-completion-compat.sql`
- `tests/b07-c2c-staging-schema-overlay.sql`
- Regression-Wrapper an reales Schema angeglichen.

Nach Korrektur:
- Run #411 vollständig SUCCESS;
- reale Staging-Abnahme Versand: PASS;
- Problem 14 Tage / 7 Tage: PASS;
- Pickup 2h / Fremdpartei / 8-Versuche-Limit / Abschluss: PASS;
- Testdaten jeweils per ROLLBACK entfernt.

Bewertung: **kein offener Kategorie-B-Codebefund.**

## 4. Kategorie C – externe Freigaben

Weiter offen und ausdrücklich nicht produktiv aktivieren:

### Recht
- finales Vermittler-/Vertragsmodell;
- finale Plattform-/Verkäufer-/TRADE-Bedingungen;
- B2C-Verbraucherinformationen und zwingende Rechte;
- rechtliche Wirkung von Zustell-/Übergabe-/Bestätigungsnachweisen;
- endgültige Storno-/Sanktions-/Bewertungsmoderationsregeln.

### Payment
- Stripe Live;
- echte integrierte Zahlungen;
- echte Refunds/Chargebacks;
- reale Auszahlungen / Holds;
- wirtschaftliche 4-%-Stornogebühr;
- finale Gebühren-/Beleg-/Rechnungslogik.

### Steuer / PStTG / DAC7
- verbindliche Einordnung von C2C-Tauschwerten;
- Übernahme in PStTG-/DAC7-Ereignisse;
- TIN-/KYC-Schwellenfolgen;
- produktive BZSt-Meldung;
- steuerliche Behandlung der Plattformvergütung und Rückabwicklungen.

### Identität / Versand / Moderation
- externer Identitäts-/Altersprovider;
- materielle Neuakzeptanz finaler Bedingungen;
- finale Versandprodukte, Haftungs-/Versicherungsgrenzen und Risikokriterien;
- finale Review-Löschung/Berichtigung/Gegendarstellung/Moderation.

Bewertung: **C offen; kommerzieller Produktivstart blockiert.**

## 5. Kategorie D – Verifikation / Evidenz

### Geschlossen

- CI Pickup-Contract-Test explizit im `validate`-Block;
- realer PostgreSQL-17-C2C-Gesamttest;
- vollständiger C2C-Stack auf Supabase-Staging;
- RLS/ACL/RPC-Sicherheitsprüfung;
- reale Staging-Rollback-Abnahme Versand;
- reale Staging-Rollback-Abnahme Problemfall;
- reale Staging-Rollback-Abnahme Pickup;
- aktuelles READY-Vercel-Preview für den geprüften App-Codecheckpoint;
- Preview-Share-Zugang;
- DUELVANTA-Loginseite im Preview;
- erfolgreicher Login des bestehenden privaten Staging-Testverkäufers.

### Offen

**Browserseitiger Zwei-Rollen-C2C-E2E**:
- Proposal;
- Revision;
- Bestätigung beider Parteien;
- Versand + Empfang;
- Problemfall;
- Pickup-Codeflow;

mit zwei **regulär onboardeten** privaten Staging-Testaccounts.

Warum noch offen:
- aktuell ist nur ein privater, aktiver DE-Staging-Verkäufer mit verfügbarer Browseranmeldung vorhanden;
- ein anderer bestehender Testnutzer wird nicht per Roh-SQL/Auth-Manipulation künstlich zu einem C2C-Verkäufer hochgestuft;
- die funktionale Zwei-Parteien-Logik ist bereits in CI und realer Staging-DB-Abnahme nachgewiesen.

Bewertung: **D offen, aber kein aktuell nachgewiesener Codefehler.**

## 6. Release-Grenzen

Unverändert:
- `main` bleibt `50f88213571be13255bb52eb489cc28cca660001`;
- Produktion unverändert;
- PR #5 offen, Draft, nicht gemergt;
- kein Stripe Live;
- keine echten Zahlungen, Refunds oder Payouts;
- keine produktive PStTG-/Sanktions-/AGB-Aktivierung.

## 7. Re-Review-Schluss

Technischer B07-Status:

**A geschlossen / B geschlossen / C extern offen / D ein Browser-Evidenzpunkt offen.**

Zulässige Aussage:

> B07 ist intern technisch weitgehend geschlossen. Die Datenbank-/RPC-C2C-Flows sind in CI und auf realem Staging nachgewiesen. Ein browserseitiger Zwei-Rollen-E2E bleibt als Kategorie-D-Evidenz offen. Externe Rechts-, Steuer- und Paymentfreigaben bleiben Gate vor kommerziellem Produktivstart.

Nicht zulässige Aussage:
- `B07 vollständig freigegeben`;
- `rechtlich freigegeben`;
- `steuerlich freigegeben`;
- `Payment produktionsbereit`;
- `kommerzieller Start freigegeben`.
