# DUELVANTA – Schritt 6: technische Korrektur der Preflight-Blocker
Stand: 22.09.2026 · ausschließlich `marketplace-ux-v1`

**Arbeitsumfang: Repository-Korrekturen und isolierte Tests. Die Legal-Gesamtmigration wurde weiterhin NICHT auf Staging angewandt. Keine Staging-Transaktion, keine Produktionsfreigabe. Der nächste Migrations-Preflight benötigt einen separaten Folgeauftrag.**

## 1. Verifizierte Ausgangsbasis und Sicherung

V35 und der vollständige Schritt-6-Preflight-Bericht wurden gelesen. Erwarteter und tatsächlich ermittelter Ausgangs-Dokumentationshead: `a4e92abb8bd2b96f690d9c9438b4200854a953c1`. Keine Remote-Abweichung zum Folgeauftrag. V35 dokumentiert den früheren Ausgangshead `faf730970c4637f8109e27a56725a97a30d252be` und den Implementierungsstand Schritt 5 `d71b72d96a214c8f18697fd31ac750092e213288`; der spätere Dokumentationsnachtrag ersetzt diese nicht durch einen neuen Runtime-Stand.

13 vorhandene Arbeitskopien inventarisiert; lokale/unversionierte Änderungen in drei alten Kopien archiviert. Die vorherige aktuelle Arbeitskopie wurde zusätzlich als Git-Bundle gesichert. Inventar und Sicherungen: `/workspace/scratch/67acfd3561e5/s6-fix-backup/`. Neue isolierte Arbeitskopie `duelvanta-s6-fix` direkt auf `marketplace-ux-v1`; keine alte Kopie zurückgesetzt oder überschrieben. GitHub-Veröffentlichung über Blob/Tree/Commit und Fast-forward-Ref-Update, niemals Force-Push. Lokale Commit-IDs unterscheiden sich aufgrund der Commit-Erstellung von Remote-IDs; die jeweiligen Git-Trees wurden abgeglichen. Maßgeblich sind die hier ausgeschriebenen Remote-SHAs.

- Technischer Head: `b89cecc22e7eb2eb80716078a29584f383dd653e`.
- main unverändert: `50f88213571be13255bb52eb489cc28cca660001`.
- Staging: `xhmjxrcskfhbovhitdej`; keine Verbindung/Migration in diesem Fixblock.
- Production: `enifiaqsnqtbzylnfrpi`, harte Negativgrenze; keine Verbindung.
- PR #5 bleibt offen, Draft, unmerged.

## 2. Ursache und vollständig untersuchte Wege

`prepare_fixed_price_market_offer_v1` reduziert unter Listing-Sperre `quantity_available` und erzeugt eine eigene pending/fixed_price-Zeile in `public.market_offers`, mit `reserved_quantity`, 15-Minuten-Ablaufzeit, Request-ID, Attempt-ID und eingefrorenem Vertrags-/Betragssnapshot. Der Bestand muss bis Accept oder atomarem Release/Expire dieser Zeile zugeordnet bleiben.

Das bestehende authenticated-DELETE-Grant und die Policy `offers_delete_buyer` erlaubten zuvor jede eigene pending-Zeile. Der Käufer konnte daher den Reservierungsdatensatz per direktem Tabellen-DELETE entfernen. `quantity_available` blieb reduziert; der bisherige DELETE-Trigger prüfte nur Kontosperren. Ohne Offer-Zeile fanden weder Release noch Expire den reservierten Bestand. V35 weist dies an einem synthetischen letzten Stück nach: eine Zeile gelöscht, Bestand 0/1, Cleanup findet 0.

| Weg | Befund und Korrektur |
|---|---|
| Direkter Käufer-DELETE | Policy ohne Angebotsart war die konkrete Lücke. Jetzt nur eigenes pending/price ohne reservierte Menge/Ablaufzeit; zusätzliche restriktive Policy verhindert permissive Erweiterung. |
| Direktes INSERT/UPDATE | Keine nutzbare INSERT-Policy und kein UPDATE-Grant im Ausgangsschema. Mutation-Grants nun ausdrücklich für PUBLIC/anon/authenticated/service_role entzogen; authenticated erhält nur eingeschränktes price-DELETE zurück. |
| Service-DELETE/Cascade | Kein alternativer legitimer Freigabepfad. Backend-Direktmutation revoked; BEFORE-DELETE-Trigger weist jede noch reservierte Zeile auch bei privilegiertem DELETE/FK-Cascade zurück. |
| Release | Bisher Offer vor Listing gesperrt. Jetzt zuerst Listing, dann Offer; Status, vorhandenen Deal und reale reservierte Menge unter Sperre erneut prüfen; Bestand und Reservation atomar ändern. |
| Expire/Cleanup | Bestehender gemeinsamer Cleanup für pending/fixed_price und historische accepted/price ohne Deal. Nun sortierte Listing-Reihenfolge, Status nach Sperrwartezeit erneut geprüft, exakte Menge statt stiller Begrenzung auf stock_quantity. |
| Accept | Jetzt dieselbe Listing→Offer-Sperrfolge. Prüft reservierte gegen angeforderte Menge; setzt beim Vertragsschluss reserved_quantity=0 und Ablaufzeit=NULL. Replay gibt denselben Vertrag zurück. |
| Browser-Cancel / alter Withdraw-RPC | Stripe cancel_url navigiert nur zurück. Der zusätzlich vorhandene `withdraw_my_market_offer` war dagegen ein echter Umgehungspfad: pending → withdrawn ohne Mengenrückführung. Jetzt ausdrücklich auf eigenes unreserviertes pending/price begrenzt. |
| Alte Seller-Edit-/Decline-RPCs | Mehrere bestehende Funktionen ändern pending-Offers nur auf declined. Neue validierte CHECK-Grenze verlangt bei fixed_price entweder pending mit positiver vollständiger Reservation und Ablaufzeit oder einen beendeten Zustand ohne Reservation. Status-only-Updates scheitern atomar, auch innerhalb SECURITY DEFINER. |
| Timeout/Unknown | Providerfehler, unvollständige Antworten und unklare DB-Ergebnisse bleiben retryable/unknown. API löst keine vorschnelle Freigabe aus; Prepare-/Accept-Recovery unverändert. |
| Account-Schließung | `account_deletion_blockers` blockiert pending/accepted Offers und aktive/reservierte Listings; Request und Worker-Prepare prüfen erneut. Auth-/Listing-FKs können Offers kaskadierend löschen; der neue Trigger blockiert dabei aktive Reservierungen. Vorhandene Vertrags-FKs bleiben RESTRICT. |
| Preisangebot | Gewöhnliche pending/price-Angebote reservieren keinen Bestand; eigenes Löschen bleibt möglich. Neue angenommene Preisangebote bilden sofort Deal/Order/Snapshot und werden nicht vom Reservation-Cleanup freigegeben. Historische Reservierungen ohne Deal bleiben im bestehenden Expire-Pfad. |

Die Abschlussinventur aller zwölf vorhandenen Offer-UPDATE-/DELETE-Funktionsdefinitionen ist mit Signaturen, ACLs und Source-SHA256 in `legacy-offer-mutators.json` erhalten. Der zusätzliche Withdraw-Befund wurde erst nach dem grünen Zwischenstand Scanner #680/Battle #156 erkannt. Deshalb wurde dieser Zwischenstand nicht als Abschluss veröffentlicht; der tatsächliche Abschlusshead enthält auch den Withdraw-/CHECK-Fix und wurde erneut vollständig geprüft.

Die verletzte Schritt-4-Invariante war die eindeutige, wiederauffindbare Zuordnung jedes Bestandsabzugs zu genau einer serververwalteten Reservation bzw. einem gebildeten Vertrag. Fehlende/ungültige Reservierungsmengen oder rechnerisch unmöglicher Bestand lösen jetzt einen Fehler mit Transaktionsrollback aus; kein geratenes `greatest(...,1)` und kein verdeckendes `least(stock_quantity,...)` mehr im Release/Expire.

Ablauf bleibt der vorhandene serverseitige Cleanup, aufgerufen unter anderem vor Prepare und Preisangebotsantwort. Es wurde kein Hintergrundscheduler hinzugefügt. Eine Ablaufzeit allein ist kein ausgeführter Cleanup; der neue Schutz verhindert den irreversiblen Verlust der dafür erforderlichen Zeile. Betriebsseitige Cleanup-Aufrufbarkeit und vorhandene Altzustände sind beim späteren Live-Preflight erneut zu prüfen.

## 3. Echter PostgreSQL-17-Nachweis

Der bestehende Test `tests/trade-legal-fixed-price-concurrency-test.mjs` verwendet weiterhin sieben getrennte Verbindungen in einer ausschließlich lokalen, wegwerfbaren PostgreSQL-17-Datenbank. Der Helper verweigert andere Hosts und andere Major-Versionen. Wartebeziehungen werden mit `pg_blocking_pids`, `pg_stat_activity` und nicht erteilten `pg_locks` tatsächlich beobachtet.

Erweiterte Fälle: eigene/fremde authenticated-Rolle, anon und service_role; direkte DELETE-/INSERT-/UPDATE-Abwehr; nur Service-Release; privilegierter und Listing-Cascade-DELETE scheitern; Legacy-Withdraw-RPC und status-only withdrawn/declined/cancelled scheitern ohne Bestandsänderung; Release genau einmal und Replay=false; unreserviertes eigenes price-DELETE bleibt erhalten. Parallelität: Release/Release, Accept/Release, Release/Accept, Expire/Expire, Release/Expire, Expire/Release sowie beide Richtungen Accept/Expire. Beim Accept-vor-Expire-Fall läuft die alte MVCC-Reservation während der offenen Accept-Transaktion zeitlich ab; der wartende Expire muss nach dem Commit den Vertrag respektieren.

Die bisherigen Fälle bleiben erhalten: gleiche Request-ID erzeugt genau ein Offer/Attempt, letztes Stück wird nicht überverkauft, Accept-Replay erzeugt genau ein Deal/Order/Payment-Attempt/Allocation. Nach Release/Expire existiert kein Vertrag und der Bestand ist wieder verfügbar; nach Accept bleibt er verkauft. Gefrorene Preise, Versand, Händlerkonto, Gebühren und Zahlungsnachweise bleiben unverändert.

Alle Daten sind synthetisch. Der fokussierte Parallelitätstest verwendet weiterhin seinen expliziten synthetischen Order-/Snapshot-Trigger; er behauptet keinen echten Stripe-/Staging-End-to-End-Vorgang. Zusätzlich führt der neue Readiness-Test die vollständige exakte Migration auf dem datenfrei rekonstruierten Anwendungsschema in PostgreSQL 17 aus. Auth.users/auth.uid sind dabei ausdrücklich Test-Scaffolding; kein Supabase-Auth-End-to-End-Test. Der externe Battle-Spectator-Trigger auf battle_matches ist wie in V35 außerhalb dieser Rekonstruktion; diese Tabelle gehört nicht zu den 64 Readiness-Tabellen. Die Legal-/Offer-Trigger sind vollständig enthalten.

## 4. Echte Schema-Readiness

Neue RPC: `public.get_market_legal_schema_readiness_v1()`; STABLE, SECURITY DEFINER, fester search_path, ausschließlich Katalog-SELECTs. PUBLIC/anon sind revoked; authenticated besitzt EXECUTE. Sie liest keine Nutzer-, Vertrags- oder Zahlungszeilen und verändert weder Konfiguration noch Tabellen.

Die Prüfung vergleicht 266 deterministische Objektprüfungen für 64 Tabellen und 201 Funktionsnamen einschließlich vorhandener Abhängigkeiten: Spalten und Typen/Defaults/NOT NULL, validierte Constraints und Foreign Keys, gültige Indizes, aktive Trigger, RLS, tatsächliche Funktionskörper/Signaturen/Argument-Defaults/Inhaber/Rückgaben/Volatilität/NULL-Aufrufverhalten/search_path, effektive anon/authenticated/service_role-RPC-Rechte, private Schema-Grenzen, Tabellen-/Spaltenrechte, Offer-DELETE-Policies und entzogene Backend-Direktmutation. Erfasst sind Vertragssnapshots, Festpreis, Preisangebote, Widerruf, Outbox/Dispatcher sowie Datenrechte-/Retention-Abhängigkeiten und retired RPCs.

Die erwarteten Definitionen werden **offline** aus der bereits gesicherten datenfreien Staging-Katalogbasis plus dem geprüften Kandidaten erzeugt und im SQL festgehalten. Keine Selbstfreigabe aus einem beliebigen aktuellen Live-Schema, keine Marker-Tabelle, keine immer-true-RPC. `tests/generate-legal-readiness.mjs --check` verhindert einen veralteten Sollvergleich nach SQL-Änderungen. Die Hashes dienen dem Definitionsvergleich, nicht als Rechtsfreigabe oder Schutz gegen einen Datenbankadministrator.

PostgreSQL 18/PGlite führt NOT NULL zusätzlich als Constraint-Typ n; PostgreSQL 17 führt es über attnotnull. Der Vergleich prüft bei beiden jede Spalte über attnotnull und zählt diese PG18-Zusatzrepräsentation nicht doppelt. Die äußere Objektliste verwendet COLLATE "C", damit Server-Ländereinstellungen die Vergleichsreihenfolge nicht ändern.

Guard **1.2** fragt die neue RPC GET-only über den vorhandenen Client ab und akzeptiert ausschließlich `compatible === true` und `revision === 'trade-legal-contract-model-v1.2'`. Loader 1.4 und Order-Leseschutz wurden konsistent angepasst; betroffene Cache-Versionen aktualisiert. Fehler/fehlende RPC, falsche Version, unerwartete Antwort, Teilmigration und Timeout bleiben geschlossen. Ein verspätetes positives Ergebnis öffnet einen bereits abgelaufenen Probeversuch nicht. Gewöhnliche Profil-/Order-Lesepfade und Production-Release-Sperre bleiben erhalten.

Negative Datenbanktests verändern innerhalb zurückgerollter isolierter Transaktionen unter anderem Spalte, NOT NULL, RPC/Implementierung/Inhaber/NULL-Aufrufverhalten, Unique-Index, beide Immutable-Trigger, Reservierungs-Trigger, RLS, private Schema-/Tabellenrechte, Column-UPDATE, Backend-DELETE, Reservation-State-CHECK, retired/new RPC-Grants, DELETE-Policy, Widerrufs-FK und Outbox-Constraint. Jede Abweichung schließt die Readiness, jede Wiederherstellung öffnet sie erneut. Zusätzlich: Funktion fehlt, Basisschema ohne Kandidaten, authenticated in READ ONLY sowie anon ohne EXECUTE. 47 dokumentierte Kompatibilitätschecks plus Zugriffsassertionen.

## 5. CI und technische Abnahme

**Technischer Fixblock abgeschlossen; S6-A01 und S6-A02 im Repository geschlossen. Keine Migrationsabnahme.** Vollständige CI auf `b89cecc22e7eb2eb80716078a29584f383dd653e`:

| Workflow | Run-ID | Jobs | Ergebnis |
|---|---|---|---|
| Scanner V16 #682 | 35786444298 | validate 106944286665; collect_f3_database 106944286574; quota_database 106944286431 | alle SUCCESS |
| Battle WebRTC #158 | 35786443880 | battle_webrtc 106944285297; spectator_database 106944286051 | alle SUCCESS |

Scanner umfasst die vorhandenen Schritt-1–5-Pakete, den erweiterten PG17-Festpreistest (14 Fälle, davon 11 mit beobachteter Verbindungssperre), die vollständige PG17-Schemarekonstruktion/Readiness mit 47 Checks, PG17-Widerruf, 17 Guard-/Loader-Chromium-Szenarien, 9 Order-Reader-Szenarien, 4 Profil-/Guard-Szenarien, Widerruf-Chromium, TRADE Mobile/Desktop/DOM, Datenrechte/Retention, Stripe Default-Off/API-/Recovery-Mocks und die unveränderten COLLECT-/Scanner-Pakete. Battle enthält beide vorhandenen vollständigen Jobs. Kein Schutztest deaktiviert oder inhaltlich gelockert.

Zwischenläufe: Reservierungsfix `b26c497303c74177eff8807274200131f60cbfbf` bestand Scanner #677 / Run 35784092398 und Battle #153 / Run 35784092411 vollständig. Scanner #678 / Run 35784885380 auf `cece00bb2433f14516c0c164e52e80ee2b8ae6ba` scheiterte an alter Cache-Versionsassertion und PG18/PG17-NOT-NULL-Katalogdarstellung; Battle #154 / Run 35784885877 war grün. Scanner #679 / Run 35785208202 auf `b412cb25a777c1a055473789122664495a865594` scheiterte an der RPC-Sortiererwartung im Browserfixture und locale-abhängiger Reihenfolge der ansonsten identischen Katalogobjekte; Battle #155 / Run 35785208197 war grün. Scanner #680 / Run 35785421816 und Battle #156 / Run 35785421777 auf `aa804424e991f365ebbfef4d6b3d6f9655b26005` waren anschließend grün. Nach dem zusätzlichen Legacy-Withdraw-Befund bestanden auch Scanner #681 / Run 35786184855 und Battle #157 / Run 35786184287 auf `c5da7f423da4742744383f79391558c076901ba1` vollständig. Der Abschlusshead ergänzt noch die Readiness-Prüfung für Inhaber, Argument-Defaults und NULL-Verhalten. Alle beschriebenen Fehler sind dort behoben. Vollständige Job-IDs/Status/Steps aller zwölf Läufe: `evidence/legal-step6-fixes-20260922/ci.json`.

Originale Abschlussartefakte im Scanner-Run: Festpreis-PG17 10720676318, Readiness-PG17 10720581402, Widerruf-PG17 10720261767, Browser-/Gesamtregression 10720421876. Download-Digests und Head-Zuordnung sind im CI-Evidenz-JSON erhalten. GitHub prüft Pull Requests auf einem temporären Merge-Checkout; Run-/Artifact-Metadaten ordnen die Prüfung eindeutig dem genannten PR-Head zu. Kein Merge nach main wurde ausgeführt.

Exakter überarbeiteter Kandidat: `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`.
- Git-Blob: `f1714dc1b5fc9ebeab0dbff5c974ac1696dc28ef`.
- SHA256: `a02e01bba93bda7e942850e776410fae1d752edb629b80319d9970859270d25f`.
- Der frühere V35-Kandidat mit SHA256 `18cc18efeb2c32db43fb20150157eab57164fe8d6ed469feb7bf5dbdd92d261e` ist als unbehobener Diagnosestand historisch erhalten und darf nicht angewandt werden.
- Neuer Kandidat ausschließlich in isolierten Tests angewandt, niemals auf Staging.

## 6. Unveränderte externe Grenzen

**Keine Legal-Migration auf Staging angewandt. Staging-Datenbank in diesem Arbeitsblock nicht migriert; keine Staging-Datenfixtures oder echten Transaktionen erzeugt.** Kein Production-Zugriff, kein main-Commit, kein Merge, kein manueller Production-Deploy. CI verwendet isolierte Datenbanken und API-/Browser-Mocks. COLLECT/Spectator/Scanner-Verhalten wurde nicht neu bearbeitet; bestehende Regressionspakete laufen unverändert mit.

Stripe Sandbox und Live wurden nicht aktiviert; dokumentierter OFF-Stand aus V35 und Default-Off-Code bleiben unverändert. Keine echten Payments, Refunds oder Payouts. Compliance-E-Mail-Zustellung wurde nicht aktiviert oder konfiguriert; keine echten E-Mails. Wie schon in V35 bleibt der tatsächliche Deployment-Wert des E-Mail-Delivery-Schalters ohne frischen Live-Nachweis. Dieser Fixblock bestätigt Code-/Mock-Grenzen und Nichtveränderung, keine unabhängige externe Drift-Freiheit.

Kein angemeldeter Staging-Integrationstest in diesem Fixblock. Die neue Readiness existiert auf Staging weiterhin nicht; der veröffentlichte Guard bleibt dort deshalb geschlossen. Fehlende sichere Testzustände aus Schritt 2 bleiben BLOCKIERT und wurden nicht künstlich erzeugt.

## 7. Neuer kontrollierter Migrations-Preflight – separat auszuführen

Noch keine Phase-A-Freigabe für die aktuelle Live-Datenbank. Nach separatem Folgeauftrag:

1. V36, diesen Bericht, Remote-Head, main und PR-Status vollständig prüfen; Arbeitskopien sichern.
2. Exakte aktuelle Migration vollständig lesen, Git-Blob/SHA256 erneut vergleichen; keine weiteren Migrationen daneben anwenden.
3. Tatsächlichen Staging-Projektbezug und alle Runtime-/Environment-Routen verifizieren. Production-Ref bleibt harte Negativgrenze.
4. Live-Katalog erneut read-only inventarisieren und gegen die gesicherte Baseline vergleichen: Tabellen/Spalten, Signaturen, Indizes, Trigger, RLS, Tabellen-/Spalten-/Funktionsgrants, Default-Privileges, FKs, Outbox, Datenrechte, Stripe und Widerruf.
5. Vorhandene Offers/Bestandsgrenzen nur read-only auf widersprüchliche Reservierungsmengen, vorhandene Deals und Cleanup-Kompatibilität prüfen. Keine Datenreparatur erfinden. Die Baseline-Rekonstruktion ersetzt diese Prüfung nicht.
6. Reale Stripe- und E-Mail-OFF-Grenzen nachweisen; Preview-Authentisierung und vorhandene sichere Lesetestzustände klären.
7. Soll-Readiness und tatsächliches vollständiges Schema einschließlich PostgreSQL-Version/Extensions prüfen. Bei unerklärter Abweichung stoppen, nicht neu aus dem Live-Zustand einen grünen Sollwert erzeugen.
8. Erst ein ausdrücklich autorisierter, konfliktfreier Folgeblock darf ausschließlich diese Migration gegen Staging ausführen. Danach vollständige Schema-/Grant-/Readiness-Abnahme und sichere angemeldete Lesetests, keine wirtschaftlichen Testvorgänge.

**Dieser Arbeitsblock endet vor jeder Staging-Migration. Schritt 6 als Gesamtmigration ist weiterhin nicht abgeschlossen.**
