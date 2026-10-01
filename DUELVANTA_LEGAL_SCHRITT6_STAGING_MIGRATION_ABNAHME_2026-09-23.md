# DUELVANTA – Schritt 6: Staging-Migration und Schemaabnahme

Stand 23.09.2026. **SQL-Migration auf Staging erfolgreich. Vollständige relevante Katalog-/Grant-Abnahme und echte Live-Readiness PASS. Angemeldete Preview-Integration sowie deren Live-Guard-/Loader-Nachweis BLOCKIERT. Deshalb kein vollständiges Gesamt-PASS für Schritt 6.**

## Ausgangsbasis und Sicherung

V38, Katalog-Readiness-Fixbericht, V37 und vorheriger Staging-Migrationsbericht vollständig gelesen. V38 ist maßgeblich für Kandidat/Technik; V37 ausschließlich historischer Preflight.

| Bezug | Frisch verifizierter Wert |
|---|---|
| Ausgangs-Remote-Head marketplace-ux-v1 | `ab99beb250a660b4e9d1a27bb196ec67afffb545` |
| technischer Kandidatenhead, unverändert | `91bad0f6546d579f4d8adc99f26027e45a36e891` |
| main, unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| Staging Project Ref | `xhmjxrcskfhbovhitdej` |
| Production – ausschließlich Negativgrenze | `enifiaqsnqtbzylnfrpi` |
| Migration | `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql` |
| Git-Blob | `c7b5df68a6d4dd37804e0efd59f9a076957b3dc8` |
| SHA256 | `c7d061943629d692ada147ba27c9909105507929756deacc6a3a8cedb259b5c6` |

16 vorhandene DUELVANTA-Arbeitskopien inventarisiert, drei mit lokalen Änderungen. Binärpatches und betroffene/unversionierte Dateien gesichert, regenerierbare node_modules ausgeschlossen. Git-Bundle mit lokalen und Remote-Refs unter `../s6-final-backup/`. Aktuelle Arbeitskopie `duelvanta-s6-a03` war sauber und ihr Tree identisch mit dem erwarteten Remote-Head; lokale/API-Commit-IDs unterscheiden sich wegen der dokumentierten Veröffentlichungsweise. Kein Reset, Force-Push, Branchwechsel oder Überschreiben fremder Arbeit.

Kandidat vollständig gelesen, Blob/SHA256 neu berechnet; unverändert seit technischem V38-Head. Unmittelbar vor dem einzigen Migrationsaufruf erneut Bytes der Arbeitsdatei mit `git show origin/marketplace-ux-v1:<Pfad>` verglichen und Blob/SHA256 geprüft. 133975 UTF-8-Bytes, 1229 Zeilen. Keine V35/V36/V37-Quelle verwendet.

## Frischer Live-Preflight: PASS

Supabase-Projektmetadaten bestätigen DUELVANTA-STAGING, ACTIVE_HEALTHY, Datenbankhost `db.xhmjxrcskfhbovhitdej.supabase.co`, PostgreSQL **17.6** (Projekt-Release 17.6.1.166), SQL-Rolle postgres. Sämtliche Live-Queries ausschließlich mit festem project_id Staging. Keine Production-Verbindung geöffnet, keine CLI-Umschaltung oder fremde DB-URL verwendet.

Aktuelle bestehende Preview `dpl_4W3XsD45jY75uZxUsSepbsYfAHzK`, READY, target=null, Branch marketplace-ux-v1, Commit exakt Ausgangshead. Host `duelvantav5vision-g104kqc9l-bennyescaped-3783.vercel.app`. Frischer **GET** der Runtime-Config am 23.09.2026 um 08:13:49 UTC: HTTP 200, environment=preview, ausschließlich `https://xhmjxrcskfhbovhitdej.supabase.co`. Keine Secrets oder temporären Zugangstokens in der Evidenz. Kein manuelles Deployment und keine Environment-Änderung.

Read-only Kataloginventar: **74 Tabellen, 951 Spalten, 267 Funktionen, 525 Constraints, 183 Indizes, 59 nicht-interne Trigger, 32 Policies, 14 Sequenzen, 27 Default-Privilege-Einträge**, Schema- und Tabellen-ACLs; keine expliziten Spalten-ACLs, ungültigen Indizes oder nichtvalidierten Constraints. Öffentliche und private Marketplace-Objekte einschließlich Outbox, Contract Snapshots, Stripe, Data Rights/Retention und Reservationen erfasst. Funktionseigentümer sämtlich postgres.

Extensions unverändert: pg_cron 1.6.4, pg_net 0.20.4, pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1. Relevante Anwendungsschemas einschließlich dv_market_private und public erfasst; temporäre und Plattformschemas im Zusatzinventar aufgeführt.

Alle Inventarkategorien stimmen mit dem in V38 geprüften Live-Ausgangskatalog überein. Zusätzlich Spalten, Funktionsdefinitionen/ACLs, Constraints, Trigger und Sequenzen gegen versionierte ursprüngliche Basis verglichen. Noch strenger: unabhängig offline rekonstruierte **V38-Fixture ohne Kandidat** gegen frisch live ausgeführte reine Katalogabfrage verglichen: **266/266 Fingerprints exakt, null Abweichungen**. Kein erwarteter Hash aus Live generiert. Externer Battle-Spectator-Trigger bleibt unverändert und liegt außerhalb der Legal-Tabellenauswahl.

### Zwölf erneute Indexabnahmen

Jede komplette Live-Definition stimmt exakt mit der geprüften V38-Provenienz/DDL überein. Alle gültig und ready. Exakte Spalten, Expressions und Predicates siehe versioniertes `tests/fixtures/legal-readiness/index-provenance.json` und frisches Kataloginventar.

| Index | Ergebnis |
|---|---|
| seller_account_audit_seller_idx | PASS |
| seller_review_actions_seller_idx | PASS |
| seller_declarations_seller_idx | PASS |
| seller_tax_identifiers_seller_idx | PASS |
| listing_notices_queue_idx | PASS |
| listing_notices_listing_idx | PASS |
| listing_notices_reporter_idx | PASS |
| listing_notice_appeals_queue_idx | PASS |
| listing_notice_events_notice_idx | PASS |
| account_deletion_one_open_request_idx | PASS, UNIQUE mit Status-Predicate |
| profiles_username_unique_ci | PASS, UNIQUE lower(username), username IS NOT NULL |
| profiles_founder_generation_idx | PASS, founder_generation / founder_number |

Default Privileges unverändert und verstanden: postgres/public gewährt postgres, anon, authenticated und service_role bei neuen Funktionen EXECUTE, bei Sequenzen SELECT/UPDATE/USAGE und bei Tabellen sämtliche Rechte einschließlich MAINTAIN. Im V38-Nachbau enthalten. **Keine Live-Default-Privileges verändert.**

### Altreservationen, Cleanup, Stripe und geschlossener Vorzustand

14 Listings, zwei accepted/price-Offers, acht Deals, sechs Orders, acht Contract-Snapshots. Keine pending/fixed_price-Offers, positiven oder abgelaufenen Reservationen. Null verwaiste Offers, negative/fehlende/ungültige angefragte Mengen, widersprüchliche Reservierungen, Reservierungen mit Deal oder Rückführungsüberläufe. Listing quantity_available/stock_quantity konfliktfrei. Vorhandene Snapshot-Klassifikationen/Payment-Provider mit den neuen Constraints kompatibel. Keine Datenreparatur und kein Cleanup ausgeführt.

`expire_market_offer_reservations_v1()` vorhanden; service_role EXECUTE bestätigt. Kandidat bewahrt Signatur und Aufrufbarkeit. Kein Scheduler angelegt. Neue Readiness, frühere get_my_market_buyer_profile und die sechs neuen Käufer-RPCs fehlen vor Migration erwartungsgemäß. Daher kein unerwartetes compatible=true. Guard 1.2 schließt bei fehlender RPC; die 42 isolierten Guard-Assertions wurden erneut bestanden. Kein angemeldeter Vorzustands-UI-Test behauptet, kein Marker oder Bypass.

Stripe frisch aus DB: **sandbox_enabled=false, live_mode=false, seller_invoice_issuance_enabled=false**. Keine Stripe-API/-Schlüssel, Checkout Session, Zahlung, Erstattung oder Auszahlung.

### Compliance-E-Mail – manueller Nachweis akzeptiert

**COMPLIANCE_EMAIL_DELIVERY_ENABLED = unset, manuell im Vercel-Dashboard bestätigt.** Nutzerbestätigung vom 23.09.2026: Projekt duelvanta_v5_vision, Settings → Environment Variables, All Environments, Suche COMPLIANCE → No Results Found; zusätzlich Shared Environment Variables ohne COMPLIANCE_EMAIL_DELIVERY_ENABLED. Dies ist ausdrücklich **kein durch Connector/API gelesener Wert**. Die unveränderte Dispatcher-Logik aktiviert Versand nur beim exakten Wert `true`; unset bleibt default-off. Keine Variable angelegt/verändert/gelöscht, keine POST-Probe, kein Dispatch-Secret, keine Test-E-Mail.

Entscheidungstor Phasen 1–9: PASS auf Basis des frischen Katalog-/Daten-/Zielnachweises, fail-closed-Logik und ausdrücklich akzeptierter manueller E-Mail-Evidenz. Angemeldete UI-Integration folgt separat nach Migration und war bereits als zugriffsabhängig kenntlich gemacht.

## Einzige kontrollierte SQL-Ausführung

Supabase `apply_migration`, project_id exakt Staging, Name `trade_legal_contract_model_v1`, Query exakt vollständige gehashte Kandidatendatei. Unmittelbar vorher Projekt erneut bestätigt und beide Hashes geprüft. Rückgabe **success=true**, kein SQL-Fehler, keine Fortsetzung nach Fehler und keine Reparatur.

Persistierte Migration History: Version **20260923081953**, Name **trade_legal_contract_model_v1**. Der Tool-Zeitstempel unterscheidet sich vom ursprünglichen Dateinamen; Inhalt blieb exakt der freigegebene Kandidat. Keine zweite Migration angewandt. Vollständige ausgeführte SQL-Quelle bleibt unter oben genanntem versioniertem Pfad/Blob; Aufrufmetadaten, Ergebnis und History liegen im Evidenzordner. Das Tool liefert keine Einzelstatement-Logs; diese werden nicht erfunden.

## Post-Migrations-Schemaabnahme: PASS

Neues read-only Inventar: **76 Tabellen, 987 Spalten, 280 Funktionen, 540 Constraints, 191 Indizes, 61 Trigger, 33 Policies**, weiterhin 14 Sequenzen und 27 unveränderte Default-Privilege-Einträge. Null ungültige Indizes, null nichtvalidierte Constraints. Schema-ACLs, Sequenzen und Default Privileges unverändert; keine expliziten Spalten-Grants.

**266/266 Live-Fingerprints exakt zum eingefrorenen V38-Kandidatensoll.** Tatsächlicher Live-Katalog-SHA256 selbst berechnet:

`f8e0e4cf5e000d60776a26e5bbd5275318fde632d8e3f55c5bd9a6cf42a33604`

Damit erwartete Spalten/Typen/NOT NULL, Constraints/FKs/Indizes, Immutable-/Reservation-Trigger, RLS, relevante Rollenrechte, Funktionssignaturen/-Owner/-Körper sowie private Grenze und Offer-Policies abgenommen. Alle sonstigen bestehenden Policies unverändert; nur offers_delete_buyer wie vorgesehen geändert und offers_delete_unreserved_only ergänzt. Bestehende Trigger unverändert, Reservation-Delete-Guard und Withdrawal-Immutable-Trigger ergänzt.

Vertrags-/Preisangebots-/Festpreis-/Widerrufs-/Outbox- und Data-rights-/Retention-Abhängigkeiten entsprechen dem Soll. Datenexport nicht aufgerufen, da die Export-RPC selbst Auditdaten schreibt. Keine tatsächliche Deletion/Retention-Verarbeitung ausgelöst.

Sechs Käufer-RPCs und Readiness: Owner postgres; authenticated EXECUTE=true, anon=false, service_role=false, kein PUBLIC EXECUTE. Retired buy_market_listing_v3, checkout_accepted_market_offer_v1 und create_market_offer_v2: Browser-EXECUTE entzogen; vorhandene service_role-Rechte bleiben exakt gemäß Kandidat. Service-only Release/Accept sind im Katalog-Soll verifiziert. Cleanup-Aufrufrecht weiterhin vorhanden, Cleanup nicht ausgeführt. **Null private Tabellen mit SELECT/INSERT/UPDATE/DELETE für anon oder authenticated; private Schema-USAGE weiterhin false.**

Anwendungszahlen unverändert (14/2/8/6/8); neue Withdrawal-Drafts und Withdrawals jeweils null. Bestehende Snapshot-Versionen unverändert: sieben C2C und ein B2C, alle checkout-contract-v1. Keine Alt-Snapshots automatisch widerrufsberechtigt gemacht. Stripe-Konfiguration weiterhin vollständig OFF.

## Echte Staging-Readiness: PASS

Am 23.09.2026 um **08:20:05 UTC** auf echtem Staging:

```json
{"revision":"trade-legal-contract-model-v1.2","compatible":true}
```

Anschließend ebenfalls in `BEGIN READ ONLY; SET LOCAL ROLE authenticated` bestätigt; transaction_read_only=on, private Schema-USAGE=false. Dieser Rollencheck ist eine echte Datenbankberechtigungsprüfung, **kein tatsächlicher Benutzerlogin**. Keine Marker gesetzt.

## Guard und sichere Integration: Grenzen ausdrücklich offen

Exakter Guard 1.2 wurde lokal mit dem frisch erhaltenen echten Staging-Ergebnis ausgewertet: verfügbar=true; falsche Revision, Fehler, Timeout und unerwartete Antwort jeweils false. Fünf Fälle PASS, separat von der V38-Chromium-CI dokumentiert. Keine simulierte Antwort in die Live-Preview eingeschleust.

**Live-Guard-/Loader-UI und angemeldete Integration BLOCKIERT:** Runtime-Config war live lesbar, die Landingpage kurz sichtbar. Der weiterführende Preview-/Loginzugriff führte trotz autorisiertem temporärem Vercel-Zugriff zur Vercel-Anmeldung; keine angemeldete DUELVANTA-Testsession vorhanden. Keine Zugangsdaten im Chat, keine Session-Tokens ausgelesen oder Schutzkonfiguration verändert. Daher keine erfolgreiche Login-/Profil-/Order-/Bestellnachweis-UI-Abnahme behauptet.

| Angeforderte Integration | Tatsächlicher Nachweis / Grenze |
|---|---|
| Preview ausschließlich Staging | Runtime GET PASS |
| Login / Profil | BLOCKIERT: keine authentisierte Preview-Testsession |
| bestehende Orders / Bestellbestätigungen | Datenbestand vorhanden; UI BLOCKIERT |
| Guard öffnet wegen echter Readiness / Loader | RPC und Guard-Auswertung PASS; tatsächliche angemeldete Preview-UI BLOCKIERT |
| kompatible Preisangebote / kein zweiter Checkout | null neue price-offer-contract-v1-Snapshots; sicherer passender Live-Testzustand fehlt, BLOCKIERT |
| Festpreis-UI neuer Review-/Reservation-Pfad | V38-CI bleibt gültig; Live-UI BLOCKIERT, keine Reservierung/Kauf erzeugt |
| Widerruf für berechtigten B2C-Snapshot | null berechtigte bestehende Snapshots, BLOCKIERT |
| C2C ohne Widerrufsaktion | sieben alte C2C-Snapshots nicht berechtigt; tatsächliche UI BLOCKIERT |
| privater Browser-Direktzugriff | DB-Grants/Schema-Grenze PASS; angemeldeter Browserversuch BLOCKIERT |
| Stripe / E-Mail | DB weiterhin OFF / manuell bestätigtes unset; keine Provider-Aktion |

Keine neuen wirtschaftlichen Testzustände angelegt. Fehlende Live-Integrationsnachweise werden nicht durch CI oder SQL-Rollenwechsel ersetzt.

## CI, Repository und Abschlussgrenze

Keine Anwendungscode-, Test- oder Migrationsänderung in diesem Block. Daher keine neue technische CI erforderlich. **V38 bleibt technischer Kandidatennachweis:** Scanner V16 #685 / Run 35832063879 und Battle WebRTC #161 / Run 35832063873 SUCCESS, einschließlich nativer PG17-Readiness mit 109 Checks und Reservation-Parallelität. Diese Läufe werden nicht als Live-Migrationsnachweis umetikettiert. Dieser Bericht/V39 und Evidenz sind reine Dokumentationsänderungen.

main unverändert; PR #5 offen, Draft und unmerged. Production durch diesen Block unverändert: keine Verbindung, Migration oder Deployment; keine Aussage über fremde externe Änderungen. Kein Merge, keine Stripe-Live-Aktivierung, echten Payments/Refunds/Payouts oder Compliance-E-Mails. Keine Rechts-, Produktions-, Stripe-Live-, Merge- oder kommerzielle Freigabe.

**SQL-/Schema-Migration erfolgreich, Gesamtabschluss wegen offener Live-Integration nicht festgestellt. Nach V39 STOP.** Folgender separat autorisierter Nachtest darf ausschließlich sichere vorhandene Zustände nutzen; Migration nicht erneut anwenden.

Evidenz: `evidence/legal-step6-final-20260923/` (Pre-/Post-Katalog datenfrei komprimiert, Queryquellen, unabhängiger Basisvergleich, Entscheidungstor, SQL-Ergebnis/History, Live-Readiness, Rollenrechte, Datenaggregate und Guard-Auswertung).
