# DUELVANTA – MASTERHANDOUT V71

Dokumentreihe 26.09.2026 · Ausführung/Verifikation 27.09.2026 · **T3/G3 isoliert und nativ PASS, Branch-Kandidat veröffentlicht** · Nicht live · Production NO-GO

## 1. Verbindliche Grundlage

V71 und `DUELVANTA_T3_G3_SCANNER_PROCESSING_HOLD_ABSCHLUSS_2026-09-26.md` zuerst vollständig lesen. V70/G2 bleibt für Closure-Privatstellung, V69/G1 für Markerintegrität, V67/T2 für Export/Audit verbindlich. V68 samt T3-Nachweis bleibt für G4/G5, D1–D4 und bestehende Abschluss-/Nachweispfade maßgeblich. V66/IT-Recht-Scope, V64/Provider und V62/Readiness gelten in nicht widersprochenen Punkten weiter. Neuere belegte Einzelbefunde haben Vorrang.

IT-Recht-Texte sind konfigurierte Standardtexte, keine bestätigte individuelle DUELVANTA-Prüfung oder Release-Freigabe; kein bestätigtes individuelles RA-Nagel-Mandat. V65 bleibt intern/NICHT VERSENDEN. Konkrete ungeklärte Rechtsfragen gezielt offenlassen; technische Arbeit nicht pauschal an eine externe Datenschutz-Schlussprüfung binden.

## 2. Repository und CI

| Gegenstand | Verifizierter Stand |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `824e27f35572aa1710e2887546fd447b0ebd0ab3` |
| Technischer G3-Head | `c60cdcd7f8da2c3dc46e4a4abd5d750323e8e95d` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner technische Abnahme | #741 / Run 36300013083 SUCCESS |
| Battle technische Abnahme | #217 / Run 36300013066 SUCCESS |
| Native G3 | PostgreSQL 17.11, 23/23 Ergebnisgruppen PASS |
| G1 vollständig mit G2/G3 | 19/19 PASS |
| G2 vollständig mit G3 | 18/18 PASS |
| T2 vollständig mit G1/G2/G3 | 17/17 PASS, 96 Tabellen/15 Sequenzen |
| Rekonstruierte Upgrade-Kette mit G3 | nativ PASS |

Bericht und V71 folgen als reine Dokumentationsrevision. Deren endgültiger Remote-Head und vollständige Abschluss-CI stehen in `verification.json` im G3-Evidenzpaket. Vor jedem Folgeauftrag Remote, main, PR #5 und CI frisch prüfen; den angekündigten Dokumentationsfolger nicht als unerwartete fachliche Drift behandeln.

Der Nutzer autorisierte ausschließlich G3 samt Branch-Push nach isoliertem PASS und automatischem Preview. Production-Deploy, Live-Migration, Live-Lock und Merge sind nicht erfolgt. Kein veröffentlichter CI-FAIL.

## 3. G3 abgeschlossen

Neue kontobezogene OpenAI-Reservierungen berücksichtigten zuvor den Processing-Marker nicht. A/B reproduzierten diesen Zustand isoliert und rollten ihn zurück.

`database/scanner-processing-hold-v1.sql` ersetzt genau die vorhandenen privaten Funktionen `reserve_openai_for_caller` und `openai_scan_budget_for_caller`. Keine neue Funktion, Tabelle, Policy, Rolle oder Freigabe. Die unveränderten öffentlichen RPC-Fassaden, Funktions-ACLs, RLS, SECURITY-DEFINER-Inhaber und search_path bleiben erhalten.

Die Reservierung prüft nach bestehender Auth-/Accounting-Key-Grenze das eigene aktive/beta Profil mit FOR SHARE. Ein nicht-NULL-Marker liefert `allowed:false, reason:account_data_processing_restricted` vor Ledger-/Usage-Schreiben. Profil-/Closure-Updates und Neureservierung werden an der Profilzeile geordnet. Bestehende Policy-, Monats-/Wochenquoten-, Dubletten-, Budget- und FX-Grenzen bleiben erhalten.

Der vorhandene eigene Budget-RPC liefert zusätzlich `processingRestricted`; unter Hold enabled=false und keine nutzbare Restquote. Kostenstände bleiben sichtbar und korrekt. `benchmark/scanner-pilot/recognize-server.cjs` behandelt den Hold als 403 und prüft über diesen bestehenden RPC unmittelbar vor Providerstart erneut. Fehlender boolescher Vertragswert oder nicht erreichbarer RPC führt zu 503 ohne Providerstart.

**Bestehendes Settlement ist bytegleich.** Bereits vor Hold zugesagte Reservierungen werden weiterhin mit eigener Nutzerbindung, Serverkey, Idempotenz und korrekten Kostendeltas abgerechnet. Kein neuer Refund, keine automatische Stornierung, kein Retry oder Ausnahmeverfahren. Hold während bereits gestarteter erfolgreicher/unvollständiger Provider-Stub-Verarbeitung verhindert die notwendige vorhandene Abrechnung nicht.

Der offline erzeugte passende Vertrag ist `database/scanner-processing-hold-readiness-v1.sql`, nach P0-02/P0-05/T2/G1/G2/G3. Der ältere Vertrag erkennt die geänderten Funktionen als inkompatibel. Der Generator hat `--scanner-hold` mit notwendiger G2-Basis. Historische Migrationen und bisherige Readinessverträge bleiben unverändert. Eine spätere separat autorisierte Live-Einführung muss SQL und Vertrag gemeinsam berücksichtigen.

Native Tests verbinden den echten Handler mit echten SQL-Funktionen und ausschließlich Provider-Stubs. A/B: normale Raw-/Slab-Scans erlaubt, Processing-only und echtes Closure-Paket blockiert, Kontrollnutzer funktionsfähig. Hold nach Reservierung vor Providerstart blockiert; bestehendes Settlement bleibt erreichbar. Fehlende Auth/Keys, Fremdsettlement, direkte DML, service_role und gefälschte JWT/GUC bleiben begrenzt. Native Konkurrenz: tatsächliche Closure-Transaktion blockiert Reservierung; nach Commit folgt Ablehnung. G1/G2/T2 vollständig mit G3 bestanden.

**Keine Live-Schema-Attestierung:** Production und Staging wurden weder kontaktiert noch verändert; G3 ist dort noch nicht wirksam. Der kontobezogene Handler bleibt auf marketplace-ux-v1 Preview geschlossen (404). Erlaubte scanner-v16-Preview-/main-Production-Kontexte wurden nur simuliert. Kein echter OpenAI-Aufruf, keine Kosten, keine Provider-/Deploymentaktivierung.

## 4. Unveränderte Grenzen

Die Vorstartprüfung ist keine atomare DB-/Provider-Transaktion. Hold nach der letzten erfolgreichen DB-Prüfung bzw. nach Providerstart erhält keine neue Abbruchsemantik; In-flight-Fragen bleiben konkret offen. Bereits zugesagte Reservierung, bereits gestarteter Provideraufruf und notwendiges Settlement nicht gleichsetzen.

G4-BATTLE-Spieler, G5-Signalisierung und D1–D4 bleiben offen. G1/G2 bleiben unverändert: Marker können nicht vom Nutzer selbst geändert werden; bereits private Closure-Collection kann nicht erneut public/custom werden. Keine neue allgemeine Lesesperre, kein neues Sichtbarkeitsmodell. Historischer Scannerpfad bleibt separat abgeschaltet; signierte Pilot-Endpunkte bleiben getrennt und deaktiviert. Keine Reaktivierung als Nebenwirkung.

Bestehende Abschluss-/Nachweispfade nicht pauschal abschalten: Export/Audit, Reservierungsabrechnung, Matchabschluss/-belege, Zuschauer-Leave und Service-Revocation. Storage, laufende Medien, öffentliche Lesefortsetzung und Staff-Reichweite bleiben in den konkret benannten V68-Grenzen. Processing-Hold und kategorisierte Retention-/Erasure-Holds unterscheiden.

P0-01 bis P0-05 behalten ihre bisherigen Abnahme-/Evidenzgrenzen; P0-05 Kandidat, Production NO-GO, PITR OFF. Kein neues Recovery-Rehearsal ohne Befund. Maximal vier Prozent Verkäufer-Gesamtgebühr einschließlich übernommener Stripe-Kosten bleibt separate P2-Vorgabe.

## 5. Exakt EIN nächster fachlicher Arbeitsblock

**T3/G4: Bestehende BATTLE-Spieler-Zulassung für Create/Join/Ready/Start an den eigenständigen Processing-Hold binden; bestehende Abschluss-/Nachweispfade erhalten.**

Begründung: V68 reproduziert diese Spieleraktionen bei allein gesetztem Processing-Hold. Im vollständigen Closure-Paket blockiert bereits Safety; diese bestehende Grenze erhalten und nicht als eigenständigen Processing-Hold-Schutz ausgeben.

Erst nach gesondertem ausdrücklichem Auftrag:

1. Remote/main/PR/CI frisch prüfen; bestehende Spieler-RPCs einschließlich Create-Varianten, beteiligte Nutzerrollen, Safety-/Browseranzeige, ACL/RLS/Definer und tatsächliche Abschlusswege am aktuellen Stand abgleichen.
2. Ausschließlich die belegte neue Spielerzulassung an den bestehenden Marker binden. Keine neue allgemeine BATTLE-Sperre, kein Matchlöschen, keine neue Regel für bereits laufende Medien oder pauschale Ausnahme erfinden.
3. Mindestens zwei synthetische Nutzer mit normalen, Processing-only- und Closure-Fällen, Fremdschutz und relevanten privilegierten Kontexten isoliert testen. Bei DB-/RPC-Änderungen native PostgreSQL-17-Abnahme. G1/G2/G3/T2 sowie Scanner-/Battle-Regressionen vollständig erhalten.

Nicht Bestandteil: G5/Signalisierung, Storage, laufende Medien, Retention/Erasure, T1/T4–T6, Rechtstexte/Providerverträge, Mail/Stripe oder Release. Keine echte Provider-/Medienverbindung. Neue In-flight-/Stop-Entscheidungen konkret offenlassen. Folgepublikation nur gemäß ausdrücklichem Folgeauftrag.

**G4 wurde nicht begonnen.**

## 6. Ablage und STOP

V71, G3-Abschlussbericht und `DUELVANTA_T3_G3_EVIDENZ_2026-09-26.zip` zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. Das Paket enthält native GitHub-Artefakte, ergänzende lokale Nachweise, Kandidat-/Testdateien, Hashes und finale Repository-/CI-Verifikation.

main/Production/Staging unverändert; PR offen/Draft/unmerged. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Keine echte Kontoschließung, Retention/Erasure, Stripe-Aktivierung, Zahlung, E-Mail, externe Nachricht oder Provider-/Vertrags-/DNS-/Key-Änderung. **G3 abgeschlossen. Nächsten Block nicht beginnen. STOP.**
