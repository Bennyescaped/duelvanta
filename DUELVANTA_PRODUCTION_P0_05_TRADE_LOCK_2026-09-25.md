# DUELVANTA – P0-05 Production-TRADE-Notfallsperre

25.09.2026. **Versionierter lokaler Branch-Kandidat fertig; vollständige unten definierte isolierte Funktionsmatrix PASS. Kein nativer PostgreSQL-17-/Remote-CI-PASS für den neuen Kandidaten. Keine Production-Freigabe. STOP.**

## Grundlage und Versionsstand

V59 vollständig gelesen. Ausgangs- und erneut geprüfter Remote-Head von `Bennyescaped/duelvanta`, ausschließlich `marketplace-ux-v1`: `d72334c31376aed549beed879102f58491b72b5e`. Scanner #732 / 36124209015 und Battle #208 / 36124209012 SUCCESS. PR #5 open, Draft, unmerged; main `50f88213571be13255bb52eb489cc28cca660001`.

Lokaler technischer Kandidat: `46de590a150722b2e0ae77c401561425512f3725`. Nachfolgender lokaler Dokumentationscommit ergänzt Bericht/V60. Kein Push: Ein Branch-Push kann die bestehende Vercel-Git-Automatik auslösen; der Auftrag verbietet Deployments. Die grünen Remote-Workflows gehören ausschließlich zur unveränderten V59-Basis, nicht zu diesem neuen Kandidaten.

## Befund und gezielte Änderungen

Ausgangspunkt waren `database/market-production-trade-lock-v1.sql` und die beiden vorhandenen gleichnamigen Bootstrap-/Datenbanktests. Der alte Stand entzog nur Browserrechte, erfasste die neuen Fixed-Price-RPCs nicht und entzog auch reine Rücknahme-/Abschlussrechte. Service-/Definer-Schreibpfade waren nicht vollständig abgesichert.

Der ergänzte Kandidat:

1. Entzieht Browser- und Service-Rollen die reinen Eröffnungs-/Editier-/Publikations-RPCs. Elf `ENABLE ALWAYS`-Trigger sperren neue Listings, Offers, Deals, Orders, Order-Items, Listing-Bilder sowie fünf bereits stillgelegte Swap-Eröffnungstabellen. Die Sperre gilt unabhängig von RLS, JWT-Inhalten oder Client-Schaltern. Updates dürfen keine neuen Parteien/Produkte/Positionen in Bestandsverträge einschleusen, Angebote akzeptieren, Bestand neu reservieren oder abgeschlossene Orders reaktivieren. Notwendige Bestandsrückgaben bei Storno/Reservierungsablauf bleiben möglich.
2. Ergänzt ausschließlich zwei bestehende Funktionskörper an eindeutigen, geprüften Einfügestellen: `prepare_fixed_price_market_offer_v1` und `accept_fixed_price_market_offer_v1`. Neue und nur vorbereitete Requests scheitern mit `production_trade_locked`. Wiederholungen bereits akzeptierter Requests mit vorhandener Order bleiben unter sämtlichen bisherigen Ownership-/Snapshot-/Betragsprüfungen möglich. Fehlende Funktion oder abweichende Einfügestelle bricht die Installation ab. Keine permissive Ersatzimplementierung, kein Service-Bypass, kein Laufzeit-Unlock.
3. Ergänzt einen separaten, offline aus der bereits geprüften Fixture plus Lock erzeugten `market-production-trade-lock-readiness-v1.sql`. Der bisherige unverriegelte Readiness-Vertrag bleibt unverändert. Der gesperrte Zustand prüft weiterhin konkrete Funktionskörper, Rechte, Tabellen und Trigger; ein deaktivierter Lock-Trigger führt zu `compatible=false`. Dadurch bleiben notwendige Bestandsprozesse auch über die Schema-Prüfung erreichbar.

Reine Rücknahme-/Bereinigungsfunktionen – darunter Angebotsrücknahme, Ablehnen, Listing-Abschluss und Draft-/Bildentfernung – werden nicht pauschal gesperrt. Der bestehende Checkout-Servercode benötigt keine Änderung: Der Datenbank-Prepare-Schritt liegt vor seinem Provider-Aufruf. Der echte Handler wurde mit einer an die echte isolierte Datenbank gebundenen HTTP-Testschicht ausgeführt.

## Isolierte Prüfung

Engine: **PostgreSQL 18.3 in PGlite 0.5.8**, vollständig flüchtige lokale Datenbank. Der vorhandene P0-01-Runner rekonstruiert zuerst alle 72 historischen Production-Migrationen und die 60 gehashten Upgrade-Schritte. Historische Ausgangsdaten und unveränderter Security-/Legal-Readiness-Vertrag bestehen vor dem Lock; erst danach wird die P0-05-Fixture aufgebaut. Synthetische Konten, Listings und Provider-IDs; keine externen Schlüssel oder Datenbankverbindungen.

`node tests/production-upgrade-rehearsal.mjs --trade-lock`: **20 Testgruppen PASS**.

| Pfad | Konkreter Nachweis |
|---|---|
| Positivkontrolle ohne Lock | Echte Fixed-Price-Prepare-/Accept-Funktionen erzeugen einen Vertrag und eine Order; echte Preisangebote funktionieren. |
| Installation | Lock und Readiness gemeinsam in einer Transaktion; Rollback stellt Ausgangsschema/-rechte wieder her; zweimalige Anwendung identisch funktionsfähig. |
| Browser-/RPC-Rollen | Alle 17 erfassten Eröffnungs-RPC-Signaturen unter `anon`, `authenticated`, `service_role` tatsächlich aufgerufen und abgewiesen. Keine bloße Prüfung von Quelltextnamen. |
| Direkter REST-/Tabellenweg | Alle sechs öffentlichen Insert-Ziele abgewiesen; privilegierte Aufrufe testen die physischen Trigger zusätzlich zur ACL. |
| Service-/Definer-Pfade | Auch mit ausschließlich im Test vorübergehend gewährten DML-Rechten und BYPASSRLS scheitern Service-Inserts und Angebotsannahme. Rechte anschließend zurückgerollt. Auch `session_replication_role=replica` umgeht den ALWAYS-Guard nicht. |
| Fixed-Price/Checkout | Frischer Prepare, vorbereiteter Replay ohne Vertrag und Service-Accept verweigert; keine zusätzlichen Offers/Deals/Orders/Items/Snapshots. |
| Preisangebot | Verkäuferannahme verweigert; Ablehnung und Rücknahme funktionieren. |
| API | Tatsächlicher Checkout-Handler mit DB-Adapter liefert für neuen Handel 409, bevor ein Provideraufruf erfolgen kann. Bereits akzeptierter Fixed-Price-Replay liefert 200 mit einem ausschließlich gemockten Provider-Lesezugriff. |
| Bestandsmanipulation | Käuferwechsel, neue Menge in bestehender Position, erneutes Publizieren und neue Reservierung scheitern. |
| Bestandszahlungen | Tatsächliche idempotente Service-Payment-Vorbereitung für vorhandene Order und akzeptierte Fixed-Price-Replays funktionieren. |
| Problem/Dispute/Storno | Tatsächliche Problemöffnung und Rücknahme sowie Stornoanfrage/-annahme einschließlich Bestandspflege funktionieren. |
| Widerruf/Refund | Tatsächlicher B2C-Widerruf mit Bestätigung/Beleg sowie Service-Role-Full-Refund-Vorbereitung funktionieren. Kein echter Refund. |
| Datenrechte | Eigener Datenexport sowie Löschanfrage, Service-Claim, Anonymisierung eines bestehenden Listings und DB-seitiger Abschluss funktionieren. Externe Auth-/Storage-Löschung nicht aufgerufen. |
| Abschluss | Empfangsbestätigung schließt eine vorhandene manuelle Order ab. |
| Swap-Altpfade | Alle fünf stillgelegten Eröffnungstabellen zusätzlich auch für privilegierte Inserts gesperrt; keine Wiederbelebung von Swap. |
| Drift | Deaktivierter Order-Lock-Trigger führt zu negativer Readiness; Testmutation zurückgerollt. |

Zusätzlich PASS: unveränderter ursprünglicher Readiness-Generator `--check`; neuer Generator `--trade-lock --check`; bestehende Stripe-Sandbox-/Live-API-Mocktests; Erasure-Worker-Mocktest; `git diff --check`. Keine echten Zahlungsanbieteraktionen. Fixture-Schalter für synthetische Paymentzustände sind ausschließlich lokale SQL-/Prozesswerte und wurden zurückgesetzt.

Der bestehende Scannerworkflow enthält jetzt den vollständigen P0-05-Lauf mit `--native --trade-lock` nach den vorhandenen P0-01-Prüfungen. Die frühere kleine SQL-Smoke-Fixture wurde durch diese vollständige Kette ersetzt, ihre beiden Dateien gezielt weiterverwendet. Der neue native CI-Lauf wurde **nicht gestartet und nicht als bestanden ausgegeben**.

## Browser, Server und Edge: Abdeckung

Alle versionierten Nicht-Test-JS-/HTML-/TS-Dateien wurden auf Aufrufe geprüft; Literal-Inventar mit Dateihashes liegt bei. Die Browser-Direktinserts in `trade.js` und `trade-shipping-options.js` enden an den geschützten Listing-Tabellen. Sealed-Publikation, Preisangebote, Legacy-Kauf und Checkout-RPCs enden an denselben gesperrten Schreibgrenzen. Ein manipuliertes Frontend kann diese Grenze nicht durch einen UI-Flag-Wechsel umgehen.

Server-Neuhandel läuft über `api/market-stripe-checkout.js`: authentifizierter Fixed-Prepare, anschließend Service-Accept. Der normale Order-Payment-Pfad benötigt eine schon vorhandene Order. Refund, Webhook-Reconciliation, Nachrichten-Dispatcher und Account-Erasure bleiben für Bestandstätigkeiten erhalten; es gibt keine globale Sperre sämtlicher Service-RPCs.

Alle sieben aktuell deployten Edge-Funktionsquellen wurden ausschließlich gelesen: Production `invite-beta-user`, `public-card-image`; Staging `owner-invite-beta-user`, `invite-beta-user`, `battle-spectator-media-broker`, `battle-spectator-media-reconciler`, `battle-spectator-media-inspect`. Keine enthält einen zusätzlichen TRADE-Eröffnungspfad. Versionen/Provider-Bundlehashes und aufgerufene Relationen/RPCs sind dokumentiert. Keine Edge-Funktion aufgerufen oder deployt.

## Frisch bestätigte unveränderte Außenwelt

Production DB: 72 Migrationen, letzte `20260911181702`, null P0-05-Lock-Trigger. Production-Domain `duelvanta.de` zeigt weiterhin auf `dpl_ENc313pWZJMSn6y21VbURMEWLMkt`, READY, main `50f8821`.

Die authentifizierte Vercel-Environment-Seite frisch neu geladen: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DUELVANTA_PUBLIC_ORIGIN` weiterhin Production/Config; `SUPABASE_SERVICE_ROLE_KEY` weiterhin Production/Secret. Keine Reveal-/Edit-/Save-Aktion. V59s Herkunftsnachweis und seine Write-only-Grenze bleiben unverändert; keine neue Byte-/Runtime-Keyattestierung behauptet.

Production und Staging vollständig read-only. Keine Migration, Deployment, Merge, Stripe-Aktivierung, echten Zahlungen, Refunds, E-Mails, Auth-/Storage-Mutationen oder Vercel-Konfigurationsänderungen.

## Ausführungs- und Nachweisgrenzen

Der Kandidat ist noch nicht auf Remote veröffentlicht. **P0-05-Funktionsmatrix lokal PASS bedeutet weder nativer PG17-PASS noch abgeschlossene Release-Abnahme.** Natives PostgreSQL war lokal nicht verfügbar; eine Paketinstallation scheiterte an Laufzeitberechtigungen. Keine Umgehung; kein externer Ersatztest auf Production/Staging. Kein mehrprozessiger Installations-/In-flight-Race-Nachweis, echter PostgREST/JWT-Gatewaytest oder Browser-Provider-End-to-End-Test für diesen neuen Kandidaten. Die bestehenden V59-CI-Ergebnisse dürfen dafür nicht wiederverwendet werden.

Die statische Sperre wird durch Installation aktiviert. Sie besitzt absichtlich keinen online aufrufbaren Entsperrschalter. Sie wird zuletzt auf das rekonstruierte Zielschema aufgesetzt. Bei später gesondert autorisierter Anwendung müssen die beiden Lock-/Readiness-Dateien in **einer gemeinsamen Transaktion** ausgeführt werden; ihre jeweiligen äußeren `begin;`-/`commit;`-Zeilen sind dabei durch den ausführenden Treiber zu entfernen, wie im geprüften Runner. Keine laufende Umgebung wurde so verändert. Fehlende Voraussetzungen oder Source-Drift müssen die gesamte Transaktion abbrechen.

PostgreSQL-Tabellenlocks und transaktionales DDL bilden die Installationsgrenze; ein nativer Parallelitätsbeweis bleibt ausstehend. Bereits vor Sperrinstallation beim Provider laufende Zahlungsanfragen oder vorhandene Sessions werden durch ein Datenbank-DDL nicht zurückgerufen. Neue Vertragsannahme wird auch für vorbereitete Offers verweigert; bestehende Zahlungs-/Refund-/Reconciliationwege bleiben erhalten. Eine atomare Transaktion mit einem externen Provider wird nicht behauptet.

Die ursprüngliche 60-Schritt-P0-01-Kette und ihr NO-GO bleiben unverändert; P0-05 ist ein separat anzuhängender Kandidat, keine heimliche Production-Migration. Entsperrung, Veröffentlichung, native Abschluss-CI und jeglicher Rollout benötigen ihren jeweiligen späteren Auftrag. **Jetzt STOP.**

## Nachweise

`evidence/production-trade-lock-p0-05-20260925/`: vollständiger isolierter Lauf, 20 Testgruppen, 17 RPC-Signaturen, Source-Inventar, Edge-Read, Außenweltattestierung und SHA-256-Manifest. Der Übergabeexport enthält zusätzlich ein inkrementelles Git-Bundle und einen Patch gegen den V59-Remote-Head. Sie sichern die ungesendeten lokalen Commits für die Fortsetzung; kein kompletter Repository-Export.
