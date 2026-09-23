# DUELVANTA – MASTERHANDOUT V37
Stand: 23.09.2026 · ausschließlich `marketplace-ux-v1`

**Schritt 6 erneut kontrolliert VOR der Staging-Migration gestoppt. Keine Legal-Migration angewandt. Neuer reproduzierbarer Katalog-/Readiness-Blocker S6-A03: neun Tabellen- und sechs RPC-Sollabweichungen bei Berücksichtigung des tatsächlichen Staging-Katalogs. Compliance-E-Mail-OFF weiterhin unbestätigt. Keine Produktions- oder Rechtsfreigabe. Nach V37 STOP.**

## 1. Verbindlichkeit und Git-Basis

V37 ersetzt V36 hinsichtlich des aktuellen Fortsetzungsstatus. V36 bleibt gültiger Nachweis des Reservierungsfixes S6-A01 und der implementierten Readiness S6-A02 einschließlich seiner isolierten Tests. Daraus folgt keine Freigabe des jetzigen Kandidaten für das tatsächlich vorhandene Live-Schema.

| Bezug | Wert |
|---|---|
| verifizierter Ausgangs-Remote-Head | `ffc9d5a6d338f640be712cab0e31f1a9e319e627` |
| unveränderter technischer Kandidatenhead | `b89cecc22e7eb2eb80716078a29584f383dd653e` |
| main | `50f88213571be13255bb52eb489cc28cca660001` |
| Staging | `xhmjxrcskfhbovhitdej` |
| Production, nur Negativgrenze | `enifiaqsnqtbzylnfrpi` |

Repository Bennyescaped/duelvanta; einziger Entwicklungsbranch marketplace-ux-v1. PR #5 offen, Draft, unmerged. Der Commit dieses Handouts/Berichts ist ausschließlich Dokumentation und diagnostische Evidenz; sein vollständiger Veröffentlichungshead wird im Abschluss separat angegeben. Vor jeder Fortsetzung tatsächlichen Remote-Head neu bestimmen.

15 Arbeitskopien inventarisiert, lokale Änderungen gesichert, isolierte neue Kopie. Kein Reset, Force-Push, Branchwechsel oder Überschreiben fremder Arbeit. Anwendungscode, Kandidat und Tests unverändert.

## 2. Legal-Status

Schritte 1–5 behalten ihre technischen Abnahmen und dokumentierten Integrationsgrenzen. S6-A01 Reservierungs-/Löschgrenzen bleibt technisch geschlossen. S6-A02 ist als echte kataloggestützte Readiness implementiert, aber ihre vollständige Live-Kompatibilität ist **nicht** nachgewiesen. S6-A03 blockiert die Staging-Gesamtmigration.

Vertragsmodelle unverändert: bestehender Privatkäuferzugang, Preisangebot bindend beim Senden und Vertrag bei Verkäuferannahme, kein zweiter vertragsschließender Checkout; Festpreis snapshotgebunden mit Provider-/DB-Unknown-Recovery; Widerruf nur konkreter berechtigter eigener B2C-Vertrag, immutable Evidence und deduplizierte Outbox ohne automatischen Refund/Storno/Payment-Statuswechsel.

## 3. S6-A03 – tatsächlicher Live-Katalog passt nicht zum eingefrorenen Readiness-Soll

Staging PostgreSQL 17.6 frisch read-only inventarisiert. 74 Tabellen, 951 Spalten, 267 Funktionen, 525 Constraints, 59 Trigger, 183 Indizes. Versionierte Basis stimmt bei Spalten, Funktionen/ACLs, Constraints, Triggern, Sequenzen, RLS und Schema-/Tabellenrechten überein.

Die Indexfixture enthält nur 120 Definitionen. Zwölf zusätzliche eigenständige Live-Indizes beeinflussen neun Readiness-Tabellen. Zehn davon haben Herkunft in vorhandenen Seller-/Notice-/Data-rights-SQL-Dateien; `profiles_username_unique_ci` und `profiles_founder_generation_idx` sind live vorhanden, Herkunft im Repository nicht gefunden. Nicht als freigegebene Drift behandeln.

Live-Default-Privileges vergeben bei neuen public-Funktionen von postgres direkt EXECUTE an service_role. Die Fixture bildet das nicht ab. Sechs neue Käufer-RPCs entziehen diesen direkten Grant nicht, während das Readiness-Soll service_role=false erwartet.

Isolierte lokale PGlite-Diagnose mit exakt unverändertem Kandidaten: bisherige Fixture compatible=true; mit Live-Indizes neun Tabellenabweichungen; mit Live-Default-Grants sechs Funktionsabweichungen; zusammen compatible=false mit 15 Abweichungen. Keine Live-Mutation, keine neuen Sollhashes, kein neuer nativer PG17-/Parallelitätsnachweis. Details und Grenzen im Abschlussbericht.

**Nicht nebenbei repariert. Keine Live-Indizes/Grants/Defaults verändert und kein Readiness-Bypass.**

## 4. Frisch bestätigte Live-Grenzen

Aktuelle Preview `dpl_y9q3HB7ADR4tUeGVkLxWz9JaRQdW` gehört exakt zum Ausgangshead; Runtime-Config HTTP 200 bestätigt environment=preview und ausschließlich Staging. Keine Production-Verbindung.

14 Listings, zwei accepted/price-Offers, acht Deals, sechs Orders, acht Contract-Snapshots. Keine pending/fixed_price-, positiven oder abgelaufenen Offer-Reservationen und keine in den ausgeführten Mengenprüfungen erkannten Altreservierungskonflikte. Cleanup-Signatur und service_role-Aufrufrecht vorhanden; Cleanup nicht ausgeführt.

Stripe-Datenbank: sandbox_enabled=false, live_mode=false, seller_invoice_issuance_enabled=false. Keine Stripe-Schlüssel/-API, Checkout Session, Zahlung, Erstattung oder Auszahlung.

**Compliance-E-Mail-OFF BLOCKIERT:** tatsächlicher Deployment-Wert nicht gelesen. Automatische Freigabeprüfung lehnte geplante Dispatcher-POST-Statusprobe wegen möglicher E-Mail-Wirkung ab; nicht wiederholt/umgangen. Kein Probe-Ergebnis als OFF ausgegeben. Keine E-Mails versandt. Ein read-only Environment-Nachweis bleibt erforderlich.

Neue Readiness-RPC und alte get_my_market_buyer_profile fehlen live. Erwarteter fail-closed-Vorzustand; kein angemeldeter Guard-/Post-Migrationstest. Landingpage-Zugriff und Runtime-Config sind keine angemeldete Integrationsabnahme.

## 5. Kandidat und CI

`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`

- Git-Blob `f1714dc1b5fc9ebeab0dbff5c974ac1696dc28ef`.
- SHA256 `a02e01bba93bda7e942850e776410fae1d752edb629b80319d9970859270d25f`.
- Exakt geprüft und unverändert, aber **wegen S6-A03 nicht auf Staging anwenden**. V35-Kandidat bleibt ebenfalls ausdrücklich gesperrt.

V36-CI auf technischem Head frisch bestätigt: Scanner V16 #682 / 35786444298 SUCCESS; Battle WebRTC #158 / 35786443880 SUCCESS. Vollständiger Testumfang laut V36 unverändert gültig. Kein Live-Migrationsnachweis, keine neue technische CI erforderlich, keine Tests abgeschaltet.

## 6. Offene Integration und externe Grenzen

Keine Migration und daher keine Post-Migrations-Schema-/Grant-/Policy-Abnahme, echte positive Staging-Readiness oder angemeldete Integration. Login, Profil, Orders/Belege, neue Preisangebot-/Festpreis-UI, B2C-/C2C-Widerrufsgrenzen und Browser-Privatdatenzugriff bleiben in diesem Block BLOCKIERT. Keine wirtschaftlichen Vorgänge als Testzustände erzeugt.

main und Production durch diesen Block unverändert, PR #5 Draft/unmerged, kein Merge, kein Production-Deploy, keine Production-Migration, keine Stripe-Live-Aktivierung. Keine echten Payments/Refunds/Payouts/Widerrufe oder Compliance-E-Mails. COLLECT, BATTLE/Spectator und Scanner-Release-Gate nicht neu bearbeitet.

## 7. Verbindlicher nächster Arbeitsblock

**STOP nach V37.** Separater gezielter Fixauftrag: vollständige geprüfte Katalog-/Indexfixture herstellen, Herkunft der beiden Profile-Indizes klären, Live-Default-Privileges in den isolierten Nachbau einbeziehen und neue RPC-Grants ausdrücklich festlegen. Keine Sollwerte aus ungeklärter Live-Drift generieren. Danach neuen Kandidatenhash und vollständige native PG17-/CI-Abnahme; zusätzlich tatsächliches E-Mail-OFF read-only nachweisen.

Erst anschließend neuer ausdrücklich autorisierter konfliktfreier Staging-Preflight. Kein automatischer Migrationsversuch aus diesem Handout. Keine Produktions-, Rechts- oder kommerzielle Freigabe.

## 8. Referenzen

- `DUELVANTA_LEGAL_SCHRITT6_STAGING_MIGRATION_2026-09-23.md`
- `evidence/legal-step6-staging-20260923/`
- V36 und `DUELVANTA_LEGAL_SCHRITT6_BLOCKER_FIXES_2026-09-22.md` für unveränderte technische Vorabnahmen
- V35/alter Preflight nur historisch; Schritte 1–5 und deren offene Nachtestgrenzen gelten fort.
