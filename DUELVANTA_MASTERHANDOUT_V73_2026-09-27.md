# DUELVANTA – MASTERHANDOUT V73

27.09.2026 · **T3/G5 isoliert und nativ PASS, Branch-Kandidat veröffentlicht** · Nicht live · Production NO-GO

## 1. Verbindliche Grundlage

V73 und `DUELVANTA_T3_G5_SIGNALISIERUNG_ABSCHLUSS_2026-09-27.md` zuerst vollständig lesen. V72/G4 für Spielerzulassung, V71/G3 für Scannerzulassung/Accounting, V70/G2 für Closure-Privatstellung, V69/G1 für Markerintegrität und V67/T2 für Export/Audit bleiben verbindlich. V68 samt T3-Nachweis bleibt für D1–D4 und bestehende Abschluss-/Nachweisgrenzen maßgeblich. V66/IT-Recht-Scope, V64/Provider und V62/Readiness gelten in nicht widersprochenen Punkten weiter. Neuere belegte Einzelbefunde haben Vorrang.

IT-Recht-Texte sind konfigurierte Standardtexte, keine bestätigte individuelle DUELVANTA-Prüfung oder Release-Freigabe; kein bestätigtes individuelles RA-Nagel-Mandat. V65 bleibt intern/NICHT VERSENDEN. Konkrete ungeklärte Rechtsfragen offenhalten; technische Arbeit nicht pauschal an externe Datenschutz-Schlussprüfung binden.

## 2. Repository und CI

| Gegenstand | Verifizierter Stand |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `63f89099c481653b2d4f5781ac1f3ac3835d5249` |
| Technischer G5-Head | `0493d7d0e1765b1d9e727a7136a997a53c4c888c` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner technische Abnahme | #745 / Run 36313759098 SUCCESS |
| Battle technische Abnahme | #221 / Run 36313759325 SUCCESS |
| Native G5 | PostgreSQL 17.11, 20/20 Ergebnisgruppen PASS |
| G4 vollständig mit G5 | 22/22 PASS |
| G1 vollständig mit G2/G3/G4/G5 | 20/20 PASS |
| G2 vollständig mit G3/G4/G5 | 19/19 PASS |
| G3 vollständig mit G4/G5 | 24/24 PASS |
| T2 vollständig mit G1/G2/G3/G4/G5 | 18/18 PASS, 96 Tabellen/15 Sequenzen |
| Rekonstruierte Upgrade-Kette mit G5 | nativ PASS |

Bericht und V73 folgen als reine Dokumentationsrevision. Endgültiger Remote-Head und vollständige Abschluss-CI stehen in `verification.json` im G5-Evidenzpaket. Vor jedem Folgeauftrag Remote/main/PR/CI frisch prüfen; den angekündigten Dokumentationsfolger nicht als unerwartete fachliche Drift behandeln.

Der Nutzer autorisierte ausschließlich G5 samt Branch-Push nach isoliertem PASS und automatischem Preview. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Kein veröffentlichter CI-FAIL. Alle sieben technischen Scanner-/Battle-Jobs erfolgreich.

## 3. G5 abgeschlossen

Vor G5 erlaubte der direkte Signal-INSERT weiterhin alle vier Typen selbst bei reinem Processing-Hold oder vollständigem Closure-Paket. A/B reproduzierten dies vor der Änderung. Der echte Browser nutzt dafür `battle-webrtc.js` → `sendSignal` → `battle_signals.insert`; kein öffentlicher Signal-Insert-RPC und keine alternative Broadcast-Schreibstrecke im geprüften Spielerpfad.

`database/battle-signal-processing-hold-v1.sql` ergänzt eine SECURITY-DEFINER-Triggerfunktion mit festem search_path `pg_catalog, public` und einen BEFORE INSERT FOR EACH ROW-Trigger auf battle_signals. Er liest den vorhandenen Profilmarker des tatsächlichen NEW.sender_id mit FOR SHARE. Nicht-NULL erzeugt `42501 / account_data_processing_restricted` vor Speicherung. Keine JWT-/GUC-/Service-/Owner-Ausnahme. Auch privilegierter INSERT ohne JWT-Subjekt wird am tatsächlichen gesperrten Sender geprüft.

Für normale Nutzer bindet die unveränderte INSERT-RLS sender_id=auth.uid() an Host/Gast und die bestehenden Status waiting/ready/live/dispute. Fremdgrenzen unverändert. P0-02-ACL bleibt erhalten: authenticated SELECT/INSERT, kein direktes UPDATE/DELETE; anon/service_role ohne direkte Tabellenrechte. Der neue Guard hat keine direkten EXECUTE-Rechte für PUBLIC/anon/authenticated/service_role und ist kein neuer öffentlicher RPC.

**Nur neue Inserts:** offer, answer, ice und hangup. Keine Ausnahme für hangup erfunden. Keine allgemeine SELECT-Sperre, keine rückwirkende Signallöschung, keine Matchänderung und kein automatisch ausgelöster Medienabbruch. Laufende Medien/Verbindungen und In-flight-Verarbeitung erhalten keine neue Semantik. Ein ungesperrter Gegenpart kann im selben Match weiter schreiben; kein Match-weiter Guard.

`clear_my_battle_signals(uuid)` bleibt exakt unverändert: vorhandene Teilnehmer dürfen eigene Signale sowie bereits über einen Tag alte Signale desselben Matches entfernen. Frische Gegenparteisignale bleiben bestehen. SECURITY-DEFINER-/Service-/Owner-Aufrufe erhalten die bisherige Teilnehmerbindung. Clear ist ein bestehender Lösch-/Cleanup-Pfad, kein neuer Signal-INSERT. Es wurde weder ein neuer Clear-Pfad noch eine Freigabe-/Ausnahmefunktion geschaffen.

Der neue offline erzeugte Vertrag `database/battle-signal-processing-hold-readiness-v1.sql` prüft 426 Security- und 270 Legal-Einträge einschließlich Definition/Aktivierung des Signaltriggers. Fehlender oder deaktivierter Trigger schließt Readiness. Die bisherigen Verträge bleiben unverändert; `--battle-signal-hold` verlangt G4. Historische Migrationen unverändert; Kandidat nicht live angewendet.

Native Abnahme: A=beta, B=active, C=Fremd-/Kontrollnutzer; Normal, Processing-only und echtes Closure-Paket. Vier Typen, Fremdschutz, Statusgrenzen, direkte DML, JWT/GUC, privilegierte Insert- und Definer-Clear-Kontexte. Acht echte Konkurrenzfälle (A/B × vier Signaltypen) warten über pg_blocking_pids nachgewiesen hinter offenem Hold-Schreiben; nach dessen Commit verweigert der INSERT ohne gespeicherte Signalzeile.

G1/G2/G3/G4/T2 wurden jeweils vollständig mit G5 ausgeführt. Marker-/Collection-, Privatstellungs-, Scanner- und Spielerzulassungskonkurrenz bleiben enthalten. Scannerabrechnung/Accounting-Key/Quoten, Matchabschluss/History/Rating/Report sowie Export/Audit bleiben funktionsfähig. P0-02/P0-05 und bestehende Scanner-/Battle-CI erfolgreich.

## 4. Browser, Realtime und Aussagegrenzen

Alle Browserdateien bleiben unverändert. Die tatsächlichen sendSignal-/subscribeSignals-Funktionen wurden in isoliertem VM-Kontext mit SQL-Brücke ausgeführt: Normal-/Hold-Schreiben, bestehender Clear-RPC, initialer SELECT und Realtime-INSERT-Callback. Realtime transportiert bestehende Ereignisse über postgres_changes mit Matchfilter; neue Speicherung ist die serverseitige G5-Grenze. Keine echte Realtime-/WebRTC-/STUN-/TURN-/Providerverbindung und kein neuer Geräte-/Medien-E2E-Nachweis.

Die bestehende Safety-/Consent-Ausblendung unter Closure/Safety bleibt erhalten. Kein Processing-only-Komplettblock der Oberfläche. Der bisherige lokale Medien-Stop bleibt unverändert; G5 behauptet keine neue Wirkung eines unter Hold abgewiesenen hangup auf den Gegenpart und erzwingt keinen Abbruch laufender Verbindungen. Bereits gespeicherte Signale bleiben bis zu den vorhandenen Cleanup-Wegen erhalten.

G1–G5 schließen die fünf konkreten technischen Lücken im geprüften Branch-Kandidaten. **Keine vollständige T3-Reichweiten-/Live-Abnahme:** D1–D4, Storage-Nachweis, laufende Medien und sonstige konkret ungeklärte In-flight-/Lesefortsetzungen bleiben offen. Processing-Hold von Retention-/Erasure-Holds unterscheiden. Keine pauschale Rechts- oder Launch-Freigabe.

Production/Staging nicht kontaktiert oder verändert; G5 dort noch nicht wirksam. P0-01 bis P0-05 behalten ihre dokumentierten Abnahmegrenzen; P0-05 Kandidat, Production NO-GO, PITR OFF. Kein neues Recovery-Rehearsal ohne Befund. Maximal vier Prozent Verkäufer-Gesamtgebühr einschließlich übernommener Stripe-Kosten bleibt separate P2-Vorgabe.

## 5. Exakt EIN nächster fachlicher Arbeitsblock

**T3/D1: Die unter Processing-Hold bestehenden Consent-/Link-Rücknahmepfade fachlich abgrenzen und einen konkreten Entscheidungsnachweis erstellen.**

V68 reproduziert, dass derselbe Eligibility-Guard auch Consent=false und Link=false blockiert. Ob und wie diese Rücknahmen unter Hold erreichbar bleiben sollen, ist noch nicht entschieden. G5 schließt neue Signalisierung, entscheidet diese getrennte Zuschauer-/Consent-Frage aber nicht.

Erst nach gesondertem ausdrücklichem Auftrag:

1. Remote/main/PR/CI frisch prüfen; tatsächliche Consent-/Link-Rücknahme-RPCs, Browserpfade, Eligibility, Teilnehmer-/Servicegrenzen und bestehende Cleanup-/Nachweispfade erfassen.
2. Bestehendes Verhalten unter Normal-, Processing-only- und Closure-Zustand isoliert nachweisen und die konkrete fachliche Entscheidungsfrage samt Auswirkungen darstellen. Keine Regel stillschweigend voraussetzen.
3. Einen eng begrenzten Entscheidungsvorschlag vorlegen; keine Guard-Ausnahme oder neue Rücknahme-/Freigabefunktion implementieren, bevor die konkrete Regel ausdrücklich bestätigt ist. Keine neue Semantik zum Abbruch laufender Medien und keine allgemeine Lesesperre.

Dies ist zunächst ein fachlicher Entscheidungs-/Nachweisblock, kein Release und keine gemeinsame Umsetzung D1–D4. D2 (bestehende Media-Epoch), D3 (Staff-/Judge-Reichweite), D4 (Lesen/öffentliche Profile) bleiben getrennt offen. Storage, Retention/Erasure, T1/T4–T6, Rechtstexte/Providerverträge, Mail/Stripe nicht Bestandteil.

**D1 wurde nicht begonnen.**

## 6. Ablage und STOP

V73, G5-Abschlussbericht und `DUELVANTA_T3_G5_EVIDENZ_2026-09-27.zip` zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. Das Paket enthält originale native CI-Evidenz, lokale Ergänzungen, Quellstände/Hashes und finale Repository-/CI-Verifikation.

main/Production/Staging unverändert; PR offen/Draft/unmerged. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Keine echte Kontoschließung, Retention/Erasure, Stripe-Aktivierung, Zahlung, E-Mail, externe Nachricht oder Provider-/Vertrags-/DNS-/Key-Änderung. **G5 abgeschlossen. Nächsten Block nicht beginnen. STOP.**
