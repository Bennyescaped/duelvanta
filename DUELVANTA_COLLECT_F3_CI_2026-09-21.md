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
