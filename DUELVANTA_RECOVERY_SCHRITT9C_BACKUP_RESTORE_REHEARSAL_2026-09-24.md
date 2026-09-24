# DUELVANTA – Schritt 9C: Backup, Restore und Recovery

24.09.2026. **BLOCKIERT vor dem Restore. P0-03 bleibt offen. Kein Restore ausgeführt; kein aktuelles vollständiges Backup erstellt. Production ausschließlich gelesen. Kein P0-01 begonnen.**

## Verbindliche Basis und Repository

V55 und die Nachweisgrenzen-Abnahme von Schritt 9B vollständig gelesen; ebenso V54, der vollständige Staging-MFA-Abnahmebericht einschließlich V54-Nachtrag, V51 und Production Readiness Preflight. V55 hat Vorrang vor den historischen 9B-STOPs. P0-02 bleibt im abgenommenen Branch-/Stagingumfang geschlossen.

Repository Bennyescaped/duelvanta; nur marketplace-ux-v1. Frisch bestätigter Ausgangshead: `228ccaeefda8f221a287a0c7649b2e97adcfa98a`. Er ergänzt gegenüber `2a2d016c64529f736fef1a2dcfba688bf523d47f` ausschließlich V55 und die Evidence Acceptance. main unverändert `50f88213571be13255bb52eb489cc28cca660001`; PR #5 open, draft=true, merged=false. Auf V55: Scanner V16 #721 / 36011556079 SUCCESS; Battle WebRTC #197 / 36011556325 SUCCESS. Dies sind bestehende Regressionen, keine Restoretests.

18 bestehende Arbeitskopien read-only inventarisiert. Andere lokale Änderungen/Branches unangetastet. Die saubere Schritt-9A-Kopie steht noch auf 2a2d016; kein Reset, Branchwechsel, Force-Push oder Überschreiben. Neue Berichte/Evidenz separat vorbereitet und über GitHub auf dem verifizierten Remote-Elterncommit veröffentlicht. Git-Netzwerkzugriff lokal lieferte keinen verwendbaren neuen Head; die autorisierten GitHub-Reads lieferten ihn.

## Tatsächlich durchgeführte Prüfung

SQL ausschließlich in `BEGIN READ ONLY`-Transaktionen. Keine Authzeilen, Passwort-Hashes, Sessiontokens, MFA-Seeds, Vertragsinhalte oder private Bilder exportiert. Inventarisierung ist kein Datenbackup.

| Bestand, 24.09. ca. 14:24–14:27 UTC | Production enifiaqsnqtbzylnfrpi | Staging xhmjxrcskfhbovhitdej |
|---|---:|---:|
| PostgreSQL | 17.6 | 17.6 |
| Auth users / identities / profiles | 17 / 17 / 17 | 9 / 8 / 9 |
| Migration History | 72 | 53 |
| Letzte Version | 20260911181702 | 20260924113153 |
| Storage-Objekte | 86 | 5 |
| Collection items / folders | 53 / 5 | 6 / 2 |
| Battle matches | 4 | 13 |
| Listings / offers / deals / orders | 8 / 3 / 9 / 7 | 16 / 4 / 10 / 8 |

Production-Buckets: collection-cards privat 74; market-listing-images privat 6; profile-avatars öffentlich 6. Staging: market-listing-images privat 5. Das sind Metadatenzählungen, keine Prüfung der Erreichbarkeit oder Integrität der Originalbytes. Die historische Lücke von 54 Bildern wird nicht als heutige Fehlmenge fortgeschrieben.

Production-Extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1. Staging zusätzlich pg_cron 1.6.4 und pg_net 0.20.4. Rollenattribute ohne Passwortmaterial, Schema-/Relations-ACLs, RLS/FORCE RLS, Default Privileges, History und Katalogzählungen sind in source-inventory.json enthalten. Vollständige Kataloge wurden read-only abgefragt; die gespeicherte Evidenz ist bewusst ein Inventar und kein rekonstruierbarer Schemaexport.

Keine verwaisten Profile oder Identities in beiden Quellen. Staging hat einen bestehenden Authdatensatz ohne Identity, ohne Passwort, player/beta, nicht gelöscht und nicht anonym. Seine Herkunft wurde nicht abschließend attestiert; nicht korrigiert und nicht als Korruption behauptet. Beim späteren Restore sind 9/8/9 getrennt mit dem frischen Snapshot zu vergleichen, nicht künstlich auf gleiche Zahlen zu setzen. Beide Quellen haben genau eine nicht validierte Provider-Constraint: realtime.messages_payload_exclusive, CHECK payload IS NULL OR binary_payload IS NULL, NOT VALID. Das ist ein Katalogzustand, kein nachgewiesener Datenverstoß und kein Auftrag zu VALIDATE/Repair.

Staging frisch: Security compatible=true / privilege-mfa-v1; Legal compatible=true / trade-legal-contract-model-v1.2. Stripe sandbox=false/live=false; Outbox 12 pending, max_attempts=0, sent=0, errors=0. Die 7A/7B-Daten wurden nicht verändert. Vertragshashes und Staffsessions wurden in diesem 9C-Block nicht erneut separat geprüft; V54 bleibt hierfür die historische Evidenz.

## Backup- und Zielumgebungsbefund

Authentifizierte Backup-Dashboards beider Projekte zeigen: **Free Plan does not include project backups**. Kein verwalteter Restorepunkt wurde angeboten. Kein Upgrade oder kostenpflichtiges Projekt angelegt. Die Projektliste enthält ausschließlich die beiden laufenden Quellprojekte; keines ist ein freigegebenes Restoreziel.

Im aktuellen Ausführungsrechner fehlen psql, pg_dump, pg_restore, postgres/initdb, Docker, Podman und Supabase CLI. Keine direkten DB-/Storage-Zugangsdaten in den geprüften üblichen Umgebungsvariablen vorhanden; das ist kein globaler Beweis, dass der Betreiber keine Credentials besitzt. Keine Zugangsdaten aus Browser-Sessions oder verdeckten Speichern extrahiert. Der SQL-Connector ist für Inventarisierung nutzbar, liefert aber weder einen konsistenten pg_dump noch Storage-Originalbytes oder ein isoliertes PostgreSQL-Ziel.

Der bekannte Staging-Custom-Dump vom Mac (24.09., 13:15:52 CEST, ca. 3,1 MB) stammt **vor** den drei 9B-Migrationen und Staff-Abnahmetests. Vollständiges Dekodieren und TOC-Prüfung waren damals erfolgreich; ein Restore erfolgte nicht. Er bleibt beim Betreiber und ist kein Backup des heutigen V55-Stagingzustands. Das separate damalige Rollenbackup ohne Passwörter bleibt historische Evidenz, SHA256 `75f70ca11af01fd3d4d5f375c83ca8fd3e9e07b282c4f63fe4321d2aa3a7ecf7`. Der historische Production-Backup-/Restorebeleg vom 11.09. ist ebenfalls kein aktueller vollständiger Nachweis.

**V55-HARD-STOP: ungeklärte/nicht verfügbare isolierte Zielumgebung.** Ohne verifiziertes separates Ziel darf kein Restore starten. Eine neue kostenpflichtige Cloud-Ressource bedürfte gesonderter Bestätigung; diese wurde weder angelegt noch als notwendig vorausgesetzt. Sicherer Fortsetzungspfad: isolierter lokaler Supabase-/PostgreSQL-17-Stack auf dem Betreiber-Mac, nach bestätigter Verfügbarkeit der Laufzeit. Kein Restoreversuch auf laufendem Staging als Ersatz.

## Konkretes Sicherungs- und Recoveryverfahren für die Fortsetzung

Die folgenden Schritte sind vorbereitet, **nicht ausgeführt und nicht als PASS bewertet**:

1. Lokales Ziel eindeutig identifizieren: separater leerer Datenbereich, PostgreSQL 17, passende Supabase-managed Schemas/Rollen/Extension-Versionen, keine Verbindung zu den beiden Quell-Refs. Nur Loopback-Ports, ausgehende Verbindungen gesperrt, keine Mail-/Stripe-/LiveKit-Worker, kein aktiver Cron/Reconciler. Restoreziel und Quellverbindungen in getrennten Konfigurationen halten. Vor jedem Restore Zielname, Host, Port und leeren Zustand prüfen. Keine Live-URL in einem Restorekommando.
2. Für Production und Staging getrennte frische Sicherungen erstellen, ausschließlich lesend. DB-Snapshot mit pg_dump einschließlich Auth, Identitäten, MFA-Daten, Anwendungsschemas, History, ACLs/Defaults und Storage-Metadaten; Rollen zusätzlich ohne Rollenpasswörter. Exportvollständigkeit/TOC je Schema prüfen. Nicht annehmen, dass ein CLI-Standarddump automatisch alle internen Schemas enthält. Supabase-managed Rollen/Extensions und Auth-/Storage-Versionen anhand des tatsächlichen Dump-TOC mit dem Ziel abgleichen; Konflikte nicht durch pauschales Ignorieren oder Entfernen von Schemas verdecken.
3. Auth-Passwort-Hashes und MFA-Material im vollständigen Backup als hochsensibel behandeln: verschlüsselte Betreiberablage, restriktive Dateirechte, keine Git-/CI-/Chat-Uploads, keine Klartextprotokolle. Rollenpasswörter, Providerkeys und Vault-/Auth-Verschlüsselungsschlüssel gehören separat in den geschützten Recoverybestand. Keine Production-Passwortrotation für diesen Test. Eine Datei mit verschlüsseltem Vault-Inhalt ist ohne passenden Schlüssel nicht automatisch wiederherstellbar.
4. Alle Storage-Originalbytes separat über autorisierten read-only Download sichern, projekt- und bucketgetrennt. Privates Manifest mit Objektpfad, Version/ETag soweit verfügbar, Größe und SHA256; im Bericht nur Anzahl und Manifesthash. Vollständigkeit gegen alle 86 bzw. 5 Objekte des jeweiligen frischen Zeitfensters prüfen. Bei parallelen Änderungen Inventar vor/nach Export vergleichen und geänderte Objekte erneut lesen; keine transaktionsübergreifende Konsistenz behaupten. Die Anwendung bleibt unverändert verfügbar, keine Production-Schreibsperre in diesem Auftrag.
5. SHA256 aller Sicherungsdateien und Metadatenmanifeste, UTC-Zeitfenster, Quellref, PG-Client-/Serverversionen, Exportfehler und sichere Ablage dokumentieren. Dump offline vollständig dekodieren. Sicherungs-Sollzähler aus demselben Snapshot gewinnen; die obigen Livezähler sind nur Ausgangsinventar und dürfen laufende Änderungen nicht als Restorefehler erscheinen lassen.
6. Restore in das verifizierte lokale Ziel: Zielstack/managed Baseline und Erweiterungen, angepasste Rollen ohne Quellpasswörter, Schema/pre-data, Auth-/Anwendungsdaten, Sequenzstände, post-data mit Constraints/Indizes/Triggern sowie exakte ACLs/Policies/Defaults. Die exakte Reihenfolge und Ausnahmen erst gegen den tatsächlichen Dump und Zielstack festlegen. Fehler stoppen die Abnahme. Bei Import mit deaktivierten Triggern sämtliche betroffenen FKs gesondert prüfen; Wiederaktivieren allein validiert importierte Daten nicht. Outbox, Cron, Webhooks und Providerdispatch bleiben inaktiv. Nicht die neue Production-Migrationskette aufspielen: das wäre P0-01.
7. Storagebytes in das lokale isolierte Storageziel zurückspielen und Manifest-/Stichprobenhashes vergleichen. Eine reine Dateikopie ohne nachgewiesene Storagezuordnung ist kein vollständiger Storage-Service-Restore. Private Inhalte niemals in Evidenzabbildungen zeigen.
8. Abnahme: alle Historyversionen/-namen, Auth/Identities/MFA/Profile-Zähler und Beziehungen, sämtliche App-Tabellenzähler einschließlich 7A/7B, Vertrags-/Widerrufshashes, Sequenzen, Constraints/FK-Orphans, RLS/Policies, Funktionsdefinitionen/-Owner/-search_path, ACLs/Defaults, Extensions und Storageinventare mit Sicherungsmanifest vergleichen. Staging-Security/Legal-Readiness im Ziel prüfen. Production hat diese Readinessfunktionen aktuell nicht; sie nicht zum Test nachinstallieren. Nicht unterstützte Teile klar BLOCKIERT/NICHT GETESTET ausweisen.
9. Start/Ende/Restorezeit messen; daraus keine ungemessene produktive RTO oder RPO ableiten. Nach dokumentierter Abnahme lokalen Teststack kontrolliert stoppen und ausschließlich dessen Wegwerf-Datenvolumes entfernen. Verschlüsselte Quellsicherung/Manifeste separat erhalten. Löschumfang anhand eindeutiger lokaler Zielidentität prüfen; keine pauschalen Docker-Prune-/rm-Kommandos.

## Environment-/Provider-Recoveryinventar und Grenzen

| Bereich | Benötigter Recoverybestand | Aktueller Nachweis |
|---|---|---|
| Git/Vercel | main-/Branch-SHA, Deployments, Build/Node/Region, Domains, Env-Namen und Scopes | SHA/PR frisch; V51 enthält Deploy-/Scopeinventar. Vercel Shared frisch weiterhin ohne verknüpfte Variablen. Kein vollständiger neuer Env-Export. |
| Supabase | Projektrefs/Region, PostgreSQL/Extensions, Edgequellen/-Versionen, API-Schemas, Auth Site URL/Redirects/SMTP/OAuth, Storagelimits, Scheduler | DBinventar und Edge-Metadaten frisch gelesen; Auth-/API-Konfiguration und Secret-Verfügbarkeit noch nicht vollständig gesichert. |
| Secrets | DB-/Rollenpasswörter, JWT-/Auth-/Vault-Schlüssel, service_role, OpenAI, LiveKit, Stripe, Worker-/Reconciler-Secrets | Werte bewusst nicht ausgelesen. Sichere Betreiberablage und Wiederherstellbarkeit noch zu attestieren. Neue isolierte Testkeys ersetzen keinen Nachweis entschlüsselbarer Originaldaten. |
| Stripe | Konten/Capabilities, Webhooks, Events/Reconciliation, externe Transaktionen | Nicht aus DB-Dump rekonstruierbar; kein Providerzugriff/Replay in 9C. Sandbox/Live OFF. |
| LiveKit/OpenAI/Mail/DNS | Projekte/Regionen, Keys, Limits, SMTP/Resend-Absender, DNS/TLS, Zugriffs-/Recoverywege | Separate Providerkonfiguration erforderlich; V51 bleibt partielles Inventar. Keine Mail, kein Media-/KI-Aufruf und keine Domainänderung. |

Im realen späteren Incident ist zuerst ein konsistenter Wiederanlaufpunkt zu bestimmen; Code-Rollback allein restauriert keine DB. Offene Zahlungs-/Mailereignisse werden erst nach separat autorisierter Freigabe idempotent abgeglichen. Dieses Dokument autorisiert keinen Production-Restore und keine Wiederholung wirtschaftlicher Aktionen.

## Ergebnis und nächster einziger Schritt

PASS: lesende Quelleninventarisierung, tatsächliche Backup-Verfügbarkeit geprüft, Branch/main/PR/CI-Basis bestätigt, Staging Readiness und OFF-Betrieb bestätigt.

BLOCKIERT: aktueller vollständiger DB/Auth/Storage-Export, sicherer Schlüsselbestand, identifiziertes isoliertes Restoreziel, tatsächlicher Restore, Hash-/FK-/ACL-/Funktionsvergleich nach Restore, gemessene Restorezeit und Zielbereinigung. **Kein Teil hiervon wurde als ausgeführt ausgegeben. P0-03 nicht geschlossen.**

Als nächstes ausschließlich 9C fortsetzen: verfügbare lokale Docker-/PG17-Laufzeit auf dem Betreiber-Mac feststellen, danach dort sicheren Export und isolierten Zielstack konkret vorbereiten. Keine generische Kostenfreigabe nötig. Keine Passwörter oder unverschlüsselten Dumps im Chat anfordern. P0-01, Merge, main, Production-Mutation/-Deploy, Stripe Live, echte Zahlung/E-Mail und TinyFish bleiben ausgeschlossen.

Quellen zur Methodik, am 24.09. geprüft: https://supabase.com/docs/guides/self-hosting/restore-from-platform und https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore . Dokumentation ersetzt keinen ausgeführten Test. Changelog-Markdown konnte vom Webleser nicht verarbeitet werden; keine vollständige Changelogprüfung behauptet.
