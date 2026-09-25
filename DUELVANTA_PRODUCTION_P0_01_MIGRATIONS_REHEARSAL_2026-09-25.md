# DUELVANTA – P0-01: quellengebundene Migrationskette und isoliertes Rehearsal

25.09.2026. **PASS für die rekonstruierte Anwendungsschema-Kette von der aktuellen Production-Baseline zum freigegebenen V55/V56-Ziel, einschließlich synthetischer Bestandsdaten und transaktionalem Abbruch/Wiederanlauf. Production bleibt NO-GO.** Kein Nachweis eines vollständigen Supabase-Service-/Provider-Rollouts oder eines neuen physischen Production-Datenklons.

## Auftrag und Ausgangspunkt

V56 vollständig gelesen; der aktuelle Abschnitt vor dessen historischen Zwischenständen ist verbindlich. Auftrag ausschließlich P0-01. Vor Arbeit Remote `108b371a5fd144ee4c964dd8c66a52d8c30124db` bestätigt; Scanner724 / 36094436937 und Battle200 / 36094436955 SUCCESS. Nur Branch `marketplace-ux-v1`, Repository `Bennyescaped/duelvanta`. main bleibt `50f88213571be13255bb52eb489cc28cca660001`; PR5 offen, Draft, unmerged.

Production `enifiaqsnqtbzylnfrpi` und Staging `xhmjxrcskfhbovhitdej` ausschließlich gelesen. Kein apply_migration, Quell-DDL/DML, Auth-/Storageeingriff, Secret-/Providerwechsel, manueller Deploy oder Merge. Keine neue Cloudressource. P0-04 und P0-05 nicht begonnen. Automatischer Freigabeprüfer lehnte einen lokalen Fast-forward ab; nicht wiederholt. Veröffentlichung neuer Einzel-Eltern-Commits ausschließlich auf dem vorhandenen Arbeitsbranch, kein Force-Push. Die von GitHub für PR-CI erzeugte Test-SHA ist kein Merge des PR in main.

## Verbindlicher Kandidat und Herkunft

`database/production-upgrade-manifest-v1.json` bindet **72 historische Production-Migrationen plus 60 geordnete Upgrade-Schritte U001–U060**. Jeder Schritt hat SHA256 und expliziten Vorgänger. Die Reihenfolge ist konservativ total geordnet; kein beliebiges Dateiglob und kein automatisches Wiederholen aller Staging-Historyeinträge. Status bleibt `CANDIDATE_NOT_AUTHORIZED_FOR_PRODUCTION`.

- Production-History bis `20260911181702`: archivierter, read-only gelesener SQL-Quelltext in `tests/fixtures/production-upgrade/production-history-source.json.gz`. Keine Auth-/Geschäftsdaten exportiert.
- Foundation: versionierte Seller-, Notice-, Checkout-, Tax-, Data-Rights-, Sandbox- und Payment-Hardening-Quellen. Notice stammt exakt aus dem im Manifest vollständig benannten Commit `61404cf…`; spätere pgcrypto-Härtung bleibt eigener Schritt.
- Weitere Abhängigkeiten: tatsächliche, gehashte SQL-Statements der Staging-History in `database/production-upgrade/staging-history-source.json.gz`, nach Version aufgelöst. Historische Swap-Objekte sind Archiv-/Abhängigkeitsbestand, keine Wiedereinführung des Tauschprodukts.
- `get_my_market_swaps_v1`: expliziter, gehashter Quellbereich der bestehenden Pickup-Datei, da in den aufgeteilten History-Statements fehlend.
- `get_my_trade_actions`: die historische Alias-Korrektur würde Payment-Gates überschreiben. Der nachfolgende versionierte Funktionsquelltext erhält diese Gates; der Test verifiziert Token-Gleichheit einschließlich Stringliteralen gegen die Repository-Payment-Hardening-Quelle. Formatierung stammt aus dem bereits versionierten, freigegebenen Katalog. Keine Generierung einer Sollmigration aus heutiger Live-Drift.
- `source-ledger.json` klassifiziert alle 75 betrachteten SQL-Quelldateien einschließlich Baseline, historischer Varianten, Duplikate und nicht freigegebener Review-/Zukunftskandidaten. Die unveränderte freigegebene Security-/Legal-Readiness ist das Ziel; weitergehende Review-SQL wird nicht still aufgenommen.

### Bewusst getrennte Betriebsbestandteile

Der vorhandene private Market-Bucket wird erhalten. Kein Bucket-Neuanlegen über vorhandenen Inhalt. pg_net-/Vault-Scheduler-Aktivierung ist nicht Teil des isolierten SQL-Laufs. Vault ist in Production bereits vorhanden. Beim Tracking-Delivery-Schritt enthält das Manifest den exakten ausgeführten Präfix und SHA256 des zurückgestellten Cron-Teils; keine versteckte SQL-Entfernung. Scheduler/Edge/Providersecrets benötigen die separate P0-04-Zielbindungsabnahme. P0-05 muss seinen späteren serverseitigen Lockkandidaten ergänzen. Diese offenen Gates verhindern eine Production-Ausführungsfreigabe dieses Manifests.

Vorhandene Edgequellen `invite-beta-user`, `owner-invite-beta-user`, `battle-spectator-media-broker` und `battle-spectator-media-reconciler` bleiben im Repository. Die im V51-Preflight inventarisierten Funktionen `public-card-image` und `battle-spectator-media-inspect` werden weder still gelöscht noch mangels geprüfter Quelle in ein Deployment übernommen. Hier keine neue Providerinventur oder Edge-Ausführung; bestehende P0-04-Grenze bleibt offen.

## Baseline und Datenprüfung

Die isolierte Datenbank entsteht aus allen 72 historischen SQL-Migrationen. Frisch read-only erfasster Production-Anwendungskatalog stimmt damit überein:

| Vergleich | Anzahl |
|---|---:|
| Spalten | 513 |
| Indizes | 95 |
| Constraints | 309 |
| Policies | 31 |
| Trigger | 19 |
| Relationen mit ACL/RLS | 47 |
| Funktionsdefinitionen, exakte MD5 | 144 |

Native PostgreSQL17 benötigt hierfür keine Katalognormalisierung. Die zusätzliche lokale PGlite/PG18-Probe ignoriert ausschließlich deren zusätzlich ausgewiesene NOT-NULL-Katalogeinträge. Managed Auth/Storage werden im Runner durch minimale benötigte Tabellen/Funktionen modelliert; kein vollständiger Supabase-Stack behauptet.

Zwei Szenarien: leere Anwendungsdaten nach historischer Baseline sowie synthetische bestehende Zustände nach Production-Aggregaten: 17 Nutzer/Profile, 53 Collection-Items, 5 Ordner, 8 Listings, 3 Angebote, 9 Deals, 7 Orders mit 9 Positionen, 4 abgeschlossene Problem-/Stornofälle, 19 Benachrichtigungen und 4 abgeschlossene/abgebrochene Battles. IDs und Inhalte sind synthetisch. Triggerunterdrückung nur beim lokalen Fixtureaufbau, danach FK-Prüfung und normale Migrationen. Keine Production-Bestandszeilen in Git oder CI.

Ein früherer Kandidat spielte bereits in Production enthaltene Order-Resolution-Migrationen erneut ab. Mit den erweiterten Benachrichtigungszuständen scheiterte deren vorübergehend engerer CHECK. Die endgültige Kette entfernt diese beiden redundanten Schritte. Die einzige spätere Alias-Änderung wird durch die expliziten Alias-/Payment-Schritte geliefert. Keine Löschung oder Umdeutung historischer Benachrichtigungen zur Umgehung des Fehlers.

## Ergebnisse und Recoverygrenze

- Alle 60 Schritte erfolgreich; Security `privilege-mfa-v1` und Legal `trade-legal-contract-model-v1.2` compatible=true. Unverändertes Soll, Readiness-Diff **0**.
- Sämtliche ursprünglichen Felder und Zeilen aller 39 Anwendungstabellen bleiben per Hash/Zählung erhalten. Neue Spalten sind erlaubt. 74 FK-Prüfungen vor und 172 nach Upgrade, jeweils 0 Orphans.
- Keine erfundenen Legacy-Verträge, Payment-, Tax-, Outbox-, Eligibility- oder Legal-Profil-Backfills. Seller-Seed ausschließlich `unclassified / legacy_beta`; Operatorbindung an den synthetisch eindeutig vorhandenen Betreiber.
- Stripe sandbox/live=false, Media=false, keine Cron-/pg_net-Aktivierung, keine Authsessions. Keine externen Provideraufrufe aus dem Rehearsal.
- Bestehender Order-RPC liefert dem beteiligten Nutzer 7 Orders, fremdem Nutzer 0; direkte Browser-Tabellenleserechte verweigert. Action-/Status-RPCs funktionieren. Owner ohne MFA bleibt abgewiesen.
- Tatsächliche erste Seller-Migration innerhalb einer Transaktion ausgeführt; anschließend injizierter Fehler. ROLLBACK entfernt deren DDL/Backfill und erhält die Baseline. Vollständige Kette danach erfolgreich erneut ausgeführt. Isolierte Datenbank anschließend geschlossen/gelöscht.

Die geprüfte Rückfallkompatibilität umfasst diese bestehenden Lese-/Abwicklungsverträge und den transaktionalen Abbruch. **Kein pauschaler Nachweis, dass jeder alte main-Schreibpfad nach einem späteren Rollout weiterverwendet werden darf.** Kein destruktiver Down-Migrationsplan über neue Geschäftsvorfälle. Bei späterer Störung muss Neugeschäft kontrolliert gesperrt und Recovery separat verantwortet werden; P0-05 bleibt dafür offen. Der bereits abgeschlossene 9C-Recovery-Nachweis gilt mit seinen unveränderten V56-Grenzen. Hier kein neuer vollständiger DB/Auth/Storage-Restore und kein echter MFA-Endnutzerlogin.

Production hat aktuell 0 verifizierte MFA-Faktoren; die fail-closed Ownergrenze ist kein Beleg betrieblicher Owner-Recoverybereitschaft. Vor späterem Rollout sind Quelle/Bestandszustände und Operatorbindung erneut zu prüfen; unerwartete Datenzustände bedeuten STOP statt opportunistische Backfills.

## Ausführung und reproduzierbare Evidenz

Runner `tests/production-upgrade-rehearsal.mjs`, Prüfungen `tests/helpers/production-upgrade-checks.mjs`, Fixture unter `tests/fixtures/production-upgrade/`. Bestehende gepinnte CI-Abhängigkeiten. Lokal: `node tests/production-upgrade-rehearsal.mjs --empty` und ohne `--empty`. Native isolierte CI: dieselben Aufrufe mit `--native`; Helper akzeptiert nur das lokale Wegwerfziel, keine Production-URL.

Finaler technischer Commit `3aa580c0bc50c67464e451c503c1e0c6fa17b328`. Scanner729/36097395824 und Battle205/36097395749 vollständig SUCCESS. Native Job107952432342 SUCCESS, beide Szenarien am 25.09.2026 05:10:05–05:10:08UTC PASS. CI-Test-SHA `752fd3c8aadcda27111774569fdca944c90ea8ad`. Artifact10847009152, SHA256 `e895c41b7b046b1111353451fba0697f550c6891140006aa37f86fa4c4571908`; heruntergeladen und Hash geprüft. Die zwei vollständigen nativen Ergebnis-JSON und der leere Readiness-Diff sind dauerhaft im Evidenzverzeichnis versioniert. Der PostgreSQL-Service ist Version17; Managed Production ist17.6. Kein Anspruch auf identische Provider-/Patchversion.

Evidenz `evidence/production-upgrade-p0-01-20260925/`: frischer Quellkatalog, Funktions-/Zustandsinventar, Production-Vorbedingungen, native Ergebnisse und Abschlussstatus. Abschließender READ ONLY am25.09.05:10:02UTC: History72, letzte20260911181702, History-MD5 `148fa579ebd248c169d39102480b53a0`, exakt gleich dem archivierten SQL-Quellbestand. Keine Quellmigration erfolgt.

Abschluss-CI und Remotehead des reinen Dokumentationsnachfolgers sind im Chatabschluss frisch zu bestätigen. Keine neue SQL-/Teständerung nach dem technischen PASS. **Nach P0-01 STOP; P0-04/P0-05 nur nach gesondertem Auftrag. Production NO-GO bleibt bestehen.**
