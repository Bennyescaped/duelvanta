# DUELVANTA – MASTERHANDOUT V69

26.09.2026 · **T3/G1 isoliert und nativ bestanden, Branch-Kandidat veröffentlicht** · Nicht live · Production NO-GO

## 1. Verbindliche Grundlage

Zuerst V69 und `DUELVANTA_T3_G1_MARKER_INTEGRITAET_ABSCHLUSS_2026-09-26.md` vollständig lesen. V68 samt `DUELVANTA_T3_PROCESSING_HOLD_NACHWEIS_2026-09-26.md` bleibt für G2–G5, D1–D4 und die bestehenden Abschluss-/Nachweispfade verbindlich. V67/T2, V66/IT-Recht-Scope, V64/Provider und V62/Readiness gelten in nicht widersprochenen Punkten weiter. Neuere belegte Einzelbefunde haben Vorrang.

IT-Recht-Texte sind konfigurierte Standardtexte, keine bestätigte individuelle DUELVANTA-Rechtsprüfung oder Release-Freigabe. Kein bestätigtes individuelles RA-Nagel-Mandat. V65 bleibt intern/NICHT VERSENDEN. Technische Arbeit hängt nicht pauschal von einer externen Datenschutz-Schlussprüfung ab; konkrete ungeklärte Rechtsfragen bleiben gezielt offen.

## 2. Repository und bestandene technische Abnahme

| Gegenstand | Stand |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `73056a3536d22e46b10b91a097f2df6e5894a3f1` |
| Technischer G1-Head | `c23cf54acbc7fb6884d897b39735af10d47b6db1` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner | #737 / Run 36236209986 SUCCESS |
| Battle | #213 / Run 36236209972 SUCCESS |
| Native G1 | PostgreSQL 17.11, 17/17 Ergebnisgruppen PASS |
| T2 mit G1 | 15/15 PASS, Audit-only-Schreibnachweis über 96 Tabellen/15 Sequenzen |
| Vollständiger Upgradepfad | P0-01/P0-02/P0-05/T2 plus G1 nativ PASS |

Diese Handouts folgen dem technischen Head als **reine Dokumentationsrevision**. Die abschließende Remote-/PR-/CI-Verifikation des Dokumentationsheads steht in `verification.json` des zusätzlichen G1-Evidenzpakets. Vor jedem Folgeauftrag tatsächlichen Remote-Head, main, PR #5 und CI frisch prüfen; die Dokumentationsrevision nicht als unerwartete fachliche Drift behandeln.

Der Nutzer autorisierte den G1-Push nach isoliertem PASS und das dadurch ausgelöste Vercel-Preview. Kein Production-Deployment, Merge oder Live-SQL. GitGuardian war NEUTRAL; die angefragten Actions-Workflows vollständig SUCCESS.

## 3. G1 abgeschlossen

Der bisherige Selbstprofil-UPDATE konnte Processing- und Closure-Marker ändern. Beide Nutzer reproduzierten die Lücke vor Installation in zurückgerollten synthetischen Transaktionen.

Der separate Kandidat `database/account-processing-markers-v1.sql` ergänzt exakt die zwei Gleichheitsprüfungen in `can_update_own_profile_safe` und einen privaten **SECURITY-INVOKER**-Profiltrigger. Tatsächliche Markeränderungen sind für normale DML-Ausführungsrollen gesperrt; vorhandene Tabelleninhaber-/DEFINER-Kontexte bleiben erhalten. Keine JWT-/GUC-Freigabe, keine neue Freischaltfunktion. Bestehende ACL/RLS und übrige Anwendungsfunktionen bleiben unverändert.

`database/account-processing-markers-readiness-v1.sql` ist der passende offline erzeugte Vertrag nach P0-02/P0-05/T2/G1. Alter Vertrag und entfernter/deaktivierter Trigger führen zur geschlossenen Readiness. Historische Migrationen bleiben unverändert; keine Live-Anwendung.

Belegt mit mindestens A/B, vier Zuständen und nativer Konkurrenz:

- Selbstlöschen, Überschreiben und erstmaliges Selbstsetzen beider Marker verweigert; unveränderte Marker und zulässige Profilfelder/RPCs funktionieren.
- Nach Selbst-Entsperrversuch bleibt Collection-Schreiben unter Processing-Hold blockiert; unbetroffene Nutzer funktionieren; Fremdprofile bleiben unverändert.
- Bestehender `request_my_account_deletion`-Setzpfad, Replay und Audit funktionieren; service_role behält seine vorhandenen ACL-/Subjektgrenzen. Kein echter Löschprozess ausgeführt.
- T2-Export einschließlich genau eines hashgebundenen Audit-Events bleibt unter Hold möglich. Vollständiger T2-Test auch mit G1 bestanden.
- In PostgreSQL 17.11 wartet der Selbst-UPDATE tatsächlich hinter einer internen Markertransaktion; nach deren Commit kann er den Marker nicht entfernen. PGlite ist nur Zusatzbeleg.

Die Abnahme rekonstruiert den versionierten Sollstand; sie behauptet **keine frisch attestierten Live-Kataloge**. Production und Staging wurden nicht kontaktiert oder geändert. G1 ist noch nicht auf ihnen wirksam.

## 4. Was offen bleibt

G2-Publikationsschutz, G3-Scanner-Neuvorgänge, G4-BATTLE-Spieler und G5-Signalisierung sind unverändert offen. D1–D4, laufende Medien-/Scanverarbeitung, öffentliche Lesewege und Storage bleiben in den Grenzen von V68. Processing-Hold und kategorisierte Retention-/Erasure-Holds sind unterschiedliche Mechanismen.

Vorhandene Abschluss-/Nachweispfade dürfen nicht pauschal stillgelegt werden: Export/Audit, bestehende Scannerabrechnung, Matchabschluss/-belege, Zuschauer-Leave und Service-Revocation. Keine neue fachliche Ausnahme beschlossen. Keine neuen Scanner-/BATTLE-Guards, keine neue Closure-only-Semantik.

P0-01 bis P0-05 behalten ihre bisherigen Abnahme-/Evidenzgrenzen. P0-05 bleibt Kandidat, Production NO-GO, PITR OFF; kein erneutes Recovery-Rehearsal ohne neuen Befund. Maximal vier Prozent Verkäufer-Gesamtgebühr einschließlich vom Betreiber übernommener Stripe-Kosten bleibt separate P2-Vorgabe.

## 5. Exakt EIN nächster fachlicher Arbeitsblock

**T3-Teilblock G2: Die bestehende Privatstellung der Collection gegen erneute Veröffentlichung über die vorhandenen Profil-Schreibpfade absichern.**

Begründung: Nach geschützter Markerintegrität bleibt der in V68 nachgewiesene `set_my_public_profile(...,'public',...)`-Pfad offen, der die durch den bestehenden Closure-Ablauf gesetzte Privatstellung wieder aufhebt.

Erst nach gesondertem ausdrücklichem Auftrag:

1. Remote/main/PR/CI frisch prüfen; vorhandene Profil-/Visibility-DML/RPCs und den konkreten G2-Befund am aktuellen Stand abgleichen.
2. Ausschließlich die Umgehung der bestehenden Privatstellung schließen. Keine neue allgemeine Lesesperre, kein neues Sichtbarkeitsrecht oder Freigabe-/Ausnahmeverfahren erfinden. Unklare Reichweite ausdrücklich als konkrete Entscheidung offenlassen.
3. Zwei synthetische Nutzer; zulässige Normalfälle, Fremdschutz, vorhandene interne Pfade und G1-/T2-Regressionsschutz; native PostgreSQL-17-Abnahme für DB/RLS/Trigger. Keine Live-Anwendung.

Nicht Umfang: G3/G4/G5, Scanner-/BATTLE-/Signalisierungs-/Storage-Regeln, laufende Medien, Retention/Erasure, T1/T4–T6, Rechtstexte/Provider/Release. Folgepublikation erfordert die im Folgeauftrag festgelegte Autorisierung.

**G2 wurde nicht begonnen.**

## 6. Ablage und STOP

Dieser V69, der G1-Abschlussbericht und `DUELVANTA_T3_G1_EVIDENZ_2026-09-26.zip` liegen zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. Das Paket enthält native GitHub-Artefakte, lokale synthetische Nachweise, Kandidat-/Testdateien, Hashes und finale Head-/CI-Verifikation.

Production/Staging unverändert. PR offen/Draft/unmerged; main unverändert. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Keine Stripe-Aktivierung, echten Zahlungen, E-Mails, externe Nachrichten, Provider-/Vertrags-/DNS-/Key-Änderungen. Kein Retention-/Erasure-Prozess auf echten Daten. **G1 abgeschlossen. Nächsten Block nicht beginnen. STOP.**
