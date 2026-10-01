# DUELVANTA – Schritt 6: kontrollierter Staging-Migrationsversuch
Stand: 23.09.2026 · Branch ausschließlich `marketplace-ux-v1`

**STOP vor Migration. Frischer Preflight nicht bestanden. Keine Legal-Migration auf Staging ausgeführt. Der exakte V36-Kandidat ist wegen reproduzierbarer Katalog-/Readiness-Abweichungen nicht für diese Live-Basis freigegeben. Zusätzlich bleibt Compliance-E-Mail-OFF unbestätigt. Schritt 6 ist NICHT technisch abgeschlossen.**

## 1. Git, Kandidat und Sicherung

| Bezug | Frisch verifizierter Wert |
|---|---|
| Ausgangs-Remote-Head | `ffc9d5a6d338f640be712cab0e31f1a9e319e627` |
| Technischer Kandidatenhead | `b89cecc22e7eb2eb80716078a29584f383dd653e` |
| Finaler technischer Stand dieses Blocks | unverändert `b89cecc22e7eb2eb80716078a29584f383dd653e`; keine Anwendungscode-/SQL-Änderung |
| Dokumentationsbasis | `ffc9d5a6d338f640be712cab0e31f1a9e319e627`; abschließender Veröffentlichungshead ist der Commit dieses Berichts/V37, separat im Abschluss ausgewiesen |
| main | `50f88213571be13255bb52eb489cc28cca660001` |
| Migration | `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql` |
| Git-Blob | `f1714dc1b5fc9ebeab0dbff5c974ac1696dc28ef` |
| SHA256 | `a02e01bba93bda7e942850e776410fae1d752edb629b80319d9970859270d25f` |
| Staging | `xhmjxrcskfhbovhitdej` |
| Production – ausschließlich Negativgrenze | `enifiaqsnqtbzylnfrpi` |

V36 und Blocker-Fixbericht vollständig gelesen, alter Preflight ausschließlich historisch eingeordnet. Remote-Head exakt erwartet. Zwischen technischem Head und Remote liegen nur sechs Dokumentations-/Evidenzdateien. Die Migration ist unverändert, 1229 Zeilen, vollständig geprüft; Blob und SHA256 lokal berechnet. Der fehlerhafte V35-Kandidat wurde nicht verwendet.

15 Arbeitskopien/Worktrees einschließlich der neuen isolierten Kopie inventarisiert. Drei enthalten lokale/unversionierte Änderungen; Patches und betroffene Dateien gesichert, reproduzierbare node_modules ausgeschlossen. Aktuelle Git-Historie zusätzlich als Bundle gesichert. Lokales Inventar/Sicherungen: `/workspace/scratch/2c6fd056f27a/backup/`. Alte Kopien unverändert; kein Reset, Force-Push oder Branchwechsel.

## 2. Live-Environment und Zugriff

Supabase-MCP `get_project` bestätigt DUELVANTA-STAGING, ACTIVE_HEALTHY, Host `db.xhmjxrcskfhbovhitdej.supabase.co`, Engine 17, Release 17.6.1.166. SQL `server_version` ist **17.6**, Rolle postgres. Alle drei Live-SQL-Abfragen waren ausdrücklich `BEGIN READ ONLY … COMMIT` mit festem project_id `xhmjxrcskfhbovhitdej`. Keine CLI-/DB-URL-Umschaltung; keine Production-Verbindung.

Extensions: pg_cron 1.6.4, pg_net 0.20.4, pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1.

Aktuelle Vercel-Preview: `dpl_y9q3HB7ADR4tUeGVkLxWz9JaRQdW`, READY, target=null, Branch marketplace-ux-v1, Commit exakt Ausgangshead. URL:
`https://duelvantav5vision-7uvjqqbbh-bennyescaped-3783.vercel.app`

Nach autorisiertem temporärem Vercel-Preview-Zugriff liefert GET `/api/compliance-message-dispatch?runtime_config=1` HTTP 200 mit `environment=preview` und ausschließlich `https://xhmjxrcskfhbovhitdej.supabase.co`. Die Landingpage ist im Browser sichtbar. Temporäre Zugangstokens/Cookies wurden nicht in Evidenz oder Repository übernommen. Es wurde kein Deployment erstellt und keine Environment-Variable geändert. Die früheren 302-Antworten waren Zugriffsschutz, kein Routing-PASS; maßgeblich ist der tatsächlich gelesene 200-Config-Body.

## 3. Frischer Live-Katalog und neuer Blocker S6-A03

Inventar: 74 Tabellen/RLS-/ACL-Einträge, 951 Spalten, 267 Funktionen mit vollständigen Definitionen/ACLs, 525 Constraints, 59 nicht-interne Trigger, 14 Sequenzen, 183 Indizes, 32 Policies, zwei Schema-ACLs und 27 Default-Privilege-Einträge. Keine expliziten Spalten-ACLs; keine ungültigen Indizes oder nichtvalidierten Constraints gefunden. Gesichert datenfrei unter `evidence/legal-step6-staging-20260923/staging-catalog.json.gz`.

Gegen die versionierte Baseline stimmen sämtliche Spalten, Funktionsdefinitionen/-ACLs, Constraints, Trigger, Sequenzen, Tabellen-RLS/-ACLs und Schema-ACLs überein. Nur die Schemaqualifikation `public.` und ACL-Reihenfolge wurden zum Vergleich normalisiert. Keine Sollhashes neu generiert.

**Die V36-Rekonstruktion ist für den tatsächlichen Katalog unvollständig:**

1. Die Fixture enthält 120 Indexdefinitionen, Live besitzt 183. Primär-/Unique-Constraints rekonstruieren einen Teil der übrigen Indizes; zwölf zusätzliche eigenständige Indizes beeinflussen jedoch neun Tabellen im Readiness-Soll. Darunter sind Notice-/Seller-/Deletion-Indizes, die bereits in versionierten SQL-Dateien beschrieben sind. Zwei Profile-Indizes sind live vorhanden, aber ihre Herkunft wurde nicht im Repository gefunden; keine automatische Drift-Freigabe.
2. Live gilt für neue Funktionen von postgres im Schema public ein Default-EXECUTE-Grant an anon, authenticated und service_role. Die Fixture bildet diese Default-Privileges nicht nach. Die Migration widerruft bei sechs neuen Käufer-RPCs PUBLIC/anon und erteilt authenticated, entzieht jedoch nicht das geerbte direkte service_role-Grant. Daher stimmen die effektiven RPC-Rechte nicht mit den eingefrorenen V36-Sollhashes überein.

Betroffene Tabellen: `account_deletion_requests`, `listing_notice_appeals`, `listing_notice_events`, `listing_notices`, `seller_account_audit`, `seller_declarations`, `seller_review_actions`, `seller_tax_identifiers` (jeweils dv_market_private) sowie `public.profiles`.

Betroffene neue RPCs: `review_market_price_offer_v1`, `create_market_offer_v3`, `get_my_market_withdrawable_contracts`, `prepare_fixed_price_market_offer_v1`, `prepare_market_withdrawal_v1`, `confirm_market_withdrawal_v1`.

Zusätzliche eigenständige Indizes: `seller_account_audit_seller_idx`, `seller_review_actions_seller_idx`, `seller_declarations_seller_idx`, `seller_tax_identifiers_seller_idx`, `listing_notices_queue_idx`, `listing_notices_listing_idx`, `listing_notices_reporter_idx`, `listing_notice_appeals_queue_idx`, `listing_notice_events_notice_idx`, `account_deletion_one_open_request_idx`, `profiles_username_unique_ci`, `profiles_founder_generation_idx`.

Die zehn nicht auf profiles liegenden Definitionen sind in `database/market-seller-compliance-v1.sql`, `database/market-notice-action-v1.sql` und `database/account-data-rights-v1.sql` auffindbar. Dies erklärt eine Fixture-Lücke, ersetzt aber keine vollständige Abnahme der beiden Profile-Indizes oder des gesamten Live-Katalogs.

### Isolierter diagnostischer Nachweis

Unveränderten Kandidaten ausschließlich in vier lokalen In-Memory-PGlite-Datenbanken auf datenfrei rekonstruierter Basis ausgeführt. Keine Nutzerzeilen, keine Netzwerk-/Staging-Mutation, keine Änderung der erwarteten Hashes.

| Lokale Rekonstruktion | Readiness | Abweichungen |
|---|---|---|
| unveränderte V36-Fixture + exakter Kandidat | compatible=true | 0 |
| zusätzlich tatsächlich gelesene Live-Indizes | compatible=false | 9 Tabellen |
| zusätzlich tatsächlich gelesene public-Funktions-Default-Grants | compatible=false | 6 RPCs |
| beide Ergänzungen | compatible=false | 15 insgesamt |

Revision in allen Fällen `trade-legal-contract-model-v1.2`. Reproduktion und vollständige Ergebnisse liegen im Evidenzordner. Grenze: lokale PGlite-Diagnose, **kein neuer nativer PG17-/Parallelitätsnachweis und keine echte Post-Migrations-Staging-Readiness**. Der bestehende externe Battle-Spectator-Trigger bleibt wie in der ursprünglichen Fixture außerhalb des lokalen Nachbaus. Die 15 Abweichungen sind isoliert; weitere Abweichungen wurden dadurch nicht ausgeschlossen.

**Entscheidung: STOP.** Keine Indizes entfernen, keine Live-Default-Privileges ändern, keine Sollhashes aus Live übernehmen, keine zweite Migration erfinden. S6-A01 wird durch diesen Befund nicht als erneut offen erklärt; der neue Blocker betrifft die vollständige Schema-Kompatibilität S6-A03.

## 4. Altreservationen, Cleanup und Stripe

Read-only: 14 Listings, zwei Offers (beide accepted/price), acht Deals, sechs Orders, acht Contract-Snapshots. Keine pending-/fixed_price-Offers, keine positiven Reservierungsmengen und keine abgelaufenen Offer-Reservationen. Null verwaiste Offers, negative/fehlende/unmögliche Listing-Mengen, widersprüchliche positive Reservierungsmengen, überlaufende Mengenrückführungen oder Reservationen mit vorhandenem Deal.

Diese Mengenprüfung zeigt keinen Altreservierungsblocker; sie ist keine vollständige wirtschaftliche Abstimmung aller historischen Orders. Kein Cleanup ausgeführt. `expire_market_offer_reservations_v1()` existiert, service_role besitzt EXECUTE. Der Kandidat erhält Signatur und ACL dieser bestehenden Funktion und verwendet den vorhandenen Cleanup-Pfad; kein Scheduler angelegt.

Frisch gelesene Datenbankkonfiguration: `sandbox_enabled=false`, `live_mode=false`, `seller_invoice_issuance_enabled=false`. Keine Stripe-Schlüssel gelesen/verwendet, keine Checkout Session und kein Stripe-API-Aufruf. Kein Payment, Refund oder Payout. Ein vollständiger externer Deployment-Schalterabgleich für Stripe wird wegen des gestoppten Preflights nicht behauptet; die Datenbank-OFF-Grenze ist nachgewiesen.

## 5. Compliance-E-Mail: OFF weiterhin BLOCKIERT

Die bereitgestellten Vercel-Connector-Funktionen liefern keinen tatsächlichen Environment-Wert von `COMPLIANCE_EMAIL_DELIVERY_ENABLED`; eine vorhandene authentisierte Dashboard-/CLI-Sitzung stand nicht zur Verfügung. Code-default-off ist kein Live-OFF-Nachweis.

Eine geplante Statusprobe per POST ohne Dispatch-Authorization wurde durch die **automatische Freigabeprüfung abgelehnt**, weil der Dispatcher möglicherweise E-Mails auslösen könnte. Keine Wiederholung oder Umgehung. Kein erfolgreiches Probe-Ergebnis vorhanden; insbesondere wird weder aus einer 401 noch aus einer fehlenden Ergebnisdatei ein OFF-Zustand abgeleitet. Kein Dispatch-Secret gelesen, keine Zustell-RPC aufgerufen, keine Test-E-Mail versandt.

Für einen Folgeblock ist ein read-only Nachweis des tatsächlichen Deployment-/Environment-Werts erforderlich. Dieser Auftrag hat keine Änderung oder Aktivierung der Zustellung vorgenommen.

## 6. Readiness, Guard, Integration und Phasenstatus

Live fehlen erwartungsgemäß sowohl `get_market_legal_schema_readiness_v1()` als auch die frühere `get_my_market_buyer_profile()`; keine alte RPC kann hier TRUE liefern. Guard 1.2 bleibt nach seiner geprüften fail-closed-Logik geschlossen. Kein angemeldeter Live-Guard-Nachtest, keine manuelle Freigabemarkierung.

| Phase | Ergebnis |
|---|---|
| 1 Git/Sicherung | PASS |
| 2 Kandidatenquelle | PASS |
| 3 Environment | Staging-Projekt und ausgelieferte Preview-Runtime PASS; kein Production-Zugriff |
| 4 Live-Katalog | **FAIL/BLOCKIERT: S6-A03, 15 isolierte Readiness-Abweichungen** |
| 5 Altreservationen | ausgeführte Mengen-/Existenzprüfungen ohne Konflikt |
| 6 Cleanup | Signatur/Service-Aufrufrecht read-only bestätigt; nicht ausgeführt |
| 7 Stripe/E-Mail | Stripe-Datenbank OFF; E-Mail-OFF **BLOCKIERT**; Gesamtgate nicht PASS |
| 8 Pre-Readiness | neue/alte RPC fehlt; erwarteter geschlossener Zustand; angemeldeter Guard-Test BLOCKIERT |
| 9 Entscheidung | STOP, keine Migrationsfreigabe |
| 10 SQL-Migration | NICHT AUSGEFÜHRT; null DDL/DML auf Staging |
| 11 Schema-/Grant-/Policy-Abnahme nach Migration | BLOCKIERT; kein Post-Migrationszustand |
| 12 echte Staging-Readiness | BLOCKIERT; keine installierte RPC, kein compatible=true behauptet |
| 13 angemeldete Integration | BLOCKIERT; nur Landingpage/Runtime-Zugriff geprüft |
| 14 neue technische CI | nicht erforderlich; Anwendungscode, Migration und Tests unverändert |
| 15 Bericht/V37 | dokumentiert ausschließlich kontrollierten Stopp |

Nicht ausgeführt: Login, Profil-/Order-/Bestellnachweis-Lesetests, kompatible Preisangebote, neuer Festpreis-Review, Widerrufs-/C2C-UI und privater Browser-Direktzugriff im Post-Migrationszustand. Keine sicheren Testzustände künstlich ergänzt. Vorhandene Datenzahlen beweisen nicht, dass geeignete B2C-/neue Preisangebotssnapshots für diese Nachtests vorhanden sind.

Kein SQL-Ausführungsfehler und kein Migrationsteilzustand: Die Migration wurde nie gestartet. Es gibt folglich keine erfolgreiche Schema-, Grant-, Policy- oder Live-Integrationsabnahme dieses Kandidaten.

## 7. CI und unveränderte Grenzen

Frisch über GitHub erneut bestätigt, auf technischem Head `b89cecc22e7eb2eb80716078a29584f383dd653e`:

| Workflow | Run | Ergebnis |
|---|---|---|
| Scanner V16 #682 | 35786444298 | SUCCESS |
| Battle WebRTC #158 | 35786443880 | SUCCESS |

Dies bleibt historische technische Regression gemäß V36, **kein Live-Migrationsnachweis**. Keine neue technische Änderung, kein Test abgeschaltet, keine Reparatur umgesetzt. Automatische Läufe auf dem nachfolgenden Dokumentationscommit sind ebenfalls keine Migrationsabnahme.

main unverändert; PR #5 frisch als open/draft=true/merged=false bestätigt. Production durch diesen Block unverändert: keine Verbindung, SQL-Abfrage, Mutation, Aktivierung oder Deployment dorthin. Keine Aussage über fremde externe Production-Drift. Keine echten Marketplace-Vorgänge, Payments, Refunds, Payouts, Widerrufe oder Compliance-E-Mails erzeugt. Stripe Live nicht aktiviert. Kein Merge und kein manueller Deploy.

## 8. Fortsetzungsgrenze

Nach V37 STOP. Ein separater Fixauftrag muss zuerst die unvollständige Katalogfixture/Indexbasis und expliziten neuen RPC-Rechte prüfen, die Profile-Indizes einordnen, den Kandidaten kontrolliert korrigieren und vollständige native PG17-/CI-Nachweise erneuern. Erwartungswerte erst aus fachlich geprüfter vollständiger Basis erzeugen, nicht aus unerklärter Live-Drift. Zusätzlich E-Mail-OFF read-only am tatsächlichen Deployment nachweisen.

Danach neuer vollständiger frischer Preflight mit neuem Kandidatenhash; keine Anwendung des jetzigen Kandidaten im Rahmen dieses Blocks. Keine Produktions-, Rechts-, Stripe-Live- oder kommerzielle Freigabe.
