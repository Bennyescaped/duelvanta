# DUELVANTA – Schritt 6: S6-A03 Katalog-/Readiness-Fix

Stand 23.09.2026. **S6-A03 technisch geschlossen, vollständige verpflichtende CI erfolgreich. E-Mail-OFF live weiterhin BLOCKIERT. Keine Legal-Migration auf Staging angewandt.**

## Basis und Grenzen

V37, Staging-Migrationsbericht, V36 und Blocker-Fixbericht vollständig gelesen. Ausgangs-Remote-Head exakt `de7a121f01560d372fe12553a0f6acdad6ef1b36`; darunter technischer V36-Head `b89cecc22e7eb2eb80716078a29584f383dd653e`. Finaler technischer Remote-Head dieses Fixes: `91bad0f6546d579f4d8adc99f26027e45a36e891`. Der anschließende Dokumentationscommit enthält diesen Bericht, V38 und Evidenz, keine weitere technische Änderung.

Repository `Bennyescaped/duelvanta`, ausschließlich `marketplace-ux-v1`. 15 vorbestehende Arbeitskopien inventarisiert, drei mit lokalen Änderungen gesichert (Patches/unversionierte Dateien; regenerierbare node_modules ausgeschlossen), Git-Bundle der bisherigen lokalen/Remote-Stände. Neue isolierte Arbeitskopie direkt auf demselben Branch. Kein Reset, Force-Push, Branchwechsel oder Überschreiben fremder Änderungen. Lokaler technischer Commit und API-Veröffentlichungscommit haben unterschiedliche Commit-IDs, aber denselben geprüften Tree `00f57a4e7a96f584a73c01523bd49d36eb3b1794`.

Live ausschließlich read-only gegen Staging `xhmjxrcskfhbovhitdej`, PostgreSQL **17.6**. Production `enifiaqsnqtbzylnfrpi` ausschließlich Negativgrenze, keine Verbindung geöffnet. Historisches Backup offline gelesen; dies ist kein Production-Zugriff.

## Alle zwölf Indizes fachlich eingeordnet

Exakte frische PostgreSQL-Definitionen, UNIQUE, Expression, Predicate, Owner und Validität stehen versioniert in `tests/fixtures/legal-readiness/index-provenance.json`; identische datenfreie DDL in `reviewed-baseline-indexes.sql`. Alle zwölf sind gültig, ready, Owner postgres, B-tree und eigenständige Anwendungsindizes, keine automatisch entstandenen Constraint-Indizes.

| Index | Tabelle / Schlüssel | UNIQUE / Predicate | Herkunft / Zweck |
|---|---|---|---|
| seller_account_audit_seller_idx | dv_market_private.seller_account_audit: seller_id, changed_at DESC | nein / keines | Seller-Basis; zeitliche Audit-Historie |
| seller_review_actions_seller_idx | dv_market_private.seller_review_actions: seller_id, created_at DESC | nein / keines | Seller-Basis; Review-Historie |
| seller_declarations_seller_idx | dv_market_private.seller_declarations: seller_id, declaration_kind, accepted_at DESC | nein / keines | Seller-Basis; Erklärungshistorie |
| seller_tax_identifiers_seller_idx | dv_market_private.seller_tax_identifiers: seller_id | nein / keines | Seller-Basis; private Steuerdatenzuordnung |
| listing_notices_queue_idx | dv_market_private.listing_notices: status, submitted_at | nein / keines | Notice-Basis; Bearbeitungsqueue |
| listing_notices_listing_idx | dv_market_private.listing_notices: listing_id, submitted_at DESC | nein / keines | Notice-Basis; Meldungen zum Listing |
| listing_notices_reporter_idx | dv_market_private.listing_notices: reporter_user_id, submitted_at DESC | nein / keines | Notice-Basis; Meldungshistorie |
| listing_notice_appeals_queue_idx | dv_market_private.listing_notice_appeals: status, submitted_at | nein / keines | Notice-Basis; Einspruchsqueue |
| listing_notice_events_notice_idx | dv_market_private.listing_notice_events: notice_id, created_at, id | nein / keines | Notice-Basis; geordnete Ereignishistorie |
| account_deletion_one_open_request_idx | dv_market_private.account_deletion_requests: user_id | ja / status IN requested, processing, retained | Data-rights-Basis; höchstens ein offener Antrag je Nutzer |
| profiles_username_unique_ci | public.profiles: lower(username) | ja / username IS NOT NULL | historisches Basisschema; Groß-/Kleinschreibung ignorierende Namenseindeutigkeit |
| profiles_founder_generation_idx | public.profiles: founder_generation, founder_number | nein / keines | historisches Basisschema; Founder-Generations-/Nummernzugriff |

Seller-Quelle: `database/market-seller-compliance-v1.sql`, ursprünglicher Commit `3009277835156234b035fe03345ef815f2deacf2`. Notice-Quelle: `database/market-notice-action-v1.sql`, Commit `2e024e1d6d73ebd76f1b15c486fc2fa3b76fb76f`. Data-rights-Quelle: `database/account-data-rights-v1.sql`, Commit `163deba63d820d69b0aa890e467d59df89f1fd93`. Die zehn Indizes sind legitime versionierte Compliance-Erweiterungen der Staging-Basis und fehlten nur im vollständigen Readiness-Nachbau.

**Beide Profile-Indizes geklärt:** Ihre exakten CREATE-INDEX-Definitionen existieren bereits im gesicherten ursprünglichen Basisschema vom 11.09.2026: `DUELVANTA-Code-Datenbank-Backup-2026-09-11.zip`, Member `DUELVANTA-Backup-2026-09-11/database/restore.sql`. Archiv-SHA256 `fabe245a4448b3518d0eab1194b07c80668bb9a810da31bafffef62eab8a07f0`; Member-SHA256 `4013ebacf054200b3592177c8cad998d54dad460b2ffe378295fc01412fa5ef9`, gegen enthaltenes SHA256SUMS verifiziert. Release-Metadaten binden den Stand an main `50f88213571be13255bb52eb489cc28cca660001`. Restore-Anleitung und Auditbericht wurden mitgelesen. Keine unbekannte aktuelle Drift: bereits vor Einrichtung der Staging-Basis vorhanden. Frühester belegter Zeitpunkt ist dieses Backup; ursprünglicher Ersteller und ursprüngliches Erstellungsdatum werden nicht behauptet. Nur zwei DDL-Statements und Herkunftsmetadaten übernommen, keine Nutzerdaten/Backups ins Repository kopiert.

## Default Privileges und explizite Endrechte

Frisch aus pg_default_acl read-only geprüft: Ersteller postgres, Schema public, Rollen postgres/anon/authenticated/service_role jeweils Funktionen EXECUTE (`X`), Sequenzen SELECT/UPDATE/USAGE (`rwU`), Tabellen SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN (`arwdDxtm`). Keine Grant Option. Die für den Kandidaten relevanten Defaults werden in `reviewed-default-privileges.sql` rekonstruiert. Plattforminterne andere Schemas werden nicht als benötigte Kandidatenbasis ausgegeben.

Die Fixture lädt diese Defaults nach Wiederherstellung der bestehenden ACLs und vor dem Kandidaten: bestehende Rechte bleiben historisch korrekt, neue Objekte erhalten realistische Startrechte. **Kein ALTER DEFAULT PRIVILEGES auf Staging ausgeführt.**

| RPC | authenticated | anon / PUBLIC | service_role | fachliche Begründung |
|---|---|---|---|---|
| review_market_price_offer_v1 | EXECUTE | entzogen | entzogen | Prüfung im tatsächlichen Käuferkontext |
| create_market_offer_v3 | EXECUTE | entzogen | entzogen | bindendes eigenes Käuferangebot |
| get_my_market_withdrawable_contracts | EXECUTE | entzogen | entzogen | ausschließlich eigene berechtigte Verträge |
| prepare_fixed_price_market_offer_v1 | EXECUTE | entzogen | entzogen | Käuferprüfung/Reservierung; Backend reicht Benutzer-Token durch |
| prepare_market_withdrawal_v1 | EXECUTE | entzogen | entzogen | eigener B2C-Snapshot |
| confirm_market_withdrawal_v1 | EXECUTE | entzogen | entzogen | bestätigte eigene Widerrufserklärung |
| get_market_legal_schema_readiness_v1 | EXECUTE | entzogen | entzogen | angemeldeter Guard; explizite gleiche Grenze |

Jeweils explizit `REVOKE ALL ... FROM public,anon,authenticated,service_role`, danach genau `GRANT EXECUTE ... TO authenticated`. Owner postgres bleibt Owner. Keine zufälligen service_role-Rechte. Bestehende Backend-RPCs release_fixed_price_market_offer_v1 und accept_fixed_price_market_offer_v1 bleiben ausschließlich service_role zugänglich, ebenfalls geprüft. Geschäftskörper und Reservierungslogik unverändert.

## Reproduzierbares Soll und Kandidat

Fixture weiterhin datenfrei. Zwölf geprüfte Indexdefinitionen ergänzen den bisherigen Indexsatz. Generierung ausschließlich aus versionierter Basis plus Kandidat, keine aus Live übernommenen Sollhashes. `tests/generate-legal-readiness.mjs --check`: PASS, 64 Tabellen, 201 Funktionsnamen, 266 Katalogchecks. Im generierten Soll ändern sich genau neun Tabellenfingerprints; die sechs Funktions-Endrechte entsprechen wieder dem bereits vorgesehenen Soll.

Revision bleibt **trade-legal-contract-model-v1.2**, Guard-Version **1.2**: unveränderte Schnittstelle und unverändertes fachliches Vertragsmodell; korrigiert wurden Basisvollständigkeit und explizite ACL-Herstellung. Katalog-SHA256 aus nativem Test: `f8e0e4cf5e000d60776a26e5bbd5275318fde632d8e3f55c5bd9a6cf42a33604`.

Einziger Kandidat: `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`.

- Neuer Git-Blob: `c7b5df68a6d4dd37804e0efd59f9a076957b3dc8`.
- Neuer SHA256: `c7d061943629d692ada147ba27c9909105507929756deacc6a3a8cedb259b5c6`.
- 1229 Zeilen, 133975 Bytes. Vollständige Quelle und Änderungen geprüft: außerhalb des generierten Katalogblocks ausschließlich sieben explizite Rollen-REVOKEs; Geschäftskörper unverändert.
- V36/V37-Hash `a02e01bba93bda7e942850e776410fae1d752edb629b80319d9970859270d25f` ist historisch und nicht mehr aktueller Kandidat. V35-Hash ebenfalls weiterhin gesperrt.

## Native PostgreSQL-17-Abnahme und vollständige CI

Lokale PGlite-Readiness 109 Checks PASS, Guard 42 Assertions PASS, deterministischer Generator PASS. Zusätzlich **echtes PostgreSQL 17.11** im isolierten CI-Service, server_version_num=170011, Readiness 109 Checks PASS. Alle zwölf Indexdefinitionen einschließlich UNIQUE/Predicate/Expression/valid/ready, Defaults, endgültigen RPC-Rechte und Kataloghash geprüft. Revision im Test strikt geprüft. Exakte Basis + Kandidat compatible=true, Basis ohne Kandidat und korrumpierte Zustände fail-closed.

Isolierte negative Fälle bestanden: jeder der zwölf Indizes fehlt; unerwarteter relevanter Index; service_role-/anon-Grant bzw. authenticated-Revoke für jede der sechs RPCs; falscher Funktionskörper, Owner und echte falsche Signatur; Constraint/FK, Trigger, RLS, private Schema-/Tabellen-/Spaltenrechte, direkte Backend-Mutation, Offer-Policy, retired RPC und Teilzustand ohne Kandidat. Jeder wiederhergestellte Sollzustand erneut true. Keine Schutzprüfung gelockert oder entfernt.

| Workflow | Run | Jobs | Ergebnis |
|---|---|---|---|
| Scanner V16 #685 | 35832063879 | validate 107086740073; quota_database 107086740309; collect_f3_database 107086740344 | SUCCESS |
| Battle WebRTC #161 | 35832063873 | spectator_database 107086740010; battle_webrtc 107086740251 | SUCCESS |

CI auf technischem PR-Head `91bad0f6546d579f4d8adc99f26027e45a36e891`; GitHub testet den synthetischen PR-Mergecheckout `ff6ae94f361079969f886577d403c9ec35904721`. Das ist kein Merge nach main. Artefakt enthält diesen Checkout und den exakt neuen Migration-SHA256.

Native Readiness-Artefakt-ID **10737417157**, ZIP-Digest `18cbf3950f94f44bfaa9b81d2240efd690cb49dfdf52c92cef4e5fc2970dbb8b`, Download selbst gehasht und übereinstimmend. JSON und Log unter `evidence/legal-step6-catalog-fix-20260923/`. Dort außerdem Run-/Job-/Schrittmetadaten, Katalogevidenz und gekürzte PASS-Logauszüge.

Pflichtpakete erfolgreich: Schritte 1–5, native Festpreis-Reservation/Parallelität mit getrennten Verbindungen, Readiness PG17, Withdrawal PG17, Guard-/Loader Chromium (17 Szenarien), Order Chromium (9), Withdrawal Chromium, Privatkäufer, Data Rights/Retention, Stripe Default-Off/API-/Recovery-Mocks, COLLECT/F3 und BATTLE/Spectator/WebRTC. Keine echten Provider-Aufrufe. Zwei bereits bedingte externe Scanner-Schritte (Real complex-card reference recognition and recovery / Read-only live catalog availability) sind laut unveränderter Workflow-Konfiguration skipped; nicht als ausgeführt dargestellt. Alle verpflichtenden Jobs/Schritte grün, Workflow-Dateien unverändert.

## Live-E-Mail-OFF: BLOCKIERT

`COMPLIANCE_EMAIL_DELIVERY_ENABLED`: **tatsächlicher Wert nicht lesbar**, daher weder false noch unset behauptet. Read-only Vercel-Projektmetadaten für Projekt `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd` liefern keine Environment-Werte; die verfügbaren Connector-Funktionen bieten dafür keinen lesenden Environment-Zugriff. Direkter Browserzugriff auf die Projekteinstellungen/Environment Variables führt zur Vercel-Anmeldung, keine angemeldete Dashboard-Sitzung vorhanden. Kein Dispatch-Secret verwendet, keine POST-Probe, keine E-Mail, keine Variablenänderung, keine fremden Secret-Werte dokumentiert. Dieser Nachweis bleibt vor jeder Migration zwingend offen.

## Abschlussgrenzen

main frisch remote unverändert `50f88213571be13255bb52eb489cc28cca660001`; PR #5 frisch open, draft=true, merged=false. Production durch diesen Block unverändert: keine Verbindung, Mutation oder Deployment. Staging ebenfalls keine Mutation, kein Default-Privilege-/Index-Fix live, keine Migration. Neue Readiness-RPC live weiterhin nicht vorhanden laut read-only Katalog. Kein positiver Live-Readiness- oder angemeldeter Post-Migrationsnachweis behauptet.

Keine Stripe-Live-Aktivierung, echten Payments/Refunds/Payouts oder Compliance-E-Mails. Vorherige V37-Stripe-/Datenbefunde sind historisch, kein Ersatz für einen frischen Preflight. **Nach V38 STOP.** Ein weiterer ausdrücklich autorisierter Block muss Environment-OFF und sämtliche Live-Preflight-Kriterien erneut prüfen; erst danach darf separat über eine Staging-Migration entschieden werden. Keine Produktions-, Rechts-, Stripe-Live- oder kommerzielle Freigabe.
