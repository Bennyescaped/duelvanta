# DUELVANTA – MASTERHANDOUT V39

Stand 23.09.2026 · ausschließlich marketplace-ux-v1.

**Legal-Gesamtmigration auf Staging jetzt angewandt. SQL-Ausführung, vollständige relevante Schema-/Grant-Abnahme und echte Live-Readiness PASS. Angemeldete Preview-Integration einschließlich Live-Guard-/Loader-Nachweis BLOCKIERT. Kein vollständiges Gesamt-PASS von Schritt 6. Nach V39 STOP.**

## 1. Verbindlicher aktueller Stand

V39 ersetzt V38 hinsichtlich des Live-Migrationsstatus. V38 bleibt maßgeblicher technischer Kandidaten-/CI-Nachweis, V37 der historische gestoppte Preflight. Schritte 1–5, S6-A01 (Reservationen), S6-A02 (Katalog-Readiness) und S6-A03 (vollständige Basis/explizite Rechte) behalten ihre technischen Nachweise und dokumentierten Grenzen.

| Bezug | Wert |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangs-Remote-Head | ab99beb250a660b4e9d1a27bb196ec67afffb545 |
| technischer Kandidatenhead, unverändert | 91bad0f6546d579f4d8adc99f26027e45a36e891 |
| main, unverändert | 50f88213571be13255bb52eb489cc28cca660001 |
| Staging | xhmjxrcskfhbovhitdej |
| Production, ausschließlich Negativgrenze | enifiaqsnqtbzylnfrpi |
| PR #5 | open, Draft, unmerged |

Dieser Veröffentlichungscommit enthält nur Bericht/V39 und Live-Evidenz; finaler Remote-Head separat im Abschluss. 16 vorhandene Arbeitskopien inventarisiert, drei mit Änderungen gesichert; lokale/API-Historien bei identischem Ausgangstree nachvollzogen. Kein Reset, Force-Push, Branchwechsel oder Überschreiben fremder Änderungen.

## 2. Exakt angewandter Kandidat

`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`

- Git-Blob `c7b5df68a6d4dd37804e0efd59f9a076957b3dc8`.
- SHA256 `c7d061943629d692ada147ba27c9909105507929756deacc6a3a8cedb259b5c6`.
- Vollständig gelesen und unmittelbar vor Ausführung neu gehasht; keine technische Änderung seit V38.
- Supabase-Migration History: **20260923081953 / trade_legal_contract_model_v1**.
- Ein einziger apply_migration-Aufruf gegen Staging, **success=true**, kein SQL-Fehler, keine zweite Migration, keine improvisierte Reparatur.

**Nicht erneut anwenden.** V35/V36/V37-Kandidaten bleiben historisch und abgelöst. SQL-Quelle, Blob und Migrationshistorie bezeichnen dieselbe geprüfte Änderung; der History-Zeitstempel wird vom Tool vergeben.

## 3. Frischer Preflight und Environment

Staging PostgreSQL **17.6**, Projekt/Host vor Ausführung frisch bestätigt. Bestehende Preview `dpl_4W3XsD45jY75uZxUsSepbsYfAHzK` gehört exakt zum Ausgangshead. Runtime-Config frisch per GET: HTTP 200, environment=preview und ausschließlich Staging. Kein Production-Zugriff, kein manueller Deploy, keine Environment-Änderung.

Live-Ausgangskatalog gegenüber V38 unverändert; **266/266 Pre-Migrationsfingerprints identisch zur unabhängig rekonstruierten versionierten V38-Fixture**, null ungeklärte Drift. Alle zwölf V38-Indizes exakt erneut abgenommen; PostgreSQL-Defaults einschließlich service_role-EXECUTE korrekt berücksichtigt. Keine Defaults oder Basisindizes live geändert.

Altreservationen konfliktfrei: keine pending/fixed_price-, positiven oder abgelaufenen Reservationen, null Mengen-/Rückführungs-/Verwaisungskonflikte. 14 Listings, zwei accepted/price-Offers, acht Deals, sechs Orders, acht Snapshots. Cleanup-Signatur/service_role-EXECUTE vorhanden, Cleanup nicht ausgeführt. Readiness vor Migration fehlte erwartungsgemäß; Guard-Logik fail-closed. Kein Marker/Bypass.

Stripe frisch **sandbox_enabled=false, live_mode=false**, auch nach Migration; seller_invoice_issuance_enabled=false. Keine Stripe-API/-Schlüssel oder Checkout Session.

## 4. E-Mail-OFF-Nachweis jetzt geschlossen

**COMPLIANCE_EMAIL_DELIVERY_ENABLED = unset – manuell im Vercel-Dashboard bestätigt.** Nutzerbestätigung vom 23.09.2026, Projekt duelvanta_v5_vision: Settings → Environment Variables → All Environments, COMPLIANCE-Suche ohne Treffer; Shared Environment Variables ebenfalls ohne Variable. Ausdrücklich kein Connector-/API-Lesen behauptet. Unset hält den unveränderten Dispatcher default-off. Keine POST-Probe, kein Dispatch-Secret, keine Variable verändert, keine E-Mail.

## 5. Post-Migrationsschema und echte Readiness

Read-only Post-Inventar: 76 Tabellen, 987 Spalten, 280 Funktionen, 540 Constraints, 191 Indizes, 61 Trigger, 33 Policies, 14 Sequenzen. Keine ungültigen Indizes oder unvalidierten Constraints. Defaults/Schema-ACLs unverändert.

**266/266 Live-Katalogfingerprints exakt zum eingefrorenen V38-Kandidatensoll.** Live-Katalog-SHA256:

`f8e0e4cf5e000d60776a26e5bbd5275318fde632d8e3f55c5bd9a6cf42a33604`

Spalten/NOT NULL, Constraints/FKs, Indizes, Immutable-/Reservation-Trigger, RLS, private Grenze, relevante Rechte, RPC-Signaturen/Owner/Körper und Offer-Policies abgenommen. Alle übrigen Policies unverändert. Sechs neue Käufer-RPCs plus Readiness: authenticated EXECUTE, anon/PUBLIC/service_role entzogen, Owner postgres. Retired RPCs nicht browserzugänglich; Backend Release/Accept und Cleanup gemäß geprüftem Modell. Null private Browser-Tabellenrechte und keine private Schema-USAGE.

Auf echtem Staging am 23.09.2026 08:20:05 UTC: **revision=trade-legal-contract-model-v1.2, compatible=true**. Anschließend auch in read-only Transaktion unter Rolle authenticated bestätigt. Dieser DB-Rollencheck ist kein Nutzerlogin. Guard bleibt Version 1.2.

Keine Marketplace-Daten erzeugt: Bestandszahlen unverändert, neue Withdrawal-Drafts/Withdrawals null. Bestehende acht v1-Snapshots (sieben C2C, ein B2C) erhalten keine erfundene Widerrufsberechtigung. Datenexport-/Cleanup-/Retention-Worker nicht aufgerufen.

## 6. Offene Live-Integration

Die exakte Guard-Implementierung akzeptiert lokal die frisch gelesene echte Readiness; Fehler, Timeout, falsche Revision und unerwartete Antwort schließen weiterhin. Fünf Fälle frisch PASS, zusätzlich V38-Guard-/Chromium-CI. **Kein tatsächlicher angemeldeter Preview-Guard-/Loader-Nachweis.**

Weiterführender Preview-/Loginzugriff endete am Vercel-Login trotz temporärem autorisiertem Zugriff; keine authentisierte DUELVANTA-Testsession vorhanden. BLOCKIERT: Login, Profil, bestehende Orders/Bestellbestätigungen, live geöffneter Guard, Festpreis-UI, C2C-Widerrufs-UI und direkter privater Browserzugriffsversuch. SQL-Grants sind geprüft, ersetzen aber keine UI-Abnahme.

Zusätzlich fehlen geeignete vorhandene Live-Zustände: **null** neue kompatible price-offer-contract-v1-Snapshots und **null** widerrufsberechtigte B2C-Snapshots. Preisangebots-/zweiter-Checkout- und B2C-Widerrufsnachtest daher BLOCKIERT. Keine Käufe, Deals, Reservationen, Widerrufe oder Payments erzeugen, um dies künstlich zu schließen.

## 7. CI und Abschlussgrenzen

Keine Anwendungscode-/Test-/Kandidatenänderung in diesem Block, daher keine neue technische CI erforderlich. V38: Scanner V16 **#685 / 35832063879 SUCCESS**, Battle WebRTC **#161 / 35832063873 SUCCESS**, native PG17-Readiness 109 Checks und Reservation-Parallelität PASS. Historischer technischer Kandidatennachweis; Live-Evidenz separat, keine Umbenennung zu einem Migrationsnachweis.

main unverändert, PR #5 offen/Draft/unmerged. Production durch diesen Block unverändert: keine Verbindung, Migration oder Deployment. Keine Stripe-Live-Aktivierung, echten Payments/Refunds/Payouts oder Compliance-E-Mails. Keine Produktions-, Rechts-, Stripe-Live-, Merge- oder kommerzielle Freigabe.

**Nach V39 STOP.** Separater sicherer Integrationsnachtest nach verfügbarer authentisierter Preview-Sitzung; nur vorhandene geeignete Testzustände. Keine erneute Migration. Wegen der offenen Live-Integration wird die vollständige technische Abschlussaussage für Schritt 6 noch nicht erteilt.

Referenz: `DUELVANTA_LEGAL_SCHRITT6_STAGING_MIGRATION_ABNAHME_2026-09-23.md` und `evidence/legal-step6-final-20260923/`. V38/Fixbericht für unveränderte Technik; V37/alter Staging-Bericht ausschließlich historisch.
