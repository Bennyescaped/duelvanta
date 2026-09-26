# DUELVANTA – Schritt 6: kontrollierter Staging-Preflight
Stand: 22.09.2026

**BLOCKIERT in Phase A. Keine Staging-Migration ausgeführt. Kritischer Rollen-/RLS-Konflikt lokal reproduziert. Zusätzlich fehlt die echte Schema-Readiness. Schritt 6 ist NICHT technisch abgeschlossen. Keine Rechts- oder Produktionsfreigabe.**

## 1. Verifizierte Basis
- Repository: Bennyescaped/duelvanta; ausschließlich marketplace-ux-v1.
- Ausgangs- und unveränderter Runtime-Head: `faf730970c4637f8109e27a56725a97a30d252be`; keine Abweichung zum Auftrag.
- Letzter technischer Implementierungshead: `d71b72d96a214c8f18697fd31ac750092e213288`.
- Dieser Schritt 6 ändert nur Dokumentation und diagnostische Evidenz, keinen Anwendungscode, keine Migration und keine CI-Konfiguration.
- main: `50f88213571be13255bb52eb489cc28cca660001`.
- PR #5 gelesen: open, draft=true, merged=false.
- V34 und Schritt-5-Bericht vollständig gelesen.

Zwölf vorhandene Git-Arbeitskopien/Worktrees inventarisiert. Drei enthalten lokale/unversionierte Änderungen; diese wurden als Tar-Archive und Patches gesichert. Die alten Kopien blieben unverändert. Zusätzlich vorhandene Review-/Runtime-Verzeichnisse wurden erkannt. Neue isolierte Arbeitskopie direkt von marketplace-ux-v1 erstellt; kein Branchwechsel, Reset oder Force-Push. Sicherungen und vollständiges Workspace-Inventar liegen lokal unter `/workspace/scratch/67acfd3561e5/preflight/`; sie sind keine Remote-Backups dieser älteren Arbeitsstände.

## 2. Exakter Migrationskandidat
Datei: `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`
- Umfang: 1118 Zeilen, vollständig gelesen.
- Git-Blob: `42c75129a4bf982d8d010f1bbbdc35b7dd2d6fb3`
- SHA256: `18cc18efeb2c32db43fb20150157eab57164fe8d6ed469feb7bf5dbdd92d261e`
- GitHub-Datei auf festem Ausgangscommit und lokale Datei stimmen im Git-Blob überein.
- Kein Statement dieser Migration wurde auf Staging ausgeführt.

## 3. Projekt- und Environment-Grenze
Supabase-Projekt per get_project verifiziert:
- Ref: `xhmjxrcskfhbovhitdej`
- Name: DUELVANTA-STAGING
- Status: ACTIVE_HEALTHY
- Host: `db.xhmjxrcskfhbovhitdej.supabase.co`
- Engine: PostgreSQL 17, Version 17.6.1.166.

Alle Supabase-Abfragen dieses Blocks verwendeten ausschließlich diese Ref. Production `enifiaqsnqtbzylnfrpi` war harte Negativgrenze; keine Verbindung oder Abfrage dorthin.

Der gelesene zentrale Resolver `supabase-environment.js` bindet preview/development an Staging und verwirft widersprüchliche SUPABASE_URL-Werte. Sein lokaler Regressionstest PASS: 18 ungültige Runtime-Konfigurationen abgewiesen. Das beweist den Resolver, nicht die aktuell ausgelieferte Laufzeitkonfiguration.

Vercel-Preview `dpl_74SyxdrvZM4nEVK131w8kwh5qop1` ist READY, target=null, Branch marketplace-ux-v1 und Commit exakt faf73097…:
`https://duelvantav5vision-b1g7nu999-bennyescaped-3783.vercel.app`.

Der Runtime-Config-Abruf erreichte eine Vercel-SSO-Weiterleitung (302), keinen geprüften JSON-Config-Body. Der bewusst nicht authentisierte Dispatcher-Probeversuch erhielt HTTP 401; daraus wird ausdrücklich kein E-Mail-Delivery-Status abgeleitet. Kein angemeldeter Preview-Nachtest in diesem Block. Nach dem kritischen Preflight-Befund keine Fortsetzung zur Integrationsabnahme.

## 4. Tatsächliche Schema-Inventur
Read-only inventarisiert: 74 Anwendungstabellen, 951 physische Tabellenspalten, 267 Funktionen, 525 Constraints und 59 Trigger in public/dv_market_private; zusätzlich Indizes, Schema-/Tabellen-/Funktions-ACLs und die relevanten RLS-Policies. information_schema enthielt zusätzlich vier View-Spalten (insgesamt 955).

Vorhanden: Orders/Deals/Offers, Contract-Snapshots, Outbox/Dispatcher-Grundschema, Stripe-Konfiguration/Accounts/Attempts/Allocations, Datenrechte-/Retention-Abhängigkeiten. Die zwei Widerrufstabellen und neue Schritt-2–5-Funktionen/Spalten fehlen erwartungsgemäß vor der Migration. Bestehende ersetzte RPC-Signaturen wurden verglichen; kein Signaturkonflikt festgestellt.

Die Migration würde unter anderem 12 Offer-Spalten, buyer_type/withdrawal_eligible im Vertragssnapshot, zwei Widerrufstabellen, fünf Unique-Indizes sowie neue/ersetzte Vertrags-RPCs hinzufügen bzw. ändern. Alte Checkout-/Offer-RPCs würden für Browserrollen revoked.

Private Tabellenrechte für anon/authenticated/PUBLIC: keine direkten Grants gefunden. Das private Schema hat nur postgres-ACL. RLS ist bei den vorhandenen Contract-/Outbox-/Payment-Tabellen aktiv. Schon vorher ohne RLS: dv_market_private.trade_user_eligibility, dv_market_private.market_pickup_handovers und public.market_notification_sync_state; diese Bestandsabweichungen wurden nicht verändert und nicht als neu eingeführter Fehler bezeichnet.

**Keine vollständige Schema-/Grant-Abnahme:** Der nachstehende Konflikt verhindert Phase-A-PASS. Retention-/Deletion-Gesamtabnahme, vollständige Post-Migrationsrechte und live Environment-Nachweis bleiben offen.

## 5. Kritischer Blocker S6-A01: direkte Löschung von Festpreis-Reservierungen
Tatsächliches Staging:
- authenticated besitzt SELECT, INSERT und DELETE auf public.market_offers, jedoch kein UPDATE.
- RLS-SELECT erlaubt Teilnehmern das Lesen.
- RLS-DELETE `offers_delete_buyer` erlaubt `buyer_id=auth.uid() AND status='pending'`, ohne Einschränkung des offer_type.
- Einziger nicht-interner DELETE-Trigger: `block_restricted_market_offers` → `block_restricted_account_mutation()`. Er prüft Kontosperren, stellt aber keinen Bestand wieder her.
- Keine INSERT-Policy gefunden: Das vorhandene INSERT-Grant ist allein kein erlaubter Insert-Pfad.

Der Kandidat führt pending/fixed_price-Reservierungen ein, reduziert dafür quantity_available und lässt die genannte DELETE-Grenze unverändert. Direkter Browserzugriff auf die Tabelle benötigt den DOM-Legal-Guard nicht. Würde später eine solche Reservierung entstehen, könnte der Käufer sie direkt löschen. Der Service-Release-/Expiry-Pfad hätte danach keinen Offer-Datensatz mehr zum Wiederherstellen des Bestands.

**Lokal reproduziert, niemals auf Staging:**
1. Staging-Anwendungsschema aus Katalogdefinitionen datenfrei in PGlite rekonstruiert.
2. Exakten vollständigen Migrationskandidaten dort erfolgreich ausgeführt.
3. Tatsächliche SELECT-/DELETE-Policies, RLS und authenticated-Tabellengrant rekonstruiert.
4. Ausschließlich synthetische Benutzer und eine bereits reservierte fixed_price/pending-Zeile angelegt.
5. Als authenticated Käufer DELETE ausgeführt: **1 Zeile gelöscht**.
6. Listing danach: stock_quantity=1, quantity_available=0, status=reserved.
7. Tatsächliche expire_market_offer_reservations_v1 danach: **0**; Bestand bleibt reserviert.

Das ist ein reproduzierbarer **FAIL der vorgesehenen Berechtigungsgrenze**, kein Staging-Transaktionsversuch. Stripe bleibt aus; der Befund zeigt die Unverträglichkeit der späteren Reservierungslogik mit den aktuellen Grants/Policies. Er behauptet nicht, dass bereits ein echter Stripe-Vorgang stattgefunden hätte.

Reproduktionsgrenzen: lokales PGlite, kein nativer PostgreSQL-17-Parallelitätsnachweis; auth.users/auth.uid als lokales Scaffold; keine echten Tabellenzeilen übernommen. Der externe Battle-Spectator-Trigger wurde bei der lokalen Rekonstruktion ausgelassen, weil sein privates Schema außerhalb der Anwendungsschema-Abfrage lag. Alle relevanten Offer-DELETE-Trigger waren enthalten. Synthetischer Reservierungszustand, kein vollständiger Stripe-Prepare-End-to-End-Test.

Kleinste begründete Korrektur für einen separaten geprüften Kandidaten: die bestehende Käufer-DELETE-Policy auf pending/price begrenzen; fixed_price darf den vorhandenen serverseitigen Release-/Expiry-Pfad nicht per Direktlöschung umgehen. Dazu Rollenregressionen für eigene/fremde price/fixed_price-Angebote und einmalige Bestandsfreigabe ergänzen. **Nicht implementiert, nicht auf der Datenbank improvisiert.** Kein Schutzmechanismus abgeschaltet.

## 6. Readiness-GAP S6-A02
Guard 1.1 in trade-legal-readiness.js ruft GET-only `get_my_market_buyer_profile()` auf und akzeptiert:
- fehlerfreie Objektantwort,
- configured als Boolean (auch false),
- schema_version exakt trade-legal-contract-model-v1.

Diese RPC fehlt auf Staging. Der exakte Kandidat definiert sie ebenfalls nicht. Auch im Repository gibt es keine passende produktive Readiness-Implementierung; die positiven Antworten stammen aus Test-Fixtures. Die Migration allein würde den Guard somit nicht öffnen.

Kleinste technisch begründete Lösung, **nur ausgearbeitet**:
- Eine authentisierte, stabile, schreibfreie Schema-Kompatibilitäts-RPC getrennt vom Käuferprofil vorsehen; keinen zweiten Käuferstatus einführen.
- Aus realen PostgreSQL-Katalogen die vollständigen benötigten RPC-Signaturen/Definitionen, Spalten, Constraints, Unique-Indizes, aktiven Unveränderbarkeits-Trigger, RLS und effektiven Rollenrechte prüfen; S6-A01 muss ausdrücklich Teil dieser Prüfung sein.
- Nur einen tatsächlich errechneten compatible=true-Zustand an den bestehenden Guard anbinden. Keine dauerhaft wahre Versions-/Freigabemarkierung, kein Dummy-get_my_market_buyer_profile.
- Fehlende/geänderte Komponente, unerlaubtes Grant, Timeout, Fehler und Teilzustand müssen geschlossen bleiben. Guard-/Loader-Versionen und Fixtures konsistent testen.
- Vor Staging-Anwendung vollständige CI und ein vollständiger Schema-Test des korrigierten Kandidaten.

Lokaler unveränderter Guard-Test: **PASS, 42 Assertions**. Das bestätigt sein jetziges fail-closed-Verhalten, nicht eine vorhandene echte Readiness.

## 7. Phase-B–F-Status
| Phase | Ergebnis |
|---|---|
| A – Preflight | BLOCKIERT / reproduzierbarer Rollen-/RLS-Konflikt; zusätzliche Readiness-Lücke |
| B – Migration | NICHT AUSGEFÜHRT; null DDL-/DML-Aufrufe auf Staging |
| C – Schemaabnahme | BLOCKIERT; kein Post-Migrationszustand |
| D – reale Readiness | BLOCKIERT; RPC fehlt, Guard unverändert |
| E – angemeldete Integration | NICHT AUSGEFÜHRT; keine sicheren Zustände verändert oder künstlich erzeugt |
| F – neue vollständige Abschlussregression | NICHT ALS SCHRITT-6-ABNAHME AUSGEFÜHRT; Anwendungscode unverändert |

Kein SQL-Ausführungsfehler und kein Migrationsteilzustand auf Staging: Es wurde gar keine Migration begonnen. Der lokale erfolgreiche DDL-Lauf ist keine konfliktfreie Gesamtfreigabe.

## 8. CI-Nachweise der unveränderten Basis
Frisch über GitHub bestätigt, exakt auf faf730970c4637f8109e27a56725a97a30d252be:

| Workflow | Run | Jobs | Ergebnis |
|---|---|---|---|
| Scanner V16 #674 | 35772380293 | validate 106896981725; collect_f3_database 106896981857; quota_database 106896982107 | SUCCESS |
| Battle WebRTC #150 | 35772380304 | battle_webrtc 106896989254; spectator_database 106896989398 | SUCCESS |

Schritt-5-Implementierungsbasis gemäß vollständig gelesenem Bericht:
Scanner #673, Run 35771766205: validate 106894958533, collect_f3_database 106894958900, quota_database 106894958686.
Battle #149, Run 35771766294: spectator_database 106894958982, battle_webrtc 106894959332.
Diese historischen Tests bleiben gültig für ihren dokumentierten Umfang; sie widerlegen den neuen tatsächlichen Grant-/Policy-Konflikt nicht.

## 9. Stripe, E-Mail, Production
- Staging-Datenbank frisch gelesen: sandbox_enabled=false, live_mode=false, seller_invoice_issuance_enabled=false.
- Compliance-E-Mail-Code bleibt default-off: nur exakt COMPLIANCE_EMAIL_DELIVERY_ENABLED='true' kann den Dispatcher öffnen; zusätzlich Dispatch-Authentisierung erforderlich.
- Der reale aktuelle Deployment-Wert dieses E-Mail-Schalters konnte wegen Preview-Zugriffsschutz nicht bestätigt werden. V34 dokumentiert deaktivierte Zustellung; dieser Block hat sie weder aktiviert noch geändert. **Kein frischer Live-OFF-Nachweis behauptet.**
- Keine echten E-Mails, Payments, Refunds, Payouts, Deals, Orders oder Widerrufe erzeugt.
- main und Production wurden durch diesen Block nicht verändert; keine Production-Datenbankverbindung, kein Merge, kein manueller Deploy. Eine umfassende externe Drift-Aussage über Production wird daraus nicht abgeleitet.
- COLLECT F1–F3/Mobile, Spectator Media und Scanner-Release-Gate nicht neu aufgerollt.

## 10. Fortsetzung und Evidenz
Zuerst S6-A01 gezielt im Repository korrigieren und mit tatsächlichen Rollen-/RLS-Grenzen testen; danach die echte Readiness-Komponente umsetzen und erneut CI durchführen. Vor jedem späteren Datenbankschritt Phase A mit neuem Remote-Head und neuem Kandidatenhash wiederholen. Keine Anwendung des hier geprüften unveränderten Kandidaten.

Evidenz: `evidence/legal-step6-preflight-20260922/`.
- preflight.json: Projekt-/Hash-/Grant-/Constraint-Befunde ohne Nutzerzeilen.
- staging-application-schema.json.gz: datenfreie Katalogdefinitionen.
- reproduce-delete-conflict.mjs: lokale diagnostische Reproduktion.
- delete-conflict-result.json und rehearsal.txt: tatsächlicher reproduzierter Blocker.

Die Reproduktion endet erfolgreich, wenn sie den **unbehobenen Fehler** nachweist; ihr Prozess-Exitcode darf nicht als Produkt-PASS interpretiert werden.

**Schritt 6 bleibt blockiert; Masterhandout V35 dokumentiert ausschließlich diesen kontrollierten Stopp.**

## CI-Nachtrag zum veröffentlichten Dokumentationsstand
Auch auf `eee644816ca9f3933034d68efb678b6b856b1948` wurden beide vollständigen Workflows automatisch ausgeführt und erfolgreich abgeschlossen:
- Scanner V16 #675, Run `35781624402`: `collect_f3_database` Job `106928252888`, `quota_database` Job `106928253243`, `validate` Job `106928253257` – alle SUCCESS.
- Battle WebRTC #151, Run `35781624388`: `battle_webrtc` Job `106928252752`, `spectator_database` Job `106928253063` – beide SUCCESS.

Dies ist vollständige Bestandsregression auf dem Dokumentations-/Evidenzcommit, keine erfolgreiche Schritt-6-Migrationsabnahme. S6-A01 bleibt reproduzierbar und ungefixt; Staging bleibt unmigriert. Dieser spätere Nachtrag ändert ausschließlich Dokumentation. Die expliziten Phasen- und Testgrenzen bleiben bestehen.
