# DUELVANTA – Schritt 9A: Privilege / MFA Hardening

24.09.2026. **Branch-Kandidat und isolierte Abnahme: PASS. Staging-Anwendung und echte MFA-/Recovery-Abnahme: BLOCKIERT / nicht ausgeführt. Production weiterhin NO-GO.** Kein Live-Sicherheits-PASS und keine Rolloutfreigabe.

## 1. Verbindliche Basis und Repository

V51 und Production-Readiness-Preflight vollständig gelesen. V51 hat Vorrang. Ausschließlich `Bennyescaped/duelvanta`, `marketplace-ux-v1`.

- Ausgangsremote: `f5088c32a38e25c762d200a253b798618fd73212`, exakt bestätigt.
- main: `50f88213571be13255bb52eb489cc28cca660001`, unverändert.
- PR #5: offen, Draft, unmerged.
- Ausgangs-CI: Scanner #711 / Battle #187 SUCCESS.
- Implementierung: `9433574ed4856bbf772f4f72a80b1b3aa81a4947`.
- Finaler technischer Kandidat einschließlich Festpreis-Grenztest: `b1ca9d02097f3037d552d9f77514c1498bd7d4a2`.
- Bericht-/V52-Commit folgt separat. Sein vollständiger Remote-SHA steht im Chatabschluss; kein selbstreferenzieller Dateihash.
- Staging: `xhmjxrcskfhbovhitdej`; Production: `enifiaqsnqtbzylnfrpi`.

17 Arbeitskopien einschließlich neuer isolierter Schritt-9A-Kopie inventarisiert. Vorhandene fremde Änderungen/Entwurfscommits nicht verändert. Neue Kopie `/workspace/scratch/162399692991/duelvanta-step9a`, gleicher Branch. GitHub-Connector publiziert mit force=false; lokale Kopie anschließend ausschließlich per Fast-forward synchronisiert. Kein Reset, Force-Push oder Branchwechsel.

## 2. Gewähltes Soll und fachliche Grenzen

Die verbindliche detaillierte Matrix ist `database/security-privilege-mfa-matrix-v1.md`. Sie beschreibt Browser-DML, Spaltenrechte, Sequenzen, Servicezugriffe, RLS, privilegierte RPCs, Default Privileges und Enrollment/Recovery.

Die Umsetzung übernimmt keine breiten Live-Grants als Ziel. Alle Browser-/Service-TRUNCATE-, MAINTAIN-, REFERENCES-, TRIGGER- und Schema-CREATE-Rechte werden in den sechs Anwendungsschemas entfernt. Browserrechte auf Tabellen/Spalten werden gezielt neu aufgebaut; damit bleiben verdeckte Spalten-Grants nicht nach einem Tabellen-REVOKE bestehen.

Browser behalten insbesondere eigene COLLECT-Daten, RPC-basiertes Löschen leerer Binder, eigene sichere Profile, beteiligtengebundene BATTLE-Signale/Reports sowie normale TRADE-Nutzerpfade. Anonyme Wartelisteneinträge sind auf email/consent/source begrenzt. Owner-Updates der Warteliste sind auf ihre sechs Betriebsfelder begrenzt und erfordern AAL2. Direkte Owner-Rollenänderungen über profiles werden entfernt; geprüfte Staff-RPCs mit Audit bleiben.

Service erhält direkte SELECT-Rechte nur auf profiles, collection_folders, collection_items und market_listings für die bestehenden serverseitigen Bild-/Sichtbarkeitsprüfungen. Direkter Audit-INSERT ist auf vier Spalten beschränkt. Andere Worker verwenden ihre freigegebenen SECURITY-DEFINER-RPCs. Keine raw-table-DML-Vollmacht als Standard für Service. Storage/Auth-Administration durch vorhandene technische Provider-APIs wird weder freigeschaltet noch verändert.

Die drei RLS-Lücken sind im Kandidaten geschlossen: private market_pickup_handovers, private trade_user_eligibility und public market_notification_sync_state. Keine Browser-Policy ist absichtlich korrekt: Geschäftslogik läuft über autorisierte RPCs. Ownerrechte des Objektbesitzers postgres bleiben erhalten.

Default Privileges für zukünftige postgres-Anwendungsobjekte sind geschlossen. Zusätzlich wird die globale implizite PUBLIC-EXECUTE-Vorgabe für künftig von postgres erzeugte Funktionen entzogen; Schema-REVOKE allein könnte sie nicht beseitigen. Auswirkungen auf zukünftige Erweiterungen/Migrationen sind ausdrücklich dokumentiert. Bestehende verwaltete Supabase-Objekte, andere Erstellerrollen, JWT-/Auth-Projekteinstellungen und globale Rollenattribute bleiben unberührt.

## 3. MFA / Session / alte Pfade

`database/auth-privileged-step-up-v1.sql` ersetzt den bislang nicht angewandten B06-Entwurf. Kein Umbenennen in neue öffentlich erreichbare dv_core-Funktionen. Vorhandene dv_core_*-Altpfade werden Browsern und Service entzogen.

Der neue Session-Guard verlangt:

1. nicht-anonyme, authentisierte Benutzeridentität und JWT-Rolle authenticated;
2. JWT-AAL2;
3. passende auth.sessions-ID desselben Benutzers, aal2 und nicht abgelaufenes not_after;
4. passenden, weiterhin verifizierten auth.mfa_factors-Eintrag;
5. aktuelle Profilrolle owner/admin/moderator/judge, active/beta, nicht safety_restricted.

Die fachliche Owner-/Permission-/Objektprüfung erfolgt weiterhin im ursprünglichen Funktionskörper. **MFA allein macht einen Judge nicht zum Owner.** Service-JWTs haben keine pauschale Ausnahmeregel für menschliche Admin-Aktionen.

Abgedeckt sind 20 tatsächliche Implementierungen: acht ursprüngliche Staff-RPCs, Judge-Desk und Streitentscheidung, acht TRADE-Ownerfunktionen sowie zwei private Scanner-Ownerfunktionen. Die öffentlichen Scannerfassaden können die private Prüfung nicht umgehen. Direkte administrative RLS-Lesepfade wurden mitgeschützt. Eigene Profil-/Antrags-/Berechtigungslesepfade bleiben für normale Bedienung und Enrollment erreichbar.

Pure Identitätshelfer bleiben semantisch erhalten, weil beispielsweise der Schutz eines **Zielkontos** nicht von der MFA des Aufrufers abhängen darf. Sie berechtigen nicht zu einer Service-Eskalation.

## 4. Edge- und Browsergrenze

Der versionierte Einladungs-Handler verlangt `get_my_privileged_access_v1()` mit dem Benutzer-JWT, bevor ein Service-Client erzeugt wird. Der historische Function-Name `invite-beta-user` verweist als neuer versionierter Einstieg auf dieselbe geprüfte Implementierung. **Keiner der beiden Edge-Endpunkte wurde deployt.** Die tatsächlich laufende historische Production-Version gilt nicht als gehärtet; beide Namen gehören in die spätere gemeinsame Deployment-Abnahme.

Im isolierten Handler-Test wurde zusätzlich die vorhandene doppelte Regex-Escapierung der Mailvalidierung erkannt und minimal korrigiert. Kein Mailprovider oder echter Invite wurde aufgerufen. BATTLE bietet bei erforderlicher MFA einen Link zur vorhandenen MFA-Seite; Moderator ist im bestehenden Staff-UI berücksichtigt. Kein MFA-Enrollment durch diesen Auftrag.

## 5. Readiness ohne Fingerprint-Abkürzung

Die datenfreie Testbasis wird aus versionierten Ausgangsdefinitionen und bestehenden Migrationsquellen aufgebaut. Vor dem Kandidaten werden **alle 299 Anwendungsfunktionen** gegen die V51-Kataloge verglichen: keine fehlende, keine abweichende Definition. Zusätzliche Katalogmetadaten dienen nur der Rekonstruktion der Ausgangslage, nicht der Ableitung erlaubter Rechte.

Die historische Legal-Migration und `tests/generate-legal-readiness.mjs` bleiben unverändert. `tests/generate-security-readiness.mjs` erzeugt ausschließlich offline nach Anwendung des bewusst definierten Kandidaten:

- den neuen Sicherheitsvertrag `privilege-mfa-v1` mit 419 Katalogchecks;
- einen angepassten Legal-Katalogvergleich mit 266 Checks mit unveränderter Legal-Semantik `trade-legal-contract-model-v1.2`, der zusätzlich den Sicherheitsvertrag verlangt.

Strukturelle Fingerprints ersetzen keine Verhaltensprüfung: separate Tests prüfen die explizite Rechte-Matrix, reale Geschäftslogik, Session-/Rollenfälle sowie absichtlich falsche ACLs/Policies/Funktionen/Defaults. Diese Fehler müssen beide Readiness-Prüfungen schließen. Der Generator verbindet sich nie mit Supabase und schreibt kein Live-Soll ab.

## 6. Isolierte Nachweise

Lokales PGlite dient nur schneller Rückmeldung. Der verbindliche native Lauf verwendet den vorhandenen Wegwerf-Servicecontainer `postgres:17` in GitHub Actions, localhost-only-Verbindungsprüfung, isolierte Datenbank und abschließenden Drop. PostgreSQL-Patchstand des ersten erfolgreichen Laufs: **17.11 (170011)**. Das ist kein Test direkt auf den Supabase-17.6-Projekten.

Getestet werden:

- 2.208 Tabellen-/Rollen-/Rechtekombinationen und zusätzlich vollständiges Function-ACL-Register;
- negative Browser-/Service-TRUNCATE/MAINTAIN-/Sequenz-/private-Tabellenrechte;
- alle 20 privilegierten Implementierungen mit AAL1, gelöschter/fremder/ungültiger Session-ID, anonymem Benutzer und Service-Rolle;
- AAL2-Session mit nicht verifiziertem/entferntem Faktor, abgelaufenem not_after, eingeschränktem/gesperrtem Account;
- AAL2-Owner, Admin, Moderator und Judge durch echte Funktionen für Rollen, Permissions, Moderation, Pause/Fortsetzung und Streitentscheidung;
- Direktzugriffe auf Audit, Profile, Reports und private Matches ohne AAL2 sowie direkte Rolleneskalation;
- eigene COLLECT-Karte/Binder/F3-Löschung, Profile, Scannerbudget, History/Deals und Waitlist;
- normaler AAL1-Pfad Listing → Preisangebot → Händlerannahme → B2C-Snapshot → Widerruf;
- Festpreis mit strikt getrennter Benutzer-/Service-Rolle, idempotenter Order-/Attempt-/Allocation-Erstellung und ausdrücklich **synthetischen** Providerkennungen;
- autorisierter Outbox-Claim und Media-Worker ohne Provideraufruf; Browserzugriff darauf verweigert;
- neue Tabellen/Sequenzen/Funktionen in allen Anwendungsschemas bleiben ohne expliziten Grant geschlossen;
- 13 gezielte Readiness-Korruptionen einschließlich MFA-Guard-Manipulation, Alt-RPC-Freigabe und Default-Privilege-Aufweitung;
- Chromium bei 390/1363 Pixeln: tatsächliche MFA-Seite mit fehlgeschlagener/synthetisch erfolgreicher Challenge, Staff-Step-up-Link;
- tatsächlicher TypeScript-Edge-Handler mit isolierten Clients: AAL1, widerrufene Session und Nicht-Owner erzeugen **keinen** Service-Client/Invite; synthetischer Owner-AAL2-Erfolg läuft ausschließlich gegen Mock;
- bestehende Scanner-, BATTLE-, TRADE-, Quota-, F3-, Account-Data-Rights-, Legal-, Withdrawal- und Browserregressionspakete unverändert als Gesamt-CI.

Die bisherigen acht Stub-RPCs im alten Auth-Test wurden durch die neue verpflichtende native Prüfung echter Implementierungen ersetzt; die ursprüngliche BATTLE-/Profile-Auth-Regression bleibt erhalten.

### CI-Zuordnung

- Implementierungshead 9433574…: Scanner #712 / Run35977952288 SUCCESS; Battle #188 / Run35977952309 SUCCESS. Nativer Security-Job107562785127 erfolgreich, Artefakt10798752146.
- Finaler technischer Head b1ca9d0…: Scanner #713 / Run35978306182 SUCCESS; Battle #189 / Run35978306176 SUCCESS. Nativer Security-Job107563909601 PASS, Artefakt10799261986; Chromium/Edge im Job107563909331 PASS, Artefakt10799386602..
- Finaler Dokumentationshead: zusätzliche automatische CI nach Veröffentlichung im Chatabschluss; technische Quellen und SHA256-Nachweise im Evidenzverzeichnis.

Evidenz wird unter `evidence/security-step9a-20260924/` versioniert: Workspaceinventar, native Ergebnisdaten, Function-/Table-ACL-Nachweise, CI-Zuordnung und ausgewählte Browser-/Edge-Nachweise. Keine realen Auth-Sessions, Factors, Secrets oder Kundendaten.

## 7. PASS / BLOCKIERT

| Bereich | Tatsächlicher Stand |
|---|---|
| Versionierter Least-Privilege-/RLS-/MFA-Kandidat | PASS als isolierter Kandidat |
| Native PostgreSQL17-/Browser-/CI-Abnahme | siehe konkrete Laufzuordnung; kein Live-Test |
| P0-02 in laufendem Staging behoben | **NEIN – nicht angewandt** |
| Echtes MFA-Enrollment / Recovery | **BLOCKIERT / nicht nachgewiesen**; V51 meldete 0 verifizierte Faktoren, in diesem Block keine Live-Auth-Abnahme |
| Historische Production-/Staging-Edge-Funktionen deployt | **NEIN** |
| Production / Merge / öffentlicher Launch | **NO-GO**, weitere P0/P1/P2 aus V51 bleiben offen |

Keine unbekannte Datenkorruption, keine neue Rechts-/Steuerentscheidung und kein nicht isolierbarer Sicherheitsumbau erforderte einen HARD STOP. Kleine Fixture-/Testprobleme wurden im selben Block gelöst, ohne Zwischen-Handout. Keine Prüfung gegen echte Datenbanken und keine künstlichen Auth-Zeilen dort.

## 8. Anwendung und Recovery – ausschließlich späterer Plan

Erst echte Betreiber-MFA, verifizierte Session/Faktorzuordnung, unabhängiger Recoveryzugang, aktuelle Sicherung und passende Baseline bestätigen. Dann separat autorisierter Staging-Schritt mit exakt gepinntem Kandidaten: Auth-Guard → ACL/RLS/weitere Guards → Security/Legal-Readiness → beide Invite-Endpunkte kontrolliert abgleichen/deployen → echte positive/negative MFA-/Session-Abnahme → COLLECT/BATTLE/TRADE-Smoke ohne Zahlung/Mail/Sandboxaktivierung. Synthetische 7A/7B-Evidenz unverändert erhalten.

Bei Fehler vor Commit Transaktion zurückrollen. Bei späterem Funktionsverlust sperrend belassen und im Branch korrigieren; nicht breit Rechte zurückgeben oder den MFA-Guard abschalten. Recovery bei Faktorverlust erfolgt durch den verantwortlichen Betreiber über gesicherten Supabase-Projektzugang mit verifizierter Identität, Sessionwiderruf und echtem neuem Enrollment, niemals durch künstliche Session-/Faktorinserts. V52 bestimmt den nächsten einzelnen Auftrag.

## 9. Ausdrücklich nicht ausgeführt

Kein Production- oder Staging-SQL, keine Migration auf echten Projekten, keine Auth-/MFA-/Sessionänderung an echten Konten, kein Edge-Deployment, keine Env-/Domainänderung, kein Merge/main-Eingriff, kein Production-Deployment, kein Stripe Live, keine echte Sandboxaktivierung, keine Zahlung/Refund/Payout, keine echte E-Mail oder Einladung, keine Bereinigung, keine Änderung der 7A/7B-Fixtures, kein TinyFish. Automatische Branch-Preview/CI sind kein Production-Rollout.

**Nach Veröffentlichung von V52 STOP. Kein Schritt 9B ausgeführt.**
