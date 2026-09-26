# F3 – PostgreSQL-17-Nachweis in GitHub CI

Ausgangspunkt: `marketplace-ux-v1`, Head `3bf24d78a9f3789eb8f3e84c70c9a4493ec06d47`. Sieben vorhandene Entwurfsdateien einschließlich unversionierter Dateien vor Änderungen als ZIP, Patch und SHA-256-Inventar gesichert. Kein Reset, kein Branchwechsel. Der erste Commit dieses Blocks enthält ausschließlich Migration, DB-Tests/Fixtures, Testabhängigkeit, CI und Dokumentation; `collect.html` und F3-Browsertest bleiben lokal.

## Automatikprüfung vor Veröffentlichung

Beide vorhandenen Workflowdateien vollständig inventarisiert: SQL-Aufrufe nur an lokale PostgreSQL-Servicecontainer bzw. PGlite, keine Supabase-Deploy-/Migration-Befehle. Repositoryweit keine Anwendung von Migrationsdateien an Remote-Datenbanken gefunden; kein Root-package.json mit Install-/Build-Hook. `vercel.json` enthält nur Functions-Limits und Rewrites, keine Migration oder Build-Anweisung. Aktuelles Vercel-Deployment entspricht Ausgangshead, Quelle Git, kein Framework. Staging-Supabase liefert keine Entwicklungsbranches. Vorhandene Commit-Checks stammen von GitHub Actions und Vercel, kein Supabase-Migrationscheck. Keine Kopplung zur automatischen Staging-/Production-Migration festgestellt. Das Vercel-Buildlog-Werkzeug ist technisch nicht verfügbar; diese zusätzliche Quelle konnte nicht ausgewertet werden. Keine Automatik-/Schutzeinstellung verändert.

## Testjob und Migration

Eigener Job `collect_f3_database` im bestehenden Scanner-Workflow; BATTLE-Workflow und dessen DB-Job unverändert. PostgreSQL `postgres:17`, ausschließlich localhost und synthetischer Servicezugang. Kurzlebige Datenbank pro Testprogramm; keine Supabase-/Production-Secrets, keine externe DB. `pg` 8.16.3 exakt in Testmanifest/Lockfile gepinnt. Pflichtfehler brechen den Job ab; kein Skip und kein continue-on-error.

Unverändert geladene Quelldatei: `supabase/migrations/20260921144947_collect_empty_binder_delete.sql`.
SHA-256: `7ddbbf05f8d6a7e194948ed7fe7a165fced9be24d1bd5d5a87826805ef02252e`.
Noch keine Staging-Anwendung beim vorbereitenden Test-Commit.

Die bisherige F3-DB-Fixture ist in `tests/fixtures/collect-f3-baseline.sql` extrahiert. Ergänzt sind die bestehende Positionsrücksetzung bei Binderwechsel und der Unique-Positionsindex. Relevante Eigentums-RLS, Grants, FK SET NULL/Auth-Kaskade und Datenverarbeitungssperre bleiben enthalten. Unterschiede zu Staging: minimale Tabellen ohne irrelevante Kartenmetadaten, kombinierte statt vier getrennte gleichwertige Eigentums-Policies, synthetische Auth-Claims statt Supabase-Auth-Server, kein bloßer updated_at-Touch-Trigger; keine Produktionstabelle übernommen. Die Löschfunktion selbst wird ausschließlich aus der unveränderten Migrationsdatei geladen.

Die bestehenden F3-Rollenprüfungen, Account-Data-Rights-Regressionsassertions und Username-Erasure-Assertions laufen zusätzlich unverändert auf dem echten Server über einen DB-Adapter. Keine Testassertion abgeschwächt. Die speziellen Account-Fixtures bleiben ihre bestehenden minimalen Fixtures, keine vollständige Kopie des Staging-Schemas.

## Deterministische Parallelitätsmatrix

Zwei dauerhaft gleichzeitig geöffnete Verbindungen führen die Benutzeroperationen unter `authenticated` und synthetischer UID aus; eine dritte Verbindung beobachtet nur Sperren/Endzustände und baut Fixtures auf. Unterschiedliche `pg_backend_pid()`-Werte werden assertiert und dokumentiert. Es werden keine zusätzlichen advisory-/Tabellen-/Zeilensperren als Testbarriere verwendet.

A/B: Erst echter Karten-INSERT bzw. folder_id-UPDATE in offener Transaktion, dann echte Lösch-RPC auf anderer Verbindung. C/D: Zuerst echte Lösch-RPC in offener Transaktion, dann INSERT/UPDATE. Vor Auflösung muss der Beobachter `pg_blocking_pids`, `wait_event_type=Lock` und eine nicht gewährte `pg_locks`-Sperre sehen. Fehlender Block, vorzeitige Rückkehr oder Timeout sind Fehler.

Je Richtung: Gewinner COMMIT, Gewinner ROLLBACK, beide ROLLBACK. Löschablehnung muss exakt `binder_not_empty`/P0001 ergeben; nach gewinnender Löschung muss der konkurrierende Schreibversuch am FK/23503 scheitern und zurückgerollt werden. Der vollständige endgültige Karten-Datensatz wird gegen den erwarteten Stand verglichen, einschließlich Zuordnung/Positionen. Bei Zuweisung wird die reguläre Positionsrücksetzung durch den bestehenden Trigger erwartet; bei abgewiesener Zuweisung bleibt die alte Position erhalten.

F: parallele doppelte Löschung ebenfalls mit beobachtetem Block, COMMIT/ROLLBACK-Varianten und anschließender Wiederholung. Insgesamt 15 verpflichtende Rennfälle. CI-Artefakt `collect-f3-postgres-evidence`: Matrix mit Head-/Checkout-Commit, exaktem Migrationshash, Serverversion, PIDs, Blockgraph, Resultaten, Transaktionsausgängen und Enddaten; zusätzliche echte Rollen-/Account-Testlogs.

## Fortsetzung und Abgrenzung

Erst nach tatsächlich abgeschlossenem grünem CI-Nachweis folgen erneuter Staging-Abgleich, exakt getestete Migration, Rechte-/Definitionsprüfung, Oberfläche mit lokalen Regressionen, Anwendungscommit, beide endgültigen CI-Workflows und praktischer Test mit genau einem neuen leeren synthetischen F3-Binder.

Alte Testkarten/Kaufdaten und `UXCHECK SYNTHETISCH 20260921` bleiben unverändert. Bisherige iPhone-Teilnachweise einschließlich akzeptiertem Kaufdatum sowie Abbrechen/Speichern gelten weiter als Nutzernachweise; der damalige Speichertest ist eine Nutzer-Datenänderung. Neuer F3-Hardwaretest separat, keine Gesamt-/Rechts-/Produktionsfreigabe.

## Nachtrag nach bestandenem Datenbanknachweis

Vorbereitender Test-Commit: `4251d99a2fe514250e00f568d878b9e7708b5781`.
Scanner #617: https://github.com/Bennyescaped/duelvanta/actions/runs/35617424229 — SUCCESS nach unverändertem Wiederholungslauf des F3-Jobs. Im ersten Lauf waren alle SQL-Prüfungen bereits erfolgreich; ausschließlich das Finalisieren des Belegartefakts scheiterte mit HTTP 403. Kein Test/Assertion/Permission wurde dafür geändert. BATTLE #93: https://github.com/Bennyescaped/duelvanta/actions/runs/35617424310 — SUCCESS.

Echter PostgreSQL 17.11, Isolation READ COMMITTED, getrennte PIDs 90 (Schreiber), 91 (Löscher), 89 (Beobachter). Alle 15 Rennfälle und sämtliche Rollen-/Account-Erasure-Regressionsprüfungen PASS. Artefakt `collect-f3-postgres-evidence`, ID `10647545597`, vollständig hochgeladen; ZIP-SHA-256 `6b4bc7f7ff8910004b4c0fc84a6ff0321d893bce5d06eab3ac97bf3314c57ad3`. Die Matrix weist jede beobachtete Sperrkante, Resultate, COMMIT/ROLLBACK und Endzustände aus.

Danach Projektidentität `DUELVANTA-STAGING / xhmjxrcskfhbovhitdej` erneut bestätigt. PostgreSQL auf Staging: 17.6.1.166 (gleiche Hauptversion, anderer Patchstand). FK, Policies, Grants und aktive Trigger unverändert gegenüber Inventar; neue RPC/private Schema vorher nicht vorhanden. Exakt die oben gehashte Migrationsdatei wurde ausschließlich dort angewendet: History-Version `20260921151654`, Name `collect_empty_binder_delete`.

Nachkontrolle PASS: beide Funktionskörper stimmen exakt mit der Quelldatei überein; private Funktion SECURITY DEFINER, öffentlicher Wrapper SECURITY INVOKER, beide Eigentümer postgres und leere search_path. anon/authenticated besitzen kein DELETE/TRUNCATE auf Binder; nur authenticated hat EXECUTE auf Wrapper/Helper. service_role behält Tabellen-DELETE/TRUNCATE für bestehende Bereinigung. MD5-Fingerprint der unveränderten bestehenden Move-/Positions-/Sperr-/Erasure-Funktionen vor/nach identisch: `af673f1e5c1417595ba774e3db491838`. Security-Advisor abgefragt: keine Findings zu den neuen F3-Funktionen; andere Hinweise außerhalb dieses Arbeitsblocks nicht geändert.

Die vorhandene Oberfläche und ihr Browsertest werden jetzt gemeinsam ausgeliefert, erst nach grünen lokalen F3-, F1/F2-, M1–M3-, Kaufdatum- und Binderprüfungen. Endgültiger Anwendungscommit, dessen CI/Deployment und praktischer UI-Löschtest werden separat im Abschlussnachweis dokumentiert. Bis zu dessen erfolgreichem Abschluss bleibt F3 insgesamt offen. Bis hier ausschließlich Schema-/Berechtigungsänderung, keine Staging-Testbestände geändert.

Lokale Prüfungen vor Anwendungscommit: PASS für collect-binder-delete-browser-test, collect-ux-test, collect-ux-browser-test, collect-mobile-ui-test, scanner-v16-binder-layout-test, scanner-v16-collect-e2e, scanner-v16-contract-test, scanner-v16-acceptance-regression-test und runtime-routing-contract-test. Isolierte Browserfixtures: Chromium 140.0.7339.186, gemessene Viewports 1363×844, 390×844 und 430×844 CSS-Pixel. Keine Hardware-Abnahme und keine Staging-Datenänderung durch diese Tests.
