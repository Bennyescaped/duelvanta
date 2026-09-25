# DUELVANTA – Schritt 9C: aktueller Abschlussstand der Fortsetzung

Stand 25.09.2026, 03:40 UTC. **Datenbank-Rehearsal und drei Storage-Rückspielproben PASS. Abschluss BLOCKIERT ausschließlich an der noch nicht freigegebenen endgültigen Zielbereinigung. P0-03 bleibt bis zum geordneten Abschluss offen. Kein P0-01 begonnen.**

Dieser Abschnitt ersetzt sämtliche historischen Aussagen weiter unten, nach denen Pro-Backups fehlten, kein Restoreziel vorhanden sei oder kein Restore stattgefunden habe. Die historischen Abschnitte bleiben als Ablaufnachweis erhalten, sind aber keine aktuellen Anweisungen.

## Auftrag, Autorisierung und Repository

V55 und Evidence Acceptance sowie V54/9B-Abnahme/V51/Preflight gelesen. Maßgeblich ist der Mindestumfang von V55: aktuelles Backup-/Recoverykonzept für beide Quellen, mindestens ein isolierter Restore und Storage-Integritätsstichproben. Kein zusätzlicher Staging-Clone behauptet oder angelegt. Der Betreiber hat Pro bestätigt, PITR ausdrücklich untersagt und dem vorgeschlagenen temporären Restoreprojekt mit angezeigten zusätzlichen 9,68 USD/Monat zugestimmt. Er setzte dessen neues DB-Passwort persönlich und startete den Restore. Keine Passwort-/MFA-/JWT-Werte ausgelesen.

Fortsetzungshead `2c0621c0e8cea943b7de78f988c24f9708bff72d`, ausschließlich `Bennyescaped/duelvanta`, `marketplace-ux-v1`. `main` unverändert `50f88213571be13255bb52eb489cc28cca660001`; PR #5 open/Draft/unmerged. Nur Berichte/Evidenz veröffentlichen, keine Anwendungscodeänderung, Migration oder manuelle Bereitstellung. Vorhandene Arbeitskopien unangetastet.

## Tatsächlicher Backupbestand

| Quelle | Letztes sichtbar abgeschlossenes physisches Backup | PITR | Umfang und Grenze |
|---|---|---|---|
| Production `enifiaqsnqtbzylnfrpi` | 24.09.2026 06:28:30 UTC | aus | DB/Auth; dieses Backup wurde separat restauriert. |
| Staging `xhmjxrcskfhbovhitdej` | 25.09.2026 00:20:47 UTC | aus | DB/Auth; zeitlich nach 9B. Einzelner Inhalt dieses Backups nicht durch eigenen Restore geprüft. |

Beide Projekte Pro. Staging zeigt am 25.09. acht datierte Einträge, Production sieben; maßgeblich bleibt die dokumentierte Pro-Aufbewahrung von sieben Tagen, keine zusätzliche garantierte Retention aus der UI ableiten. Tagesbackups enthalten keine Storage-Originalbytes. Der alte Mac-Dump vor der MFA-Härtung wird nicht als aktuelle Sicherung ausgegeben.

Der Recoverypfad verwendet nun die vorhandenen verwalteten physischen DB/Auth-Backups. Kein neuer logischer DBdump heruntergeladen. Passwort-Hashes/MFA-Material verbleiben in der geschützten Supabase-Sicherung; kein sensitiver Dump in Git, CI oder Chat. Providerbackup und späterer Storageexport sind keine atomare gemeinsame Sicherung. Bei einem echten Incident muss der passende konsistente Wiederanlaufpunkt anhand Zeitfenster und Inventar gewählt werden. Änderungen nach dem Tagesbackup können verloren gehen; keine sekundengenaue RPO zugesagt.

## Ausgeführter isolierter Datenbank-Restore

Ziel `DUELVANTA-RECOVERY-9C-20260924`, Ref `olgwhgcrtsgsyymiglbu`, gleiche Organisation, eu-central-1. Quelle Production; keine Wiederherstellung über Production oder Staging. Supabase meldet COMPLETED. Projektanlage 24.09.21:28:48 UTC, erster erfolgreicher SQL-Nachweis 21:33:48 UTC: beobachtete DB-Verfügbarkeit nach etwa fünf Minuten. COMPLETED spätestens im Screenshot 21:41:28 UTC belegt; exakte interne Endzeit nicht bekannt. Das ist keine gemessene vollständige Plattform-RTO. Browserunterbrechung und manuelle Anmeldung gehören nicht zur reinen DB-Restorezeit.

| Prüfung | Ergebnis |
|---|---|
| PostgreSQL/Extensions | 17.6, fünf Extensions identisch; keine pg_cron/pg_net im Clone. |
| Auth/Identities/Profile | 17/17/17, passend zum gelesenen Quellbestand. |
| Migration History | 72 Einträge, als Teil des Tabellenhashvergleichs identisch. |
| Anwendungs-/Historydaten | 40 Tabellen, Zeilenzähler und SHA-256 identisch, 0 Abweichungen. |
| Kataloge | 11 Schemas, 97 Relationen, 1002 Spalten, 246 Indizes, 457 Constraints, 28 Trigger, 244 Funktionen, 43 Policies, 24 Default-Privilege-Einträge identisch. |
| Rollen/ACLs | 30 Rollenattribute und Mitgliedschaften identisch; kein Rollenpasswortvergleich/-export. Relations-/Funktions-/Schema-ACLs im Katalogvergleich. |
| Fremdschlüssel | 103 Beziehungen, 0 verwaiste Referenzen. |
| Sequenzen | Sieben Anwendungssequenzen identisch. Auth-refresh_tokens: Backup 241, spätere Quelle 242, explizite zeitliche Differenz. |
| Storage-Metadaten | Drei Buckets und zunächst 86 Objektverweise restauriert. Originalbytes separat behandelt. |
| Vault/Provider | Ziel-Vault leer; keine Entschlüsselung echter Vaultsecrets getestet. Ziel hat keine Edge Functions und keine App-/Vercel-/Stripe-/Mail-/LiveKit-Integration eingerichtet. |
| Readiness | Production-Baseline enthält die neuen Security-/Legal-Readinessfunktionen nicht. Nicht nachinstalliert; daher im Clone nicht anwendbar. Stagingquelle frisch beide compatible=true. |

Das unverändert restaurierte Production-Rechteschema ist ein Wiederherstellungsnachweis, keine Freigabe der bereits bekannten Production-Sicherheitslücken. Keine Testmigration aus P0-01 oder P0-02 ins Ziel eingespielt.

## Storage-Backup und Rückspielproben

Alle 91 Quellobjekte als Originalbytes gesichert: Production collection-cards 74, market-listing-images 6, profile-avatars 6; Staging market-listing-images 5. Gesamt 53.011.650 Bytes. Alle Dateigrößen und MD5-basierten ETags stimmen mit dem jeweiligen aktuellen Quellinventar überein. SHA-256 je Datei im privaten Manifest. Quellinventare vor/nach dieser Fortsetzung identisch, 86/5; für die zuvor heruntergeladenen 80 Dateien zusätzlich Abgleich mit aktuellen ETags. Kein globaler DB/Storage-Transaktionssnapshot behauptet.

Privates Paket: `DUELVANTA_STORAGE_BACKUP_2026-09-25_PRIVATE.zip`, 52.539.677 Bytes, SHA-256 `a4d8a8235783382a0f7ace91ad479ef3369ab0daf01b79a95cc852a82f3bb55c`. Enthält Originalpfade, Projektzuordnung, Größen, ETags und SHA-256. Keine Authdaten oder Providersecrets. Nur privat bereitstellen; niemals in Git/CI veröffentlichen. Öffentliche Evidenz enthält nur Summen, Hashes und gehashte Objektpfade.

Je ein echtes gesichertes Objekt aus allen drei Production-Buckets über den Supabase-Storage-Dienst im isolierten Ziel auf dem ursprünglichen Bucket-/Dateipfad wiederhergestellt und erneut heruntergeladen. Alle drei SHA-256-Vergleiche PASS. Kein bloßes Kopieren in ein lokales Verzeichnis als Storage-Restore gewertet.

Die DBkopie hatte bereits Objektmetadaten ohne Bytes. Der Dashboardupload legte beim ersten Objekt zunächst einen Suffixnamen an. Ausschließlich im Wegwerfziel wurde der leere alte Verweis über den Storage-Dienst entfernt und die zurückgespielte Datei auf den Originalnamen verschoben. Bei den nächsten zwei Proben wurde der leere Zielverweis vor dem Upload entfernt. Originalquellen unverändert. Dashboardimporte erzeugen neue Objekt-IDs/Zeitstempel und owner/owner_id=NULL; dies ist **kein** bitidentischer Metadatenrestore. Bestehende Policies binden die Benutzerrechte an den ersten Pfadteil, der erhalten blieb. Kein normaler Endnutzerlogin/Storage-RLS-Verhaltenstest, keine Wiederherstellung aller 91 Bytesobjekte und kein Staging-Storage-Service-Restore behauptet. Die V55-Stichprobenanforderung ist bestanden; weitergehende Vollwiederanlaufnachweise sind nicht Gegenstand dieses PASS.

## Recovery-Konfiguration und Betriebsablauf

Auth-URL-Inventar frisch read-only: Production Site URL `https://duelvanta.de`, Redirects `/admin.html`, `/app.html`, `/welcome.html`, `/reset-password.html` jeweils auf dieser Origin. Staging Site URL `http://localhost:3000`, keine Redirect-Allowlist. Keine Einstellung geändert und P0-04 dadurch nicht pauschal geschlossen.

Production Edge: invite-beta-user v2, public-card-image v2. Staging Edge laut aktuellem Connector: owner-invite-beta-user v5, invite-beta-user v1, media-broker v5, reconciler v6, inspect v3; tatsächliche Bundlehashes in final-state-20260925.json. Versionsanzeigen gegenüber historischen Handouts nicht als in9C erfolgte Änderung ausgeben. Clone: keine Edge Functions.

Für echten Wiederanlauf separat erforderlich: Vercel-/Code-SHA und Scopeinventar aus V51; Auth Site URL/Allowlist sowie SMTP/OAuth-Konfiguration; Edgequellen/-Deployments; Supabase-API/JWT-/DB-Zugänge; OpenAI-/LiveKit-/Stripe-/Mail-/Worker-/Reconciler-Schlüssel; Scheduler, DNS und Providerkonten. Diese externen Werte/Transaktionen werden durch DBrestore nicht rekonstruiert. Sichere Betreiberablage der Secrets wurde nicht neu attestiert; kein Secretmaterial zur Dokumentation ausgelesen. Keine komplette Provider-Disaster-Recovery-Freigabe, P0-04 und externe Betriebsnachweise bleiben offen.

Sicherer Ablauf bei einem später separat autorisierten Incident: Quelle/Zeitfenster und Neugeschäft prüfen → passende DB/Auth-Sicherung isoliert restaurieren → Rollen/Katalog/History/FKs/Anwendungshashes prüfen → Storage mit ursprünglichen Bucket-/Dateipfaden und passenden Inventaren zurückspielen → Providerkonfiguration aus geschütztem Betreiberbestand getrennt wiederherstellen → Auth-/Storage-/App-Lesepfade testen → erst nach eigener Freigabe Domains/Worker aktivieren und ausstehende Providerereignisse idempotent abgleichen. Kein Payment-/Mail-Replay allein wegen Restore.

**Staging nicht blind physisch klonen:** pg_cron/pg_net und der Vault-Reconciler können externe Aufrufe sofort wieder aufnehmen. Für einen zusätzlichen Staging-Rehearsal kontrollierten logischen Restore oder eine gesondert abgesicherte Schedulerisolation planen; dieser Auftrag hat keinen zweiten Clone angelegt und keine laufenden Scheduler geändert. Der Production-Clone hatte diese Extensions nicht.

## Bereinigung und verbleibender Abschlussblocker

Am 25.09. nach Tests wurde ausschließlich die Löschung des eindeutig bezeichneten Wegwerfprojekts vorbereitet. Der automatische Freigabeprüfer lehnte den finalen Klick ab: Die Zustimmung im übernommenen Gespräch werde nicht als hinreichende vertrauenswürdige Autorisierung für die irreversible Projektlöschung gewertet. Kein Umgehungsversuch über API/SQL/anderen Browser. Danach Projektliste: alle drei Projekte ACTIVE_HEALTHY; Recoveryziel also **noch nicht entfernt**. Weitere anteilige Projektkosten möglich; die 9,68 USD waren eine Monatsprojektion, keine tatsächlich gemessene Rechnung.

Offen ist eine aktuelle ausdrückliche Nutzerfreigabe: endgültiges Löschen von `DUELVANTA-RECOVERY-9C-20260924` / `olgwhgcrtsgsyymiglbu` einschließlich seiner Testdatenbank und drei zurückgespielten Dateien. Production und Staging sind nicht Teil der Löschung. Nach Freigabe finalen Klick erneut versuchen, Projektliste kontrollieren, Cleanupnachweis ergänzen und V56 abschließen. Nicht neue Backups/Cloneprojekte als Umweg anlegen.

## Status und Übergabe

PASS: Pro-/PITR-Status, aktuelles Backupkonzept beider Quellen, vollständiger Storagebyteexport mit Checksums, isolierter Production-DB/Auth-Restore mit Katalog-/Daten-/FK-/Rollenvergleich und drei echte Storage-Service-Rückspielproben, Recoveryinventar und dokumentierte Grenzen. Staging frisch 9 Benutzer/8 Identities/4 verifizierte Faktoren/53 Migrationen, Security/Legal compatible=true. Keine Quellmutation.

**9C-Abschluss BLOCKIERT nur an Cleanupfreigabe. P0-03 bis dahin offen. Nächster einziger Schritt bleibt 9C: temporäres Ziel kontrolliert entfernen und Abschlussnachweis aktualisieren. Kein P0-01.** Production NO-GO, PITR aus, kein Merge/main/Productiondeploy/-migration, keine Zahlung/E-Mail/Domainänderung. Quellen und ursprüngliche Backups bleiben erhalten.

Methodikquelle: https://supabase.com/docs/guides/platform/clone-project (am25.09. erneut gelesen: physischer Clone benötigt bezahlten Plan, nicht PITR; kopiert DB/Auth, aber keine Storagebytes/Edge-/Authkonfiguration; externe DBextensions laufen unmittelbar). Changelog-Markdown war im Webleser wegen Content-Type nicht abrufbar, keine vollständige Changelogprüfung behauptet.

---

## Historischer Arbeitsstand vom 24.09. – durch obigen Abschnitt ersetzt

# DUELVANTA – Schritt 9C: Backup, Restore und Recovery

## Laufende Fortsetzung nach Pro-Aktivierung – noch kein Abschluss

Der Betreiber bestätigt Pro aktiviert und verbietet ausdrücklich jede PITR-Aktivierung. Die frühere Free-Plan-Inventarisierung unten ist historisch und für den aktuellen Backupstatus überholt. Frisch im authentifizierten Dashboard: Pro in beiden Projekten, PITR jeweils deaktiviert (Enable add-on angezeigt), acht als COMPLETED ausgewiesene physische Tagesbackups vom17.–24.09. Latest Production24.09.06:28:30UTC; Staging24.09.00:23:23UTC. Kein Restore auf ein laufendes Projekt und keine Providerkonfiguration geändert.

Recovery-Konzept ergänzt: verwaltete Tagesbackups sind nun ein vorhandener DB/Auth-Recoverypfad. Die aktuelle Pro-Dokumentation nennt7Tage Aufbewahrung; die acht sichtbaren Datumseinträge sind eine Momentaufnahme und keine8-Tage-Garantie. Änderungen seit dem jeweiligen Backup bleiben ein möglicher Datenverlust; kein PITR und keine sekundengenaue Wiederherstellung zugesagt. Stagingbackup ist älter als die9B-Härtung und kann deshalb allein nicht den aktuellen V55-Sicherheitszustand wiederherstellen. Aktueller Staging-Export bleibt erforderlich. Storage-Originalbytes und externe Provider-/Secrets-Konfiguration bleiben separat zu sichern.

Konkreter nächster Restorekandidat: Production-Backup24.09.06:28:30UTC über **Restore to new project**, gleiche Organisation Duelvanta, eu-central-1, separates neu anzulegendes Projekt. Dieser Pfad benötigt laut aktueller Supabase-Dokumentation physische Backups und einen bezahlten Plan, kein PITR. Quelle bleibt unverändert. Source-Extensions im vorliegenden Inventar ohne pg_cron/pg_net; vor Ausführung erneut prüfen, damit der Clone keine externen Jobs übernimmt. Nur dieser Backupstand wäre nach Restore bewiesen, nicht der vollständige aktuelle Livezustand.

Kostenübersicht geöffnet, noch nicht bestätigt: Additional Monthly Compute9,68USD, Disk0USD, Total9,68USD. Kein Projekt erstellt; Continue NICHT geklickt. V55§10 verlangt vor einer neuen kostenpflichtigen Cloudressource ausdrückliche Bestätigung. Vorgeschlagen ist ein temporäres Projekt nur für9C mit kontrollierter Entfernung nach Nachweissicherung. Restore-Dauer, reale nutzungsabhängige Gesamtkosten und Restoreerfolg sind noch nicht belegt. Kein neues Zwischen-Masterhandout. Erst nach dieser konkreten Kostenentscheidung fortsetzen; Production/main/PITR/P0-01 unverändert.

Neue Evidenz im lokalen Arbeitsstand: pro-backups-readonly.json und pro-restore-cost-confirmation.jpg. Dieser Nachtrag ist bis zur Abschlussveröffentlichung ein lokaler Arbeitsstand; die bisherigen SHA256SUMS beziehen sich auf den vorher veröffentlichten Stand.

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
