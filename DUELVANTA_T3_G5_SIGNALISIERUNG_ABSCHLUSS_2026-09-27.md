# DUELVANTA – T3/G5: neue BATTLE-Signalisierung unter Processing-Hold

27.09.2026 · **PASS – isoliert und nativ geprüft** · Branch-Kandidat, nicht live · Production NO-GO

## Verbindliche Grundlage und frischer Ausgangsstand

V72 und `DUELVANTA_T3_G4_BATTLE_SPIELERZULASSUNG_ABSCHLUSS_2026-09-27.md` vollständig aus den gemeinsamen Projektdateien gelesen. Für G5 und die getrennten D1–D4-Entscheidungen wurde der V68-Nachweis herangezogen. Kein Folgeblock begonnen.

| Gegenstand | Stand |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `63f89099c481653b2d4f5781ac1f3ac3835d5249` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Ausgangs-CI | Scanner #744 / Battle #220 SUCCESS |
| Technischer G5-Head | `0493d7d0e1765b1d9e727a7136a997a53c4c888c` |
| Technische Scanner-CI | #745 / Run 36313759098, SUCCESS |
| Technische Battle-CI | #221 / Run 36313759325, SUCCESS |

Git ls-remote und GitHub bestätigten denselben Ausgangsstand. Der technische Kandidat wurde nach vollständigem isoliertem PASS ausschließlich auf marketplace-ux-v1 veröffentlicht. Native Abnahme und vollständige CI folgten auf der bestehenden isolierten PostgreSQL-17-CI. Bericht und V73 folgen als reine Dokumentationsrevision; deren endgültiger Head und vollständige Abschluss-CI stehen in `verification.json` im Evidenzpaket. Keine fachliche Drift durch diesen angekündigten Dokumentationsfolger.

## Tatsächliche Signal-, Realtime- und Cleanup-Pfade

Die Prüfung beruht auf versionierten Quellen und der bestehenden datenfreien Rekonstruktion einschließlich P0-02/P0-05/T2/G1/G2/G3/G4. **Keine Live-Katalog-Attestierung:** Production und Staging wurden nicht kontaktiert.

| Pfad / Grenze | Verifizierter Ausgangsstand und Erhaltung |
|---|---|
| Browser `battle-webrtc.js`, `sendSignal` | Direkter `battle_signals`-INSERT mit currentMatch.id, user.id, Typ und JSON-Payload; kein Signal-Insert-RPC |
| Neue Signaltypen | `offer`, `answer`, `ice`, `hangup`; alle vier nutzen denselben Schreibpfad |
| Realtime | `postgres_changes`, Event INSERT, Tabelle public.battle_signals, Filter match_id. Keine alternative Broadcast-Signalschreibstrecke im untersuchten Player-Pfad |
| Reconnect-/Initiallesen | `subscribeSignals` ruft Clear, abonniert den Matchkanal und liest bis zu 80 Signale nach id; eingehende Signale gehen an handleSignal |
| INSERT-RLS | sender_id=auth.uid(), Host/Gast des Matches, Status waiting/ready/live/dispute. Diese bestehende Policy bleibt exakt unverändert |
| SELECT-RLS | Nur Matchteilnehmer, keine neue Hold-Lesesperre; bestehende Statusreichweite unverändert |
| P0-02 ACL | authenticated SELECT/INSERT und Sequenz-USAGE; kein UPDATE/DELETE. anon/service_role haben keine direkten Tabellenrechte. Unverändert |
| `clear_my_battle_signals(uuid)` | Bestehender SECURITY-DEFINER-RPC, postgres, search_path public; aktuelle Matchteilnahme erforderlich. Löscht eigene Signale oder Signale dieses Matches, die älter als einen Tag sind |
| Clear-ACL | Bestehende authenticated/service_role-Ausführungsrechte und Teilnehmerprüfung erhalten; kein neuer Clear- oder Ausnahme-RPC |
| Nachweise | T2 exportiert vorhandene eigene Signal-Metadaten gemäß bestehender Projektion. Matchabschluss/History/Rating/Report bleiben in G4-Regressionsumfang erhalten |

Der isolierte Ausgangsnachweis reproduziert für A und B alle vier neuen Signaltypen trotz reinem Processing-Hold sowie trotz echtem Closure-Paket. Fremdschutz greift bereits. Das ist die gezielt geschlossene G5-Lücke.

## Einzige funktionale Änderung

`database/battle-signal-processing-hold-v1.sql` ergänzt genau eine Triggerfunktion und einen BEFORE INSERT FOR EACH ROW-Trigger auf `public.battle_signals`. Der Guard liest `profiles.data_processing_restricted_at` für **NEW.sender_id** mit FOR SHARE. Bei nicht-NULL folgt `42501 / account_data_processing_restricted`, bevor das neue Signal gespeichert wird.

Für normale Nutzer bindet die unveränderte RLS NEW.sender_id weiterhin an auth.uid() und die bestehende Matchteilnahme. Die Prüfung des tatsächlichen Senders gilt auch bei privilegierten INSERTs und bei Owner-SQL ohne JWT-Subjekt: keine neue Service-/Owner-/GUC-Ausnahme. Vorhandene Service-DML wird unverändert bereits durch ACL verweigert. Die Triggerfunktion läuft SECURITY DEFINER mit festem search_path `pg_catalog, public`; direkte EXECUTE-Rechte sind PUBLIC/anon/authenticated/service_role entzogen. Sie ist kein neuer öffentlicher RPC oder Freigabepfad.

Der Profilzeilen-Lock ordnet neue Inserts gegenüber gleichzeitigem Hold-Schreiben. Bereits gespeicherte Signale werden durch Hold-Setzen nicht entfernt. Keine Änderungen an SELECT, UPDATE, DELETE, Clear, Teilnehmer-RLS, ACL, bestehenden Funktionen, Tabellenstruktur oder Profilmarkern. Ein privilegierter Datenbankinhaber kann weiterhin DDL ausführen; G5 behauptet keinen Schutz gegen einen absichtlich deaktivierten Trigger durch den Inhaber. Der neue Readinessvertrag erkennt fehlenden/deaktivierten Trigger und verweigert Kompatibilität.

`database/battle-signal-processing-hold-readiness-v1.sql` umfasst **426 Security- und 270 Legal-Prüfungen**. Neben der neuen Funktionsdefinition attestiert er gezielt Definition und Aktivierungszustand des Signaltriggers. Alle bisherigen Verträge und deren Standard-Katalogquery bleiben unverändert; `--battle-signal-hold` verlangt G4. Fehlender oder deaktivierter Trigger lässt G5-Readiness geschlossen bleiben. Der bisherige G4-Vertrag wurde separat bytegenau gegengeprüft.

Alle Browserdateien bleiben unverändert. `hangup` ist ein neuer Signal-INSERT und wird ebenfalls blockiert; keine Sonderausnahme erfunden. Der vorhandene lokale Stop schließt/stoppt seine lokalen Objekte bereits unabhängig von einer erfolgreichen Signalantwort und bleibt unverändert. G5 löst keinen Medienstop aus und definiert keine neue Wirkung auf die Gegenpartei, laufende WebRTC-Verbindungen, bereits gesendete/empfangene Signale oder In-flight-Verarbeitung. Clear ist davon getrennte bestehende DELETE-Verarbeitung und bleibt zugelassen.

## Isolierte und native Abnahme

| Suite mit installiertem G5 | Native PostgreSQL 17.11 (`170011`) |
|---|---|
| G5 Signale | **20/20 PASS**, einschließlich acht echter Konkurrenzfälle |
| G4 Spielerzulassung | **22/22 PASS** |
| G1 Markerintegrität | **20/20 PASS** |
| G2 Privatstellung | **19/19 PASS** |
| G3 Scanner/Accounting | **24/24 PASS** |
| T2 Export/Audit | **18/18 PASS** |
| Rekonstruierte Upgrade-Kette | PASS |

Lokale Vorprüfung: G5 19/19, G4 21/21, G1 19/19, G2 17/17, G3 22/22, T2 18/18 PASS. Native Konkurrenzfälle kommen zusätzlich hinzu. Alle sieben Jobs der Scanner-/Battle-CI SUCCESS.

A=synthetischer beta-Nutzer, B=synthetischer active-Nutzer, C=Fremd-/Kontrollnutzer. Keine echten Kontoschließungen, Providercredentials, Medien-, STUN-/TURN- oder sonstigen externen Verbindungen.

| Nachweis | Ergebnis |
|---|---|
| A/B Normal | Alle vier Signaltypen erlaubt |
| A/B Processing-only und Closure | Alle vier neuen Signaltypen verweigert; bereits vorhandene Signale unverändert |
| Unbetroffene Gegenpartei | Alle vier Typen im selben Match weiter möglich; kein Match-weiter Sperrmechanismus |
| Eigener Teilnehmer-SELECT | Bestehende Signale in allen drei Zuständen lesbar |
| Fremdnutzer | SELECT leer; INSERT und Clear verweigert |
| Senderfälschung / fremdes Match | Unveränderte RLS verweigert |
| Matchstatus | waiting/ready/live/dispute erlaubt, completed/cancelled verweigert; keine neue Statussemantik |
| Clear unter Hold/Closure | Eigene und bereits alte Signale dieses Matches gemäß bestehender Regel entfernt; frische Gegenparteisignale bleiben; Match bleibt live |
| Browser | Tatsächliche unveränderte sendSignal-/subscribeSignals-Funktionen im VM-Kontext, SQL-gestützter Transport: vier Schreibversuche, Hold-Fehler, Clear, Initiallesen und bestehender Realtime-Callback geprüft |
| Privilegierte Kontexte | JWT-role-/GUC-Manipulation ohne Wirkung; direkter Owner-INSERT mit/ohne Subjekt prüft gesperrten Sender; bestehender Definer-Clear mit authenticated/service_role/Owner behält Teilnahmegrenze |
| ACL | anon/service_role direkte Inserts weiterhin verweigert; direkte UPDATE/DELETE sowie direkter Guard-Aufruf verweigert |
| Readiness | Kandidat zweimal installierbar; fehlender/deaktivierter Trigger wird erkannt |
| Native Konkurrenz | A und B, jeweils alle vier Typen: INSERT wartet nachweislich (`pg_blocking_pids`) auf offenen Hold-Schreibvorgang, verweigert nach dessen Commit, keine Signalzeile gespeichert |

Der Browsernachweis ist eine Ausführung des ausgelieferten JS mit SQL-Brücke und isolierten DOM-/Realtime-Doubles; keine Behauptung eines neuen Live-Realtime- oder Geräte-/Medien-E2E-Tests. Die bisherige vollständige Battle-CI prüft ihre vorhandenen Browser-/Transportfälle unverändert. Profilmarker werden nur für synthetische Fixturebereinigung als DB-Inhaber zurückgesetzt; keine Anwendungsentsperrung eingeführt.

## Vollständige Regressionen und Reproduktion

G1/G2/G3/G4/T2 wurden jeweils vollständig mit installiertem G5 ausgeführt; keine verkürzten Ersatztests. Native Marker-/Collection-, Privatstellungs-, Scannerreservierungs- und G4-Zulassungskonkurrenz bleiben enthalten. G3 nutzt ausschließlich Provider-Stubs. T2 erhält vorhandene Projektionen, Fremdfilter und genau ein hashgebundenes Audit-Event je Export über 96 Tabellen/15 Sequenzen. Die rekonstruierte Upgrade-Kette sowie P0-02/P0-05, F3, Quoten und sämtliche bestehenden Scanner-/Battle-CI-Schritte bleiben erhalten.

```sh
node tests/generate-security-readiness.mjs --data-export --trade-lock --processing-markers --closure-privacy --scanner-hold --battle-player-hold --battle-signal-hold --check
node tests/battle-signal-processing-hold-test.mjs --native
node tests/battle-player-processing-hold-test.mjs --native --battle-signal-hold
node tests/account-processing-markers-test.mjs --native --closure-privacy --scanner-hold --battle-player-hold --battle-signal-hold
node tests/account-closure-privacy-test.mjs --native --scanner-hold --battle-player-hold --battle-signal-hold
node tests/scanner-processing-hold-test.mjs --native --battle-player-hold --battle-signal-hold
node tests/production-upgrade-rehearsal.mjs --native --trade-lock --data-export --processing-markers --closure-privacy --scanner-hold --battle-player-hold --battle-signal-hold
node tests/account-data-export-collect-battle-test.mjs --native --trade-lock --processing-markers --closure-privacy --scanner-hold --battle-player-hold --battle-signal-hold
```

Native Harness: ausschließlich localhost/127.0.0.1, PostgreSQL-Hauptversion 17, Wegwerfdatenbanken. Lokales PGlite ist ergänzende Vorprüfung. Ein lokaler Inventar-Test wurde präzisiert, weil auch die Readinessfunktion den Tabellennamen als Vertragsinhalt enthält; keine funktionale Guard-Abschwächung. Kein veröffentlichter CI-FAIL.

Originales natives GitHub-Artefakt: `10929614012`, SHA256 `15fc2efaaa20f3542e8cfcc4432f51c12c2171cce902b78c712719c8e41d25ad`, vor Extraktion verifiziert. `DUELVANTA_T3_G5_EVIDENZ_2026-09-27.zip` enthält das unveränderte Original-ZIP, native Reports/Logs, lokale Ergänzungen, alle elf technischen Quelldateien, Dokumente, Quellenhashes und finale Repository-/CI-Verifikation.

## Grenzen und exakt ein nächster Block

G5 ist ausschließlich veröffentlichter Branch-Kandidat; nicht live wirksam. PR #5 offen/Draft/unmerged, main unverändert. Production/Staging nicht kontaktiert oder verändert. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock; nur automatisches Preview zulässig. Keine rückwirkende Signallöschung, kein Match-/Medienabbruch, keine allgemeine Lesesperre, keine neue Freigabe-/Ausnahmefunktion. Storage, laufende Medien, Retention/Erasure, T1/T4–T6, Rechtstexte, Provider, Mail, Stripe und Release nicht bearbeitet. PITR OFF / Production NO-GO unverändert.

**Exakt ein nächster fachlicher Block: T3/D1 – die unter Processing-Hold bestehenden Consent-/Link-Rücknahmepfade fachlich abgrenzen und einen konkreten Entscheidungsnachweis erstellen.** V68 dokumentiert die bestehende Blockade von Consent=false und Link=false; ob und wie diese Rücknahmen erreichbar bleiben sollen, ist noch nicht entschieden. Nächster Block zunächst Soll-/Ist- und Entscheidungsarbeit, keine eigenmächtige Guard-Ausnahme, keine laufenden Medien abbrechen. Umsetzung erst auf Grundlage einer ausdrücklich bestätigten konkreten Regel. D2–D4 bleiben getrennt offen.

D1 wurde nicht begonnen. Abschlussbericht, V73 und Evidenzpaket zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. **G5 abgeschlossen. STOP.**
