# DUELVANTA – MASTERHANDOUT V70

26.09.2026 · **T3/G2 isoliert und nativ PASS, Branch-Kandidat veröffentlicht** · Nicht live · Production NO-GO

## 1. Verbindliche Grundlage

V70 und `DUELVANTA_T3_G2_PRIVATSTELLUNG_ABSCHLUSS_2026-09-26.md` zuerst vollständig lesen. V69/G1 bleibt für Markerintegrität, V67/T2 für Export/Audit verbindlich. V68 samt T3-Nachweis bleibt für G3–G5, D1–D4 und bestehende Abschluss-/Nachweispfade maßgeblich. V66/IT-Recht-Scope, V64/Provider und V62/Readiness gelten in nicht widersprochenen Punkten weiter. Neuere belegte Einzelbefunde haben Vorrang.

IT-Recht-Texte sind konfigurierte Standardtexte, keine bestätigte individuelle DUELVANTA-Prüfung oder Release-Freigabe; kein bestätigtes individuelles RA-Nagel-Mandat. V65 bleibt intern/NICHT VERSENDEN. Konkrete ungeklärte Rechtsfragen gezielt offenlassen; technische Arbeit nicht pauschal an eine externe Datenschutz-Schlussprüfung binden.

## 2. Repository und CI

| Gegenstand | Verifizierter Stand |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `b395d740da3ec1ebc4402fedc5f6368842d2ddcc` |
| Technischer G2-Head | `ac727f8cc30644b4efbf5487176151115fb0280b` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner technische Abnahme | #739 / Run 36243704586 SUCCESS |
| Battle technische Abnahme | #215 / Run 36243704536 SUCCESS |
| Native G2 | PostgreSQL 17.11, 17/17 Ergebnisgruppen PASS |
| G1 vollständig mit G2 | 18/18 PASS |
| T2 vollständig mit G1/G2 | 16/16 PASS, 96 Tabellen/15 Sequenzen |
| Rekonstruierte Upgrade-Kette mit G2 | nativ PASS |

Bericht und V70 folgen als reine Dokumentationsrevision ohne funktionale Änderungen. Deren endgültiger Remote-Head und vollständige Abschluss-CI stehen in `verification.json` im G2-Evidenzpaket. Vor jedem Folgeauftrag Remote, main, PR #5 und CI frisch prüfen; diesen Dokumentationsfolger nicht als unerwartete fachliche Drift behandeln.

Der Nutzer autorisierte ausschließlich G2 samt Branch-Push nach isoliertem PASS und automatischem Preview. Production-Deploy, Live-Migration, Live-Lock und Merge sind nicht erfolgt.

## 3. G2 abgeschlossen

Der vorherige `set_my_public_profile`-RPC konnte die durch echten Closure-Aufruf gesetzte Privatstellung wieder nach `public` ändern. Auch `custom` veröffentlicht Karten bereits öffentlicher Ordner. Beides wurde mit zwei synthetischen Nutzern vor Installation reproduziert und zurückgerollt.

`database/account-closure-privacy-v1.sql` ergänzt nur einen privaten SECURITY-INVOKER-Profiltrigger. Wenn **OLD Closure gesetzt + OLD Collection private** ist, darf NEW Visibility nicht von private abweichen. Dadurch greifen direkte DML und bestehende SECURITY-DEFINER-RPCs auf dieselbe Übergangsgrenze. Keine JWT-/GUC-/Service-/Owner-Ausnahme, keine neue Freischaltfunktion. Bestehende interne Pfade, die private setzen oder erhalten, bleiben funktionsfähig.

Der passende offline erzeugte Vertrag ist `database/account-closure-privacy-readiness-v1.sql`, nach P0-02/P0-05/T2/G1/G2. Fehlender/deaktivierter G2-Trigger lässt die Readiness geschlossen bleiben. Historische Migrationen unverändert; keine Live-Anwendung.

Unverändert sind sämtliche bisherigen Anwendungsfunktionen, insbesondere G1, T2, Profil-/Closure-RPCs und öffentliche Collection-/Profilprojektionen, sowie bestehende ACL/RLS. Normale public/custom/private-Nutzung ohne den geschützten Closure-/Privatzustand bleibt möglich. Anzeigename, Locale und Avatarpfad bleiben auch im geschützten Zustand änderbar; keine Storage-Aktion durchgeführt.

Native Parallelitätsnachweise: Ein public-RPC und ein direkter custom-UPDATE warten jeweils nachweislich hinter einer tatsächlichen Closure-Transaktion. Nach deren Commit werden beide abgewiesen; Collection bleibt privat und liefert null öffentliche Karten. G1-Marker-Selbstentsperren bleibt unmöglich, Export/Audit bleiben funktionsfähig.

**Keine neue Live-Schema-Attestierung:** Geprüft wurde der aus versionierten Quellen rekonstruierte Sollstand. Production und Staging wurden nicht kontaktiert oder geändert; G2 ist dort noch nicht wirksam.

## 4. Unveränderte Grenzen

G2 ist keine allgemeine Lesesperre und repariert keine eventuell schon zuvor nichtprivaten Closure-Profile rückwirkend. Processing-Hold allein erhält sein bisheriges Profil-Visibility-Verhalten. Das bestehende Sichtbarkeitsmodell wurde nicht verändert.

G3-Scanner, G4-BATTLE-Spieler, G5-Signalisierung sowie D1–D4 bleiben offen. Laufende Medien/Scans, Storage, allgemeine öffentliche Lesefortsetzung und Staff-Reichweite bleiben in den konkret benannten V68-Grenzen. Processing-Holds sind von kategorisierten Retention-/Erasure-Holds zu unterscheiden.

Bestehende Abschluss-/Nachweispfade nicht pauschal abschalten: Export/Audit, vorhandene Scannerabrechnung, Matchabschluss/-belege, Zuschauer-Leave und Service-Revocation. P0-01 bis P0-05 behalten ihre bisherigen Abnahme-/Evidenzgrenzen; P0-05 Kandidat, Production NO-GO, PITR OFF. Kein neues Recovery-Rehearsal ohne Befund. Maximal vier Prozent Verkäufer-Gesamtgebühr einschließlich vom Betreiber übernommener Stripe-Kosten bleibt separate P2-Vorgabe.

## 5. Exakt EIN nächster fachlicher Arbeitsblock

**T3/G3: Neue Scanner-Vorgänge im bestehenden OpenAI-Reservierungs-/Handlerpfad an den vorhandenen Processing-Hold binden; bestehende Reservierungsabrechnung erhalten.**

Begründung: V68 reproduziert neue Reservierungen und einen simulierten realen Handlerlauf trotz Processing-Hold bzw. vollständigem Closure-Paket. Nach G1/G2 bleibt dies die nächste belegte Lücke. Die aktuelle Preview-Deploymentregel ist eine andere Grenze und kein Processing-Hold-Schutz.

Erst nach gesondertem ausdrücklichem Auftrag:

1. Remote/main/PR/CI frisch prüfen; bestehende Reservierungs-, Handler-, Accounting-, ACL-/Definer- und Deploymentpfade am aktuellen Stand abgleichen.
2. Ausschließlich neue Vorgänge unter dem bereits vorhandenen Processing-Hold verhindern. Bestehende zugesagte Reservierungen und deren notwendige Abrechnung erhalten. Keine neue rechtliche Ausnahme, Freigabefunktion, Provideraktivierung oder Semantik für laufende Vorgänge erfinden.
3. Mindestens zwei synthetische Nutzer, isolierte Positiv-/Negativtests mit Provider-Stubs; bei DB-/RLS-/Triggeränderungen native PostgreSQL-17-Abnahme; G1/G2/T2 und Scanner-/Battle-Regressionen erhalten. Keine echten Provideraufrufe oder Kosten.

Nicht Bestandteil: G4/G5, BATTLE/Signalisierung/Storage, neue Regeln für laufende Medien oder In-flight-Verarbeitung, Retention/Erasure, T1/T4–T6, Rechtstexte/Providerverträge oder Release. Ungeklärte Behandlung laufender Vorgänge bleibt eine konkrete Entscheidung; keine pauschale Ausnahme erfinden. Folgepublikation gemäß ausdrücklichem Folgeauftrag.

**G3 wurde nicht begonnen.**

## 6. Ablage und STOP

V70, G2-Abschlussbericht und `DUELVANTA_T3_G2_EVIDENZ_2026-09-26.zip` zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. Das Paket enthält native GitHub-Artefakte, ergänzende lokale Nachweise, Kandidat-/Testdateien, Hashes und finale Repository-/CI-Verifikation.

main/Production/Staging unverändert; PR offen/Draft/unmerged. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Keine echte Kontoschließung, Retention/Erasure, Stripe-Aktivierung, Zahlung, E-Mail, externe Nachricht, Provider-/Vertrags-/DNS-/Key-Änderung. **G2 abgeschlossen. Nächsten Block nicht beginnen. STOP.**
