# DUELVANTA – T3/G1: Integrität der Processing-/Closure-Marker

26.09.2026 · **PASS als isoliert geprüfter Branch-Kandidat** · Nicht live angewandt · Production NO-GO

## Verbindliche Grundlage und Repository

V68 und `DUELVANTA_T3_PROCESSING_HOLD_NACHWEIS_2026-09-26.md` wurden vollständig gelesen. Das zugehörige T3-Evidenzpaket wurde berücksichtigt; seine zwölf G1-Beobachtungen werden durch eigene reproduzierte Vorher-/Nachher-Prüfungen ergänzt. Der ausdrückliche Folgeauftrag autorisierte ausschließlich G1 sowie Veröffentlichung nach isoliertem PASS einschließlich automatisch ausgelöstem Preview.

| Gegenstand | Nachweis |
|---|---|
| Repository / Branch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Frischer Ausgangshead | `73056a3536d22e46b10b91a097f2df6e5894a3f1` |
| Technischer G1-Commit | `c23cf54acbc7fb6884d897b39735af10d47b6db1` |
| main | `50f88213571be13255bb52eb489cc28cca660001`, unverändert |
| PR #5 | offen, Draft, unmerged |
| Ausgangs-CI | Scanner #736, Battle #212 SUCCESS |
| Technische Abschluss-CI | [Scanner #737](https://github.com/Bennyescaped/duelvanta/actions/runs/36236209986), [Battle #213](https://github.com/Bennyescaped/duelvanta/actions/runs/36236209972), beide SUCCESS |
| Native G1-/T2-Abnahme | Job `108388316648`, PostgreSQL **17.11**, `server_version_num=170011` |
| Native G1-Ergebnisgruppen | **17/17 PASS**, inklusive konkurrierender Transaktionen |
| Vollständiger T2-Nachtest mit G1 | **15/15 PASS**, 96 Tabellen und 15 Sequenzen geprüft |

Git-Abfragen und GitHub-API stimmen überein. Die technische Revision enthält ausschließlich sieben G1-Kandidaten-/Test-/CI-Dateien. Dieser Bericht und V69 folgen als reine Dokumentationsrevision; sie ändern den geprüften technischen Baum nicht. Die abschließenden Head-/CI-Metadaten dieser Dokumentationsrevision werden im zusätzlichen Evidenzpaket festgehalten.

## Tatsächliche Ausgangsgrenze

Die Untersuchung nutzt die vollständigen versionierten Kataloge und Funktionen des frisch geprüften Repository-Heads, rekonstruiert mit `securitySchemaFixture`, P0-02, P0-05 und T2. Sie ist **keine neue Live-Schema-Attestierung** von Production oder Staging. Es wurde keine Live-Datenbank kontaktiert oder verändert.

`authenticated` besitzt auf `public.profiles` SELECT/UPDATE. Die verbleibende UPDATE-Policy `profile_update_own_safe_fields` bindet die Zeile an `auth.uid()` und prüft `can_update_own_profile_safe(profiles.*)`. P0-02 entfernt die frühere allgemeine Owner-UPDATE-Policy. Die bestehende Prüffunktion vergleicht bereits ID, E-Mail, Rolle, Safety, Accountstatus, Founder-Felder und Username-Felder; die beiden später ergänzten Marker fehlten. Der Vorhertest reproduziert für A und B das Löschen beider Marker und einen danach erfolgreichen Collection-INSERT und rollt das jeweils zurück.

Vorhandene Profiltrigger: Username-Schutz, Updated-at-Pflege, Owner-Profil- und Owner-Löschschutz. Keiner schützte die beiden Marker. Direkte service_role-UPDATEs sind bereits durch P0-02-ACL ausgeschlossen; BYPASSRLS hebt diese Grenze nicht auf.

Die aktuelle Profil-Schreiberinventur umfasst zwölf SECURITY-DEFINER-Funktionen mit Inhaber `postgres`: `accept_battle_safety_gate`, `accept_duelvanta_safety`, `activate_my_beta_account`, `handle_duelvanta_new_user`, `moderate_battle_report`, `prepare_account_deletion_data`, `request_my_account_deletion`, `review_battle_report`, `review_staff_application`, `set_my_locale`, `set_my_public_profile`, `set_staff_role`. Vollständige Definitionen und ACLs stehen in der synthetischen G1-Evidenz. Quellensuche in den versionierten SQL-Dateien und die rekonstruierte Funktionsinventur weisen `request_my_account_deletion` als vorhandenen Marker-Setzpfad aus. Dessen Parameter erlauben keine frei gewählten Markerwerte oder Freischaltung.

## Präzise Änderung

`database/account-processing-markers-v1.sql` ist eine separate, idempotente Kandidatendatei; bestehende historische Migrationen und Live-Systeme bleiben unverändert.

1. `can_update_own_profile_safe` erhält genau zwei zusätzliche `IS NOT DISTINCT FROM`-Vergleiche für `data_processing_restricted_at` und `account_closure_requested_at`. Vorhandene Vergleiche, Funktionsidentität und ACL bleiben erhalten.
2. Der neue private Zeilentrigger `protect_account_processing_markers_v1` vergleicht OLD/NEW vor jedem Profil-UPDATE. Bei tatsächlicher Markeränderung muss der ausführende Datenbankbenutzer der vorhandene Tabelleninhaber sein. Die Triggerfunktion ist bewusst **SECURITY INVOKER**: Innerhalb vertrauenswürdiger bestehender DEFINER-RPCs zählt deren Inhaber, bei direkter Nutzer-DML die normale DB-Rolle. Keine Auswertung eines behaupteten JWT-`role`, keine clientsetzbare Freigabeflagge, kein neues Entsperr-RPC. Unveränderte Marker passieren den Trigger.
3. `account-processing-markers-readiness-v1.sql` wird offline aus P0-02/P0-05/T2 plus G1 erzeugt. Der vorherige Vertrag erkennt den neuen Stand als inkompatibel; der passende Vertrag besteht. Fehlender oder deaktivierter Profiltrigger lässt die kombinierte Legal-/Security-Readiness geschlossen bleiben. Der vorhandene Generator bekommt ausschließlich einen expliziten G1-Schalter; bisherige Vertragsausgaben bleiben unverändert.

Der Sicherheitskatalog weist genau zwei Funktionsänderungen/-ergänzungen aus. Tabellenrechte, Spaltenrechte, RLS-Policies, vorhandene RPC-ACLs, Scanner-/BATTLE-Funktionen und übrige Funktionen bleiben identisch. Hinzu kommt genau der eine Profiltrigger, den der Legal-Katalog erfasst. Die beiden Readiness-Funktionen bilden diesen neuen Sollstand ab.

Die Tabelleninhabergrenze erhält vorhandene privilegierte Wartungs-/DEFINER-Kontexte. Sie ist keine neu erteilte fachliche Freigabeberechtigung für Nutzer oder Staff. Es gibt weiterhin keinen neuen Anwendungspfad zum Aufheben eines Holds. Ein beliebiger zukünftiger DEFINER-RPC wäre separat zu prüfen; G1 behauptet keinen Schutz vor einem kompromittierten Datenbankinhaber.

## Ausgeführte Positiv-/Negativnachweise

| Prüfung | Native PG17-Ergebnis |
|---|---|
| Zwei Nutzer × kein Marker / Processing allein / Closure allein / bestehendes Paket | PASS |
| Eigenes Löschen, erstmaliges Setzen und Überschreiben jedes Markers, inklusive `infinity` | Verweigert; Marker unverändert |
| Direkter Aufruf der RLS-Prüffunktion mit manipuliertem Profilrecord | false für jeden Marker |
| Profil-UPDATE mit unveränderten Markern und zulässigem `display_name` | Erlaubt |
| Bestehende RPCs `set_my_locale`, `set_my_public_profile` mit privater Collection | Erlaubt; Marker unverändert |
| Fremdprofil-UPDATE samt Markeränderung | Null Zeilen; vollständiges fremdes Profil unverändert |
| Rolleneskalation und INSERT/UPSERT als Ersatzschreibpfad | Verweigert |
| Collection-INSERT nach Selbst-Entsperrversuchen unter Processing-Hold | `account_data_processing_restricted` |
| Unbetroffener anderer Nutzer schreibt Collection | Erlaubt |
| Closure allein ohne Processing | Bestehende Semantik erhalten; keine neue Collection-Sperre erfunden |
| Testweise alter RLS-Helfer, gefälschter JWT-role und clientsetzbare GUC | Trigger blockiert eigenständig |
| Vorhandener Closure-RPC, je A und B, einschließlich Replay | Beide Marker gesetzt; Replay unverändert; genau ein Closure-Audit |
| Export nach internem Marker-Setzen | V3 erfolgreich; Profil unverändert; genau ein Audit mit korrektem Nutzer-/Inhaltshash |
| anon/service_role direkte DML, mit und ohne Subjekt | ACL verweigert |
| Private Triggerfunktion direkt aus anon/service_role | ACL verweigert |
| Vorhandener service_role-DEFINER-Setzpfad | Bestehende ACL erhalten; ohne Subjekt verweigert, mit Subjekt korrekt gesetzt |
| Datenbankinhaber mit gesetztem Subjekt | Bestehender interner Setzkontext erhalten |
| Native Konkurrenz: interner Marker-UPDATE hält Zeilensperre; Nutzer-UPDATE wartet | Tatsächliche Blockierung per `pg_blocking_pids` belegt; nach internem Commit Nutzer-UPDATE verweigert; Hold bleibt und Collection-INSERT scheitert |
| Trigger entfernt oder deaktiviert | Readiness inkompatibel |

Es wurden ausschließlich synthetische Nutzer verwendet. Closure-RPCs liefen nur in isolierten Transaktionen mit ROLLBACK; weder echte Kontoschließung noch Live-Lock oder Erasure wurde ausgelöst. Der native Konkurrenztest speichert nur synthetische Marker im anschließend vollständig gelöschten Wegwerf-Datenbankobjekt.

## Regressionen und CI

Die vollständigen Scanner-/Battle-Workflows sind erfolgreich, einschließlich nativer P0-02-/MFA-, P0-01-/P0-05-, Quota-, F3-, Spectator- und Browserprüfungen. Im bestehenden nativen T2-Job laufen zusätzlich G1, die rekonstruierte Production-Upgrade-Kette mit anschließendem G1 und der vollständige T2-Test mit installiertem G1. Der T2-Test beweist weiterhin lediglich den vorgesehenen Audit-INSERT; 96 Tabellen sind gegen unerwartete Schreibversuche geschützt und 15 Sequenzen werden verglichen.

Vor der Veröffentlichung bestanden ergänzend PGlite-G1, P0-02, die komplette P0-01/P0-05/T2/G1-Kette, Scanner-Handler/-Vertrag, Media-Broker und Data-Rights-Vertrag. Ein anfänglicher Testdatenfehler (`set_my_public_profile` mit ungültigem Username) wurde ausschließlich im Test korrigiert. Es gab keinen fehlgeschlagenen veröffentlichten CI-Lauf und keine fachliche Ausweitung, um einen Test grün zu machen.

Vercel meldet für die technische Revision SUCCESS; ausschließlich das ausdrücklich erlaubte automatische Preview. GitGuardian meldet NEUTRAL, nicht SUCCESS; alle angefragten GitHub-Actions-Workflows und deren Jobs melden SUCCESS. Keine Security-Check-Deaktivierung oder Rechteaufweitung.

Reproduktion mit den gepinnten Testabhängigkeiten:

```sh
node tests/generate-security-readiness.mjs --data-export --trade-lock --processing-markers --check
node tests/account-processing-markers-test.mjs --native
node tests/production-upgrade-rehearsal.mjs --native --trade-lock --data-export --processing-markers
node tests/account-data-export-collect-battle-test.mjs --native --trade-lock --processing-markers
```

`--native` akzeptiert ausschließlich localhost/127.0.0.1, die administrative Wegwerf-Testdatenbank `postgres` und PostgreSQL-Hauptversion 17. Ohne `--native` ist die G1-Ausführung ausdrücklich nur ergänzende PGlite-Evidenz.

## Grenzen und nächster Block

**G1 PASS bedeutet nicht T3 insgesamt PASS und nicht Production-GO.** G2–G5 und D1–D4 aus V68 bleiben offen. Keine Änderung an Scanner-/BATTLE-Guards, Signalisierung, Storage, Retention, Erasure, T1/T4–T6, Rechtstexten oder Providerfragen. Vorhandene Regressionstests prüfen unveränderte Retention-/Erasure-Unterpfade ausschließlich synthetisch; keine Implementierung dieser Bereiche geändert. P0-Abnahmen behalten ihre ursprünglichen Grenzen; PITR OFF.

Genau ein nächster fachlicher Block: **T3/G2 – die bereits gesetzte Privatstellung der Collection gegen erneute Veröffentlichung über bestehende Profil-Schreibpfade absichern**, anhand des belegten Public-Profile-RPC-Pfads und ohne neue allgemeine Lese-/Sichtbarkeitssemantik. Erst nach gesondertem Auftrag. Nicht begonnen.

Bericht, V69 und das native/synthetische Evidenzpaket werden zusätzlich in den gemeinsamen DUELVANTA-Projektdateien abgelegt. Keine externe Nachricht. Production und Staging unverändert; kein Merge, Production-Deploy, Live-Migration oder Live-Lock. **STOP.**
