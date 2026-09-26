# DUELVANTA – T3/G2: bestehende Collection-Privatstellung

26.09.2026 · **PASS als isoliert und nativ geprüfter Branch-Kandidat** · Nicht live · Production NO-GO

## Grundlage und Repository

V69 und `DUELVANTA_T3_G1_MARKER_INTEGRITAET_ABSCHLUSS_2026-09-26.md` wurden vollständig frisch aus den gemeinsamen Projektdateien gelesen. V68/T3 bleibt Grundlage für den reproduzierten G2-Pfad. Der ausdrückliche Auftrag umfasst ausschließlich den Schutz der bereits bestehenden Closure-/Privatstellung, die isolierte/native Prüfung und anschließende Branch-Veröffentlichung einschließlich automatischem Preview.

| Gegenstand | Verifiziert |
|---|---|
| Repository / Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `b395d740da3ec1ebc4402fedc5f6368842d2ddcc` |
| Ausgangs-CI | Scanner #738 / Battle #214 SUCCESS |
| Technischer G2-Head | `ac727f8cc30644b4efbf5487176151115fb0280b` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner technische Abnahme | [#739 / 36243704586](https://github.com/Bennyescaped/duelvanta/actions/runs/36243704586), SUCCESS |
| Battle technische Abnahme | [#215 / 36243704536](https://github.com/Bennyescaped/duelvanta/actions/runs/36243704536), SUCCESS |
| Nativer Job | `108408861145`, PostgreSQL 17.11 (`170011`) |
| G2 | **17/17 Ergebnisgruppen PASS** |
| Vollständiger G1-Test mit G2 | **18/18 PASS** |
| Vollständiger T2-Test mit G1/G2 | **16/16 PASS**, 96 Tabellen und 15 Sequenzen |
| Vollständige rekonstruierte Upgrade-Kette mit G2 | PASS |

Bericht und V70 folgen als reine Dokumentationsrevision. Ihr endgültiger Head und die vollständige Abschluss-CI werden separat in `verification.json` des G2-Evidenzpakets festgehalten. Git/API bestätigten den Ausgangsstand übereinstimmend. Keine unerwartete Branch-Drift.

## Tatsächliche Schreib- und Lesewege

Die Untersuchung rekonstruiert die versionierten Funktionen, Kataloge, ACL/RLS und Trigger des frisch geprüften Repository-Heads einschließlich P0-02/P0-05/T2/G1. **Keine neue Live-Katalog-Attestierung:** Production und Staging wurden nicht kontaktiert oder geändert.

| Pfad | Bestehende Funktion / Einordnung |
|---|---|
| `profile.js` Privacy-Auswahl | Ruft `set_my_public_profile` mit `p_collection_visibility` auf |
| `set_my_public_profile(text,text,text)` | SECURITY DEFINER, Inhaber postgres; bindet Profil an `auth.uid()`, sperrt Zeile mit FOR UPDATE, schreibt Visibility; NULL bedeutet unverändert |
| Direkter `profiles`-UPDATE | authenticated besitzt SELECT/UPDATE; eigene Zeile via RLS, geschützte Felder via `can_update_own_profile_safe`; Visibility bisher frei änderbar |
| `request_my_account_deletion` | Vorhandener interner Pfad setzt Closure, Processing, Safety und `collection_visibility='private'` gemeinsam mit Audit |
| `prepare_account_deletion_data` | Bestehender interner Pfad behält private Visibility; nicht geändert, kein neuer Erasure-Auftrag |
| `set_my_collection_folder_visibility(uuid,boolean)` | SECURITY INVOKER, eigene Ordner; vorhandener Processing-Mutationstrigger bleibt unverändert |
| `get_public_duelvanta_collection(text)` | Unveränderte öffentliche Projektion: `public` zeigt Collection; `custom` zeigt bereits als öffentlich markierte Ordner; `private` zeigt keine Items |
| `get_public_duelvanta_profile(text)` | Unveränderte Profilprojektion; keine neue allgemeine Profillesesperre |
| service_role-DML | Profil-UPDATE bereits per P0-02-ACL untersagt; BYPASSRLS hebt fehlende Rechte nicht auf |

Die bestehende Visibility-Constraint kennt **private, public und custom**. Deshalb ist `custom` bei bereits öffentlichen Ordnern ein gleichwertiger Veröffentlichungsweg. A und B reproduzieren vor G2 jeweils den echten Closure-RPC, zunächst null öffentliche Karten, danach erfolgreiche Veröffentlichung per `public` und `custom` mit jeweils einer synthetischen Karte. Jeder Vorhertest wird zurückgerollt.

## Einzige funktionale Änderung

`database/account-closure-privacy-v1.sql` ergänzt genau eine private SECURITY-INVOKER-Triggerfunktion und einen BEFORE-UPDATE-Zeilentrigger auf `public.profiles`.

Die Bedingung verwendet die **gespeicherten OLD-Werte**:

```sql
old.account_closure_requested_at is not null
and old.collection_visibility='private'
and new.collection_visibility is distinct from 'private'
```

Nur dieser Übergang wird mit `42501 / account_closure_collection_private` verweigert. Das schützt auch den vorhandenen SECURITY-DEFINER-RPC; eine bloße RLS-Ergänzung würde diesen privilegierten Schreibkontext nicht zuverlässig erfassen. Der Trigger enthält bewusst keine JWT-, GUC-, current_user- oder service_role-Ausnahme. Auch privilegiertes SQL kann den geschützten Zustand nicht durch einen einzelnen Visibility-UPDATE verlassen. Eine fachliche Freischaltung wurde weder definiert noch als RPC bereitgestellt.

Bestehende Anwendungsfunktionen – insbesondere G1-Prüffunktion und -Trigger, Public-Profile-RPC, Closure-RPC, Export, Scanner, BATTLE und öffentliche Read-RPCs – bleiben **bytegleich**. Ebenso bleiben Tabellen-/Spaltenrechte, RLS-Policies, bestehende Funktions-ACLs und Visibility-Modell unverändert. Der Sicherheitskatalog weist exakt eine neue Funktion und keine entfernten/geänderten bisherigen Katalogeinträge aus; der Legal-Katalog erfasst zusätzlich den Profiltrigger.

`database/account-closure-privacy-readiness-v1.sql` wird ausschließlich offline auf P0-02/P0-05/T2/G1/G2 erzeugt. Der bisherige Vertrag erkennt die Ergänzung als inkompatibel, der passende Vertrag besteht. Fehlender oder deaktivierter G2-Trigger führt zur inkompatiblen kombinierten Readiness. Der Generator hat einen expliziten `--closure-privacy`-Schalter mit notwendiger G1-Basis; die bestehende G1-Ausgabe wurde unverändert gegengeprüft.

## Native Positiv-/Negativnachweise

| Fall | Ergebnis auf PostgreSQL 17.11 |
|---|---|
| A/B: normal ohne Closure | Direkte DML und RPC nach public/custom erlaubt; bestehende Karte sichtbar |
| A/B: nur Processing-Hold, kein Closure | Profil-Visibility-Verhalten unverändert; keine neue Processing-only-Publikationsregel |
| A/B: Closure + private, auch ohne Processing/Safety | DML/RPC nach public/custom verweigert; vollständiges Profil nach Fehlversuch unverändert; keine öffentliche Karte |
| A/B: echtes Closure-Paket aus bestehendem RPC | Gleicher Schutz, vorhandene Marker bleiben gesetzt |
| A/B: synthetisches Closure + bereits public | Keine rückwirkende Lesesperre oder Datenreparatur; nach explizitem Wechsel zu private greift die Übergangssperre |
| Unveränderte Visibility, RPC mit NULL oder private | Erlaubt |
| Displayname, Locale, Avatarpfad über vorhandene Schreibwege | Erlaubt, Marker bleiben unverändert; keine Storage-Aktion |
| Fremdprofil-DML | Null Zeilen; keine Fremdänderung |
| RPC mit zusätzlichem Fremdnutzer-Argument | Nicht vorhanden; keine neue Zielnutzerfunktion |
| INSERT/UPSERT als Ersatzweg | Vorhandene ACL verweigert |
| Öffentlicher Binder bei privatem Profil | Unveränderte Collection-Projektion bleibt leer |
| Ordner-Visibility unter Processing-Hold | Bestehender Hold-Trigger blockiert weiterhin |
| Ordner-Visibility ohne Processing-Hold | Bestehendes Verhalten bleibt erhalten; privates Profil bleibt obere Sichtbarkeitsgrenze |
| Nicht betroffener Kontrollnutzer | Eigene Veröffentlichung weiterhin möglich |
| Gefälschter JWT-role / clientsetzbare GUC | Kein Bypass |
| Bestehender service_role-DEFINER-RPC mit Subjekt | Kann geschützte Privatstellung nicht verlassen; direkte service_role-DML weiterhin ACL-gesperrt |
| Tabelleninhaber / SECURITY-DEFINER-Kontext | Keine pauschale Ausnahme vom geschützten Übergang |
| G1-Selbstentsperrversuch | Verweigert; beide Marker unverändert |
| Export nach erfolgloser Veröffentlichung | V3 erfolgreich, genau ein Audit-Event; vollständiger T2-Nachtest bestätigt Hashbindung und Audit-only-Schreiben |
| Native Konkurrenz A | Veröffentlichungs-RPC wartet nachweislich hinter realer Closure-Transaktion; nach Commit verweigert, private und null öffentliche Karten |
| Native Konkurrenz B | Direkter custom-UPDATE wartet nachweislich hinter realer Closure-Transaktion; nach Commit verweigert, private und null öffentliche Karten |
| G2-Trigger fehlt/deaktiviert | Readiness geschlossen |

Die konkurrierenden Tests weisen tatsächlich vorhandene Sperren mit `pg_blocking_pids` nach. Sie beruhen nicht auf bloßen Timings oder simulierten Rückgaben. Die isolierten Datenbanken werden danach vollständig gelöscht; keine Cloud-Datenbankverbindung.

## Regressionen und Reproduktion

Native G2: 17/17. Der unveränderte funktionale G1-Testumfang wird mit zusätzlich installiertem G2 ausgeführt: 18/18 einschließlich eigenem Marker-Parallelitätstest. T2 wird vollständig mit G1/G2 ausgeführt: 16/16, inklusive eigener/fremder Scanner-/BATTLE-Projektionen, Audit-Hashbindung, 96 schreibgeschützten Tabellen und Vergleich von 15 Sequenzen. Die vollständige versionierte P0-01/P0-02/P0-05/T2/G1/G2-Kette besteht nativ.

Scanner und Battle bestehen vollständig, einschließlich P0-02/MFA-, P0-05-, F3-, Quota-, Spectator- und Browserregressionen. Vor dem Push bestanden ergänzend die isolierten PGlite-Prüfungen. PGlite ersetzt hier keinen nativen Nachweis. Ein ungültiger synthetischer Testusername wurde vor Veröffentlichung korrigiert; keine fachliche Änderung zur Umgehung eines Testfehlers. Kein veröffentlichter CI-FAIL.

```sh
node tests/generate-security-readiness.mjs --data-export --trade-lock --processing-markers --closure-privacy --check
node tests/account-closure-privacy-test.mjs --native
node tests/account-processing-markers-test.mjs --native --closure-privacy
node tests/production-upgrade-rehearsal.mjs --native --trade-lock --data-export --processing-markers --closure-privacy
node tests/account-data-export-collect-battle-test.mjs --native --trade-lock --processing-markers --closure-privacy
```

Der vorhandene native Testaufbau erlaubt ausschließlich localhost/127.0.0.1 und PostgreSQL-Hauptversion 17. Das heruntergeladene native GitHub-Artefakt `10906543864` wurde vor Extraktion gegen SHA256 `18b4f64548811adc2d341c4c200036a1eadf42dce667b29ce6715c60441c9075` verifiziert.

## Grenzen, Ablage und genau ein nächster Block

G2 schützt den bereits privaten Closure-Zustand. Es ist weder eine neue allgemeine Lesesperre noch eine rückwirkende Reparatur eventuell bereits nichtprivater Closure-Profile. Keine neue Hold-Reichweite für Processing-only-Konten. Keine neue Freigabe-/Entsperrfunktion. G1/T2 bleiben erhalten. Production NO-GO; G2 noch nicht live wirksam.

G3–G5 und D1–D4 aus V68 bleiben offen. Keine Scanner-, BATTLE-, Signalisierungs-, Storage-, Retention- oder Erasure-Regeln verändert; kein T1/T4–T6, keine Rechtstexte oder Providerfragen bearbeitet. Bereits vorhandene Regressionen führen unveränderte Datenrechte-/Retention-/Erasure-Untertests ausschließlich synthetisch aus. Keine echte Kontoschließung, kein Erasure-Worker oder Live-Lock. Production/Staging/main unverändert; kein Merge oder Production-Deploy. PITR OFF.

**Exakt ein nächster fachlicher Block: T3/G3 – neue Scanner-Vorgänge im bestehenden OpenAI-Reservierungs-/Handlerpfad an den vorhandenen Processing-Hold binden und bestehende Reservierungsabrechnung erhalten.** Nur nach gesondertem Auftrag; keine neue Behandlung laufender Providerverarbeitung oder Ausnahme erfinden. Nicht begonnen.

Bericht, V70 und `DUELVANTA_T3_G2_EVIDENZ_2026-09-26.zip` werden zusätzlich in den gemeinsamen DUELVANTA-Projektdateien abgelegt. **STOP.**
