# DUELVANTA – MASTERHANDOUT V60

25.09.2026. **P0-05: lokaler versionierter Branch-Kandidat fertig, isolierte Funktionsmatrix vollständig PASS. Native PostgreSQL-17-/Remote-Abschluss-CI für diesen Kandidaten OFFEN. Kein Production-/Staging-Rollout. Nach diesem Auftrag STOP.**

## Verbindlichkeit

V59 wurde vollständig gelesen. Der Nutzerauftrag autorisierte ausschließlich den P0-05-Kandidaten und isolierte Tests, bei vollständig read-only bleibender Production und Staging; keine Production-Migration, kein Deployment, Merge, keine Stripe-Aktivierung oder echte Zahlung. Dieses V60 und `DUELVANTA_PRODUCTION_P0_05_TRADE_LOCK_2026-09-25.md` vollständig lesen. V59/P0-04, V57/P0-01 und V55/V56 behalten ihre übrigen Nachweisgrenzen und NO-GO-Bedingungen.

## Repository und tatsächlicher Veröffentlichungsstand

Repository `Bennyescaped/duelvanta`; ausschließlich `marketplace-ux-v1`.

- Remote vor und nach Arbeit: `d72334c31376aed549beed879102f58491b72b5e`. Scanner #732 / 36124209015 und Battle #208 / 36124209012 SUCCESS, erneut gelesen. Diese Workflows prüfen V59, nicht P0-05.
- Lokaler technischer P0-05-Commit: `46de590a150722b2e0ae77c401561425512f3725`. Nachfolgender lokaler Dokumentationscommit enthält V60 und Abschlussbericht; dessen SHA steht in der Export-Metadatei und im Git-Bundle.
- Kein Push. Die bestehende Vercel-Git-Automatik kann bei einem Push ein Preview-Deployment auslösen. Das Deploymentverbot wurde durch lokale Versionierung eingehalten; keine Hostingkonfiguration verändert.
- PR #5 weiterhin open/Draft/unmerged; main weiterhin `50f88213571be13255bb52eb489cc28cca660001`.

Der Übergabeexport `DUELVANTA_P0_05_V60_KANDIDAT_2026-09-25.zip` enthält beide Dokumente, Nachweise, Patch und ein inkrementelles Git-Bundle gegen Remote `d72334c3`. Ohne dieses Bundle bzw. diese lokale Arbeitskopie liegt der neue Kandidat noch nicht im Remote-Repository. Beim Fortsetzen lokale Commits zuerst sichern/übernehmen; kein Reset, kein Force-Push, kein stiller Ersatz durch die ältere Remote-Datei.

## P0-05-Ergebnis

Ausgangsdatei `database/market-production-trade-lock-v1.sql` und zugehörige Tests gezielt ergänzt. Keine Änderungen an Produktionsdaten, dem historischen Legal-Migrationskörper, bestehenden API-Handlern oder dem unverriegelten Readiness-Vertrag.

Elf ALWAYS-Trigger sperren neue Listings/Offers/Deals/Orders/Items/Bilder und stillgelegte Swap-Eröffnungen rollenunabhängig. Sie verhindern zusätzlich Angebotsannahme, neue Reservierungen, Vertrags-/Positionsumwidmung und unzulässige Reaktivierung. Reine Eröffnungs-RPCs auch für service_role entzogen. Zwei gezielte Fixed-Price-Funktionsergänzungen blockieren neue und nur vorbereitete Requests; bereits akzeptierte Replays mit existierender Order behalten ihre bisherigen Validierungen.

Rücknahme, Ablehnung, Reservierungsfreigabe, Listing-Abschluss, bestehende Zahlungsprozesse, Problem/Dispute/Storno, Widerruf/Refund, Datenrechte und Order-Abschluss bleiben möglich. Ein separat offline erzeugter Lock-Readiness-Vertrag verhindert, dass die neue ACL/Triggerlage pauschal die Bestandsoberfläche aussperrt. Manipulierter Lock-Trigger ergibt weiterhin `compatible=false`.

Prüfung auf isoliertem PostgreSQL 18.3 / PGlite 0.5.8: rekonstruierte 72-Migrations-Production-Baseline, bestehende 60-Schritt-Kette, anschließend **20 P0-05-Testgruppen PASS**. Alle 17 Eröffnungs-RPCs unter anon/authenticated/service_role aufgerufen; privilegierte physische Schreibversuche einschließlich zusätzlicher Test-Service-Rechte abgewehrt. Echter Checkout-Handler über DB-Testadapter: Neuhandel 409 vor Provideraufruf, akzeptierter Replay 200 mit gemocktem Read. Echte SQL-Bestandsprozesse einschließlich Löschvorbereitung und Refund-Vorbereitung bestanden. Keine echten Provideraufrufe.

Scanner-CI ist für `node tests/production-upgrade-rehearsal.mjs --native --trade-lock` ergänzt. **Dieser neue native Lauf ist nicht ausgeführt.** Keine erfundene native Parallelitäts-, Remote-CI- oder vollständige Provider-End-to-End-Abnahme. Details und Grenzen stehen im Abschlussbericht.

## Außenwelt und bestehende Freigaben

Production `enifiaqsnqtbzylnfrpi`: frisch read-only 72 Migrationen bis `20260911181702`, kein installierter P0-05-Lock. `duelvanta.de` weiterhin Production-Deployment `dpl_ENc313pWZJMSn6y21VbURMEWLMkt`, READY, main50f8821.

V59s vier Environment-Einträge frisch in der Vercel-Oberfläche bestätigt: URL, Anon-Key und Origin Production/Config; Service-Key Production/Secret. Keine Werte aufgedeckt oder verändert. V59s Keyquellen-/Write-only-Grenze unverändert; kein Runtime-Keytest.

Alle sieben deployten Edge-Funktionsquellen aus Production/Staging gelesen; kein zusätzlicher TRADE-Eröffnungspfad. Keine Edge-Ausführung/-Änderung. Staging `xhmjxrcskfhbovhitdej` blieb read-only. Keine Provideraktivierung, Deployments, Nachrichten, tatsächliche Zahlung/Erstattung oder Auth-/Storageänderung.

## Fortsetzung und harte Grenzen

**Jetzt STOP.** P0-05-Kandidat und lokale isolierte Funktionsmatrix sind fertig. Native PG17-/Abschluss-CI und Veröffentlichung bleiben offen, daher weiterhin kein Production-GO und keine pauschale endgültige Release-Abnahme von P0-05.

Vor späterer Veröffentlichung muss der Auftrag mit dem bestehenden automatischen Preview-Deploymentpfad vereinbar sein; hier wurde weder ein Push noch eine Änderung dieses Pfads vorgenommen. Vor jeder Folgeausführung Remote/CI und Quelle erneut prüfen und die noch ungesendeten lokalen Commits berücksichtigen.

Bei später separat autorisierter Lock-Anwendung: Lock-SQL plus eigener Readiness-Vertrag zuletzt und in einer gemeinsamen Transaktion nach der geprüften Upgrade-Kette ausführen; äußere BEGIN/COMMIT der Quelldateien dabei wie im isolierten Runner behandeln. Keine automatische Anwendung auf Staging. Fehlende Voraussetzungen, Source-Drift oder fehlgeschlagene Readiness bedeuten Abbruch. Kein online aufrufbarer Unlock. Externe bereits laufende Zahlungsanfragen werden durch das DDL nicht atomar zurückgerufen; neue Vertragsannahmen sind blockiert, Bestands-Reconciliation bleibt verfügbar.

Keine nachfolgende Phase, Migration, Deploy, Merge oder Stripe-Aktivierung ohne eigenen Folgeauftrag beginnen.
