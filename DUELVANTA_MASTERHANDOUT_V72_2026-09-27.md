# DUELVANTA – MASTERHANDOUT V72

27.09.2026 · **T3/G4 isoliert und nativ PASS, Branch-Kandidat veröffentlicht** · Nicht live · Production NO-GO

## 1. Verbindliche Grundlage

V72 und `DUELVANTA_T3_G4_BATTLE_SPIELERZULASSUNG_ABSCHLUSS_2026-09-27.md` zuerst vollständig lesen. V71/G3 bleibt für Scannerzulassung/Accounting, V70/G2 für Closure-Privatstellung, V69/G1 für Markerintegrität und V67/T2 für Export/Audit verbindlich. V68 samt T3-Nachweis bleibt für G5, D1–D4 und bestehende Abschluss-/Nachweisgrenzen maßgeblich. V66/IT-Recht-Scope, V64/Provider und V62/Readiness gelten in nicht widersprochenen Punkten weiter. Neuere belegte Einzelbefunde haben Vorrang.

IT-Recht-Texte sind konfigurierte Standardtexte, keine bestätigte individuelle DUELVANTA-Prüfung oder Release-Freigabe; kein bestätigtes individuelles RA-Nagel-Mandat. V65 bleibt intern/NICHT VERSENDEN. Konkrete ungeklärte Rechtsfragen offenhalten; technische Arbeit nicht pauschal an externe Datenschutz-Schlussprüfung binden.

## 2. Repository und CI

| Gegenstand | Verifizierter Stand |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `66a8c2ca5fc1ac6e84fb688ab841373a22c69516` |
| Technischer G4-Head | `e85d136587cab3f08fbba06fc9a368e8a793852e` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner technische Abnahme | #743 / Run 36305197604 SUCCESS |
| Battle technische Abnahme | #219 / Run 36305197589 SUCCESS |
| Native G4 | PostgreSQL 17.11, 22/22 Ergebnisgruppen PASS |
| G1 vollständig mit G2/G3/G4 | 20/20 PASS |
| G2 vollständig mit G3/G4 | 19/19 PASS |
| G3 vollständig mit G4 | 24/24 PASS |
| T2 vollständig mit G1/G2/G3/G4 | 18/18 PASS, 96 Tabellen/15 Sequenzen |
| Rekonstruierte Upgrade-Kette mit G4 | nativ PASS |

Bericht und V72 folgen als reine Dokumentationsrevision. Endgültiger Remote-Head und vollständige Abschluss-CI stehen in `verification.json` im G4-Evidenzpaket. Vor jedem Folgeauftrag Remote/main/PR/CI frisch prüfen; den angekündigten Dokumentationsfolger nicht als unerwartete fachliche Drift behandeln.

Der Nutzer autorisierte ausschließlich G4 samt Branch-Push nach isoliertem PASS und automatischem Preview. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Kein veröffentlichter CI-FAIL.

## 3. G4 abgeschlossen

Vor G4 erlaubten die Spieler-RPCs bei reinem Processing-Hold weiterhin Create/Join/Ready/Start. A/B reproduzierten alle 13 Varianten isoliert. Das vollständige Closure-Paket blockierte dagegen bereits über Safety; dieser Unterschied bleibt ausdrücklich belegt.

`database/battle-player-processing-hold-v1.sql` ersetzt genau vier vorhandene Funktionskörper:

- `create_battle_match_v2`; der unveränderte Legacy-Wrapper `create_battle_match` delegiert dorthin.
- `join_battle_match`, einschließlich ID, Code, privatem ID-Aufruf und Host-Replay.
- `set_battle_ready`, Host/Gast und true/false.
- `start_battle_match`, nur im bestehenden Host-/Bereitschafts-/Statusrahmen.

Die bestehenden Kontostatus- und Safety-Prüfungen bleiben erhalten. Zusätzlich wird das eigene Profil mit FOR SHARE gesperrt und der nicht-NULL-Processing-Marker geprüft. Bei Hold folgt `42501 / account_data_processing_restricted` vor Matchänderung. Die Zulassung ist damit gegen gleichzeitig schreibende Profil-Holds geordnet. Keine JWT-/GUC-/Service-/Owner-Ausnahme.

Die Prüfung bleibt an **den handelnden auth.uid()-Nutzer** gebunden; kein neuer Match-weiter Guard auf andere Teilnehmer. Keine neue Funktion, Tabelle, Rolle, ACL, RLS-Policy oder Trigger. SECURITY-DEFINER-Inhaber, search_path, Signaturen und Rechte unverändert. Alle anderen Funktionskörper einschließlich G1/G2/G3/T2, Abschluss-, Rating-, Report- und Signalfunktionen bleiben unverändert.

Passender offline erzeugter Vertrag: `database/battle-player-processing-hold-readiness-v1.sql`, nach P0-02/P0-05/T2/G1/G2/G3/G4. Alter G3-Vertrag wird inkompatibel; passender G4-Vertrag besteht. Ein entfernter Start-Guard schließt die Readiness. Generatorflag `--battle-player-hold` verlangt G3. Historische Migrationen und bestehende Verträge unverändert; keine Live-Anwendung.

Native Abnahme mit A=beta, B=active und Kontrollnutzer C: Normal, Processing-only, Closure und Safety-only; alle 13 Varianten, Fremdschutz, DML, service_role und tatsächliche DEFINER-/Owner-Kontexte. Zehn echte Konkurrenzfälle (beide Create-Einstiege, Join, Ready, Start je A/B) warten nachweislich hinter Hold-Schreiben und werden nach dessen Commit ohne Matchänderung abgewiesen.

Ergebnisabgleich einschließlich Konfliktkorrektur, Ranked-Ratings und ein Beleg je Match, eigene History/Ratings/Report sowie bestehendes Host-/Gast-Verlassen vor Start bleiben unter Processing-only und Closure über SQL möglich. Keine Matchlöschung. G1/G2/G3/T2 jeweils vollständig mit G4 bestanden; Scanner/Battle-CI vollständig SUCCESS.

## 4. Browser und unveränderte Grenzen

Die Browserdateien bleiben unverändert. Die geprüften Spieler-RPCs sind die serverseitige Grenze. `battle-safety.js` behält seine bestehende Safety-/Consent-Ausblendung unter Closure/Safety; G4 fügt keinen Processing-only-Komplettblock hinzu, der Ergebnis-/Nachweiswege verdecken würde. SQL-Abschlussnachweise unter Closure sind keine Behauptung neuer Browserverfügbarkeit. Ready=false bleibt Teil des Ready-RPCs und wird ebenfalls unter Hold abgewiesen; keine neue Stop-/Rücknahme-Ausnahme.

G4 widerruft keine vor Hold bereits abgeschlossene Zulassung rückwirkend. Keine neue Semantik für laufende Matches, Medien oder In-flight-Vorgänge. Kein Match-weiter Abbruch. G5/Signalisierung und D1–D4 bleiben offen. G1-Markerintegrität, G2-Privatstellung und G3-Scannerzulassung/Settlement unverändert; keine allgemeine Lesesperre oder neues Sichtbarkeitsmodell.

Bestehende Abschluss-/Nachweispfade erhalten: Export/Audit, Scannerabrechnung, Matchabschluss/-belege, Reports/History/Ratings, Zuschauer-Leave und Service-Revocation. Storage, bestehende Medien, öffentliche Lesefortsetzung und Staff-Reichweite bleiben in den V68-Grenzen. Processing-Hold von Retention-/Erasure-Holds unterscheiden.

**Keine Live-Katalog-Attestierung:** Production/Staging nicht kontaktiert oder verändert; G4 dort noch nicht wirksam. Keine Provider-/Medienverbindung. P0-01 bis P0-05 behalten ihre dokumentierten Abnahmegrenzen; P0-05 Kandidat, Production NO-GO, PITR OFF. Kein neues Recovery-Rehearsal ohne Befund. Maximal vier Prozent Verkäufer-Gesamtgebühr einschließlich übernommener Stripe-Kosten bleibt separate P2-Vorgabe.

## 5. Exakt EIN nächster fachlicher Arbeitsblock

**T3/G5: Neue BATTLE-Signalisierung über den bestehenden Schreibpfad an den vorhandenen Processing-Hold binden; bestehende Cleanup-/Nachweispfade erhalten.**

Begründung: V68 reproduziert neue Teilnehmersignale sogar unter vollständigem Closure-Paket. G4 schützt Spieler-RPC-Zulassung, verändert diesen getrennten direkten Signal-Schreibpfad aber nicht.

Erst nach gesondertem ausdrücklichem Auftrag:

1. Remote/main/PR/CI frisch prüfen; tatsächliche Browser-/Realtime-/DML-/RPC-Signalpfade, ACL/RLS/Definer, Teilnehmerbindung und bestehende Cleanup-Wege am aktuellen Stand erfassen.
2. Ausschließlich neue Signalisierung an den bereits vorhandenen Marker binden. Keine neue allgemeine Lesesperre, kein neues Sichtbarkeitsmodell, kein pauschaler Medien-/Matchabbruch, keine neue Freigabe-/Ausnahmefunktion. Behandlung bereits laufender Medien und Lesefortsetzung separat offenhalten.
3. Mindestens zwei synthetische Nutzer mit Normal-, Processing-only- und Closure-Zuständen; Fremdschutz, direkte DML/RPC und relevante privilegierte Kontexte. Bei DB-/RLS-/Triggeränderungen native PostgreSQL-17-Abnahme. G1/G2/G3/G4/T2 sowie Scanner-/Battle-Regressionen vollständig erhalten. Keine realen Provider-/Medienverbindungen.

Nicht Bestandteil: Storage, laufende Medien, Retention/Erasure, T1/T4–T6, Rechtstexte/Providerverträge, Mail/Stripe oder Release. Konkrete ungeklärte Stop-/In-flight-Fragen offenlassen. Veröffentlichung nur gemäß ausdrücklichem Folgeauftrag.

**G5 wurde nicht begonnen.**

## 6. Ablage und STOP

V72, G4-Abschlussbericht und `DUELVANTA_T3_G4_EVIDENZ_2026-09-27.zip` zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. Das Paket enthält originale native CI-Evidenz, lokale Ergänzungen, Quellstände/Hashes und finale Repository-/CI-Verifikation.

main/Production/Staging unverändert; PR offen/Draft/unmerged. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Keine echte Kontoschließung, Retention/Erasure, Stripe-Aktivierung, Zahlung, E-Mail, externe Nachricht oder Provider-/Vertrags-/DNS-/Key-Änderung. **G4 abgeschlossen. Nächsten Block nicht beginnen. STOP.**
