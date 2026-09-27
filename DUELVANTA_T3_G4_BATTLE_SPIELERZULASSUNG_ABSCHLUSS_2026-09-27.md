# DUELVANTA – T3/G4: BATTLE-Spielerzulassung unter Processing-Hold

27.09.2026 · **PASS als isoliert und nativ geprüfter Branch-Kandidat** · Nicht live · Production NO-GO

## Grundlage und frischer Ausgangsstand

V71 und `DUELVANTA_T3_G3_SCANNER_PROCESSING_HOLD_ABSCHLUSS_2026-09-26.md` wurden vollständig aus den gemeinsamen Projektdateien gelesen. Maßgeblich sind deren enger G4-Auftrag und die bestehenden V68-Abgrenzungen. Die tatsächlichen versionierten Funktionen, Rechte, Browseraufrufe und Abschlusswege wurden frisch geprüft. Production und Staging wurden nicht kontaktiert.

| Gegenstand | Verifiziert |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `66a8c2ca5fc1ac6e84fb688ab841373a22c69516` |
| Ausgangs-CI | Scanner #742 / Battle #218 SUCCESS |
| Technischer G4-Head | `e85d136587cab3f08fbba06fc9a368e8a793852e` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner technische Abnahme | [#743 / 36305197604](https://github.com/Bennyescaped/duelvanta/actions/runs/36305197604), SUCCESS |
| Battle technische Abnahme | [#219 / 36305197589](https://github.com/Bennyescaped/duelvanta/actions/runs/36305197589), SUCCESS |
| Native Datenbank | PostgreSQL 17.11 (`170011`) |
| G4 | **22/22 Ergebnisgruppen PASS** |
| Vollständiger G1-Test mit G2/G3/G4 | **20/20 PASS** |
| Vollständiger G2-Test mit G3/G4 | **19/19 PASS** |
| Vollständiger G3-Test mit G4 | **24/24 PASS** |
| Vollständiger T2-Test mit G1/G2/G3/G4 | **18/18 PASS**, 96 Tabellen/15 Sequenzen |
| Vollständige rekonstruierte Upgrade-Kette mit G4 | PASS |

Git und GitHub bestätigten denselben Ausgangsstand. Der technische Kandidat wurde nach vollständigem isoliertem PASS ausschließlich auf marketplace-ux-v1 veröffentlicht; danach erfolgten native Abnahme und vollständige CI. Kein veröffentlichter CI-FAIL. Bericht und V72 folgen als reine Dokumentationsrevision. Endgültiger Remote-Head und vollständige Abschluss-CI stehen in `verification.json` im Evidenzpaket; dieser angekündigte Dokumentationsfolger ist keine fachliche Drift.

## Tatsächliche Zulassungs- und Abschlusswege

Die Prüfung nutzt den aus versionierten Quellen rekonstruierten Stand mit P0-02/P0-05/T2/G1/G2/G3. **Keine neue Live-Katalog-Attestierung** für Production oder Staging.

| Pfad | Tatsächliches Verhalten / G4-Abgrenzung |
|---|---|
| `create_battle_match(text,text,text,text)` | Bestehender SECURITY-DEFINER-Wrapper ruft V2 mit casual auf; Wrapper unverändert |
| `create_battle_match_v2(text,text,text,text,text)` | Einzige eigentliche Create-Implementierung; casual/ranked, public/private, TCG-/Mode-/Kontostatus-/Safety-/Aktivmatchprüfung; eigene neue Hold-Prüfung |
| `join_battle_match(uuid,text)` | ID, Einladungscode und bestehender Host-Replay; Teilnehmer-, Privatcode- und Matchstatusgrenzen erhalten; eigene neue Hold-Prüfung vor Matchänderung |
| `set_battle_ready(uuid,boolean)` | Host/Gast, true/false; bestehende Teilnehmer-, Moderations- und Statusprüfung; eigene neue Hold-Prüfung |
| `start_battle_match(uuid)` | Nur Host, Gegenpart vorhanden, beide bereit, zulässiger Status und nicht moderiert; eigene neue Hold-Prüfung |
| Direkte Match-DML | Nach P0-02 kein INSERT/UPDATE/DELETE für authenticated/service_role; bleibt unverändert |
| Privilegierte Kontexte | Bestehende öffentliche DEFINER-RPCs bleiben mit vorhandenen ACLs subject-bound; ein service_role-/Owner-Kontext ist keine neue Hold-Ausnahme |
| `report_battle_result` | Unverändert: vorhandene Teilnehmer können Ergebnis melden, Konflikt erzeugen/korrigieren und abschließen |
| Ranked-Abschluss | Unveränderter Trigger schreibt Ratings und genau einen Match-Ratingbeleg mit beiden Teilnehmern |
| `get_my_battle_history`, `get_my_battle_ratings` | Eigene bestehenden Nachweispfade unverändert; kein neuer allgemeiner Leseguard |
| `report_battle_user` | Bestehender teilnehmergebundener Report bleibt möglich; Fremdreport bleibt gesperrt |
| `leave_battle_match` | Bestehendes Host-Cancel bzw. Gast-Verlassen vor laufendem Match erhalten; keine Löschung, keine neue Leave-Semantik für live/dispute |
| Browser `battle.js`, `battle-ranked.js` | Verwenden die geprüften RPCs und zeigen deren Fehler; unverändert |
| `battle-safety.js` | Bestehendes Safety-/Consent-Gate unverändert; Processing-only erzeugt keinen neuen Komplettblock der Oberfläche |
| `battle-webrtc.js` | Bestehende Ready-/Stop-Aufrufe unverändert; kein neuer Medien-/Signalisierungsguard |

Der Katalog bestätigt genau zwei Create-Signaturen: Legacy und V2. Beide sind dynamisch getestet. Vor G4 wurden bei A und B unter reinem Processing-Hold alle 13 unten benannten Varianten erfolgreich reproduziert und zurückgerollt.

## Einzige funktionale Änderung

`database/battle-player-processing-hold-v1.sql` ersetzt exakt vier vorhandene Funktionskörper: Create V2, Join, Ready, Start. Keine neue Funktion, Tabelle, Policy, Rolle, ACL oder Trigger. Der Legacy-Wrapper und alle anderen Katalogeinträge einschließlich G1/G2/G3/T2, Abschluss-, Rating-, Report- und Signalfunktionen bleiben unverändert. Die vorhandenen SECURITY-DEFINER-Inhaber, search_path-Einstellungen, Signaturen und Ausführungsrechte werden zusätzlich separat verglichen.

Die Zulassung bleibt an **auth.uid(), den handelnden Nutzer**, gebunden. Create liest das eigene Profil nun mit FOR SHARE und prüft nach der unveränderten Safety-Grenze zusätzlich `data_processing_restricted_at IS NOT NULL`. Join, Ready und Start sperren die eigene Profilzeile ebenfalls mit FOR SHARE und prüfen nach ihrer unveränderten Kontostatus-/Safety-Grenze denselben Marker. Bei Hold folgt `42501 / account_data_processing_restricted`, bevor Matchdaten geschrieben werden.

Damit wird die Neuzulassung mit Profil-Hold-Schreibvorgängen geordnet. Es gibt keine Rollen-/JWT-/GUC-Ausnahme. Safety bleibt unabhängig wirksam: Das vollständige Closure-Paket und ein Safety-only-Profil erzeugen weiter die bisherigen Safety-Fehler; die eigenständige Processing-only-Prüfung beweist zusätzlich den neuen Guard.

Es wird **kein Match-weiter Guard auf andere Teilnehmer** eingeführt und kein bestehendes Match nachträglich abgebrochen oder gelöscht. Ein vor dem Hold bereits abgeschlossener Zulassungsschritt wird nicht rückwirkend widerrufen. G4 ändert weder laufende Medien noch Signalisierung oder allgemeine Read-/Abschlussberechtigungen.

`database/battle-player-processing-hold-readiness-v1.sql` wird offline für die vollständige Kette bis G4 erzeugt: 424 Security- und 270 Legal-Katalogprüfungen. Der alte G3-Vertrag erkennt die geänderten Körper als inkompatibel; der passende G4-Vertrag besteht. Wiederherstellen des alten Start-Körpers lässt die G4-Readiness geschlossen bleiben. `--battle-player-hold` verlangt die G3-Basis. Der bisherige G3-Vertrag wurde separat unverändert gegengeprüft. Historische Migrationen bleiben unverändert; keine Live-Anwendung.

## Native Positiv-/Negativnachweise

A ist synthetischer beta-Nutzer, B synthetischer active-Nutzer; C dient als unbetroffener Kontroll-/Fremdnutzer. Zusätzliche Owner-Identität nur in der isolierten Fixture. Es gibt keine Medien-, Netzwerk- oder Provideraufrufe.

| Geprüfter Fall auf PostgreSQL 17.11 | Ergebnis |
|---|---|
| A/B, Normalzustand | Alle 13 Spieleraktionen erlaubt |
| A/B, Processing-only | Alle 13 Spieleraktionen abgewiesen; Matchdaten unverändert |
| A/B, echtes Closure-Paket | Alle 13 Spieleraktionen durch bestehende Safety-Grenze abgewiesen; Matchdaten unverändert |
| A/B, Safety-only | Bisherige Safety-Sperre unverändert wirksam |
| 13 Varianten | Legacy Create; V2 casual/ranked/private; Join per ID/Code/private ID; Host-Replay; Host/Gast Ready jeweils true/false; Start |
| Kontrollnutzer C | Eigene neue Ranked-Erstellung bleibt in jeder Zustandsgruppe möglich |
| Host-/Gast-/Privatcodegrenzen | Fremdes Ready, Nicht-Host-Start und privater Join ohne passenden Code weiterhin verweigert |
| Direkte INSERT/UPDATE/DELETE-DML | authenticated und service_role weiterhin per ACL abgewiesen |
| anon / fehlendes Subjekt | Bestehende Ablehnung erhalten |
| service_role-/Owner-DEFINER-Kontext | Normalzustand funktioniert; gesetzter Hold wird auch mit gefälschtem JWT-role und clientsetzbarer GUC verweigert |
| Suspended-Kontostatus | Weiterhin unabhängig von Hold/Safety verweigert |
| A/B, normal/Processing-only/Closure: Ergebnis | Meldung → Konflikt → übereinstimmende Korrektur → completed funktioniert |
| Ranked-Nachweis | Eigene Ratings erhöht; genau ein Beleg je Match für beide Teilnehmer |
| Eigene History/Ratings/Report | Funktionsfähig; fremde History leer, Fremdergebnis/Fremdreport verweigert |
| Host-Cancel / Gast-Verlassen vor Start | Bestehende Funktion erfolgreich; Matchzeilen bleiben erhalten |
| Browser-Safety im tatsächlichen JS-Modul | Normal/Processing-only lässt bestehende Oberfläche erreichbar; Safety/Closure behält bisherige Ausblendung |
| Native Konkurrenz A und B | Je Legacy Create, V2 Create, Join, Ready, Start: tatsächlicher Profil-Hold hält den RPC nachweislich auf; nach Commit wird er abgewiesen, keine Matchänderung |

Die zehn Konkurrenzfälle prüfen reale Sperren mit `pg_blocking_pids`, nicht nur Zeitabstände. Anschließendes Entfernen synthetischer Marker dient ausschließlich der Fixturebereinigung als Datenbankinhaber und ist keine neue Anwendungsfreigabe.

Die vorhandene Closure-/Safety-Ausblendung der Browseroberfläche wird nicht verändert. Die SQL-Abschlussnachweise unter Closure behaupten deshalb keine neu geschaffene Browserverfügbarkeit. Für Processing-only wird gezielt kein pauschaler Shell-Block ergänzt, der Ergebnis-/Nachweiswege verstecken würde. Ready=false bleibt Bestandteil des bestehenden Ready-RPCs und wird unter Hold ebenfalls verweigert; keine neue Rücknahme-Ausnahme definiert. Der unveränderte lokale Medien-Stop behandelt eine RPC-Fehlerrückgabe weiter nach seinem bisherigen Ablauf.

## Regressionen und Reproduktion

G1, G2, G3 und T2 wurden jeweils vollständig mit installiertem G4 ausgeführt. G1 enthält die native Marker-/Collection-Konkurrenz, G2 die native RPC-/DML-Veröffentlichungskonkurrenz, G3 die realen SQL-/Handlerprüfungen mit Provider-Stubs und native Reservierungskonkurrenz. T2 erhält Hashbindung, Fremdfilter und Audit-only-Schreiben über 96 Tabellen/15 Sequenzen. Sämtliche vorhandenen Scanner-/Battle-, Quoten-, P0-02/MFA-, P0-05-, F3- und Browserprüfungen sowie die rekonstruierte Upgrade-Kette bestehen.

```sh
node tests/generate-security-readiness.mjs --data-export --trade-lock --processing-markers --closure-privacy --scanner-hold --battle-player-hold --check
node tests/battle-player-processing-hold-test.mjs --native
node tests/account-processing-markers-test.mjs --native --closure-privacy --scanner-hold --battle-player-hold
node tests/account-closure-privacy-test.mjs --native --scanner-hold --battle-player-hold
node tests/scanner-processing-hold-test.mjs --native --battle-player-hold
node tests/production-upgrade-rehearsal.mjs --native --trade-lock --data-export --processing-markers --closure-privacy --scanner-hold --battle-player-hold
node tests/account-data-export-collect-battle-test.mjs --native --trade-lock --processing-markers --closure-privacy --scanner-hold --battle-player-hold
```

PGlite bestand vor Veröffentlichung; es ersetzt die native Abnahme nicht. Der native Harness erlaubt ausschließlich localhost/127.0.0.1 und PostgreSQL-Hauptversion 17; Wegwerfdatenbanken werden entfernt. Während lokaler Testentwicklung wurden nur Fixture-/Assertiondetails korrigiert: eindeutige Einladungscodes und die bestehende Ein-Beleg-je-Match-Struktur. Keine Anwendungskorrektur zur Abschwächung der Anforderungen.

Originales GitHub-Artefakt: `10927290317`, SHA256 `72fc07fd0156d3f7639fc26eeb9d781f654a791a12fd9cd15495da78ff54dee6`, vor Extraktion geprüft. `DUELVANTA_T3_G4_EVIDENZ_2026-09-27.zip` enthält Original-ZIP, native Reports/Logs, ergänzende lokale Nachweise, Quellstände, Hashes, Browser-/Quelleninventar sowie endgültigen Remote-/PR-/CI-Abgleich.

## Grenzen und exakt ein nächster Block

G4 ist ein Branch-Kandidat, nicht live wirksam. Production und Staging unverändert und nicht kontaktiert; main unverändert; PR #5 offen/Draft/unmerged. Ausschließlich marketplace-ux-v1 veröffentlicht; automatisches Preview erlaubt. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Keine Matchlöschung und keine neue Semantik für bestehende Matches/In-flight-Verarbeitung. G5/Signalisierung, Storage, laufende Medien, Retention, Erasure, T1/T4–T6, Rechtstexte, Provider, Mail und Stripe nicht bearbeitet. Bestehende Regressionen verwenden ihre bisherigen ausschließlich synthetischen Untertests. PITR OFF und Production NO-GO bleiben bestehen.

**Exakt ein nächster fachlicher Block: T3/G5 – neue BATTLE-Signalisierung über den bestehenden Schreibpfad an den vorhandenen Processing-Hold binden; bestehende Cleanup-/Nachweispfade erhalten.** Erst nach gesondertem ausdrücklichem Auftrag. Keine neue Lesesperre oder Abbruchregel für laufende Medien voraussetzen. Nicht begonnen.

Bericht, V72 und Evidenzpaket zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. **G4 abgeschlossen. STOP.**
