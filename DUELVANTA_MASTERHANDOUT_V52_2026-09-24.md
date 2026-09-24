# DUELVANTA – MASTERHANDOUT V52

24.09.2026. **Schritt 9A PASS als versionierter, isoliert getesteter Branch-Kandidat. Keine Anwendung auf Staging oder Production. Echte MFA-/Recovery-Abnahme ausstehend. Production NO-GO. Nach V52 STOP.**

## 1. Verbindlich zuerst vollständig lesen

1. DUELVANTA_MASTERHANDOUT_V52_2026-09-24.md
2. DUELVANTA_SECURITY_SCHRITT9A_PRIVILEGE_MFA_HARDENING_2026-09-24.md
3. database/security-privilege-mfa-matrix-v1.md
4. DUELVANTA_MASTERHANDOUT_V51_2026-09-24.md
5. DUELVANTA_PRODUCTION_READINESS_PREFLIGHT_2026-09-24.md

V52 ist der neue Checkpoint. V51 bleibt für die noch nicht behobenen Production-Blocker verbindlich. Schritt6/7A/7B nicht erneut aufrollen. Weder isolierte Auth-Fixtures noch CI-PASS sind ein echtes MFA-Enrollment oder eine Production-Freigabe.

## 2. Repository, Heads, CI und Arbeitskopien

Repository Bennyescaped/duelvanta, ausschließlich marketplace-ux-v1.

- Ausgangsremote: `f5088c32a38e25c762d200a253b798618fd73212`.
- Implementierung: `9433574ed4856bbf772f4f72a80b1b3aa81a4947`.
- Finaler technischer Kandidat: `b1ca9d02097f3037d552d9f77514c1498bd7d4a2`.
- Finaler Dokumentationshead: Commit mit diesem V52 und Abschluss-/Evidenzdateien; vollständiger SHA im Chatabschluss. Vor Fortsetzung tatsächlichen Remote erneut prüfen.
- main unverändert: `50f88213571be13255bb52eb489cc28cca660001`.
- PR #5 offen, Draft, unmerged.
- Technischer Endstand: Scanner V16 #713 / Run35978306182 SUCCESS; Battle WebRTC #189 / Run35978306176 SUCCESS.
- Vorheriger Implementierungsstand ebenfalls Scanner #712 / Battle #188 SUCCESS.

Native PostgreSQL17.11-Abnahme im Job107563909601; Securityartefakt10799261986. Chromium/Edge im Job107563909331; Browserartefakt10799386602. Native Ergebnis-JSON, exakte Quellenhashes, 2.208 Table-ACL- und 909 Function-ACL-Zeilen sowie Browsernachweise sind im Repository unter evidence/security-step9a-20260924 gesichert. 29 native Prüfgruppen, 7 Browser-/Edge-Fälle. Source-Rekonstruktion stimmt vor Kandidatenanwendung bei allen299 Anwendungsfunktionen exakt mit V51 überein.

Neue Arbeitskopie `/workspace/scratch/162399692991/duelvanta-step9a`; 17 Arbeitskopien inventarisiert. Vorherige Kopie `/workspace/scratch/162399692991/duelvanta` mit lokalen Schritt8-Entwurfscommits unangetastet. Veröffentlichung über GitHub-Connector mit force=false, neue Kopie per Fast-forward synchronisiert. Kein Reset/Branchwechsel, keine fremden Änderungen überschrieben.

## 3. Was Schritt 9A tatsächlich geändert hat

- Explizite Browser-/Service-/Staff-Sollmatrix statt Übernahme breiter Live-Grants.
- Keine Browser-/Service-TRUNCATE/MAINTAIN/REFERENCES/TRIGGER-/Schema-CREATE-Rechte; geschlossene künftige Defaults, eingeschränkte Tabellen-/Spalten-/Sequenzrechte.
- RLS für market_pickup_handovers, trade_user_eligibility, market_notification_sync_state; RPC-only/default deny.
- Alte B06-Service-Ausnahme entfernt; keine neuen dv_core-Wrapper. Alte dv_core-Namen gesperrt.
- AAL2 plus passende aktive Auth-Session, tatsächlicher verifizierter Faktor und aktueller berechtigter Staff-Account für20 Implementierungen, einschließlich Judge, TRADE-Owner, private Scannerfunktionen.
- Administrative RLS-Alternativpfade geschützt; direkte profiles-Rollenmutation entzogen. Normale Nutzerpfade einschließlich Preisangebot/B2C/Widerruf und Festpreis bleiben in der isolierten Abnahme funktionsfähig.
- Einladung nur nach Benutzer-JWT-Prüfung, bevor Service-Client entsteht. Beide Function-Namen owner-invite-beta-user und invite-beta-user sind als einheitlicher Deployment-Kandidat versioniert; **nicht deployt**.
- Historische Legal-Migration nicht verändert. Separater offline erzeugter Sicherheits-/Legal-Readiness-Vertrag mit Negativtests.
- Bestehende Scanner-/Battle-/TRADE-CI grün; künstliche MFA-/Session-/Stripekennungen ausschließlich in wegwerfbarer Testdatenbank bzw. Browser-/Edge-Mocks.

SQL-Anwendungsreihenfolge für einen späteren geprüften Schritt:

1. vollständige kompatible V51-Baseline;
2. database/auth-privileged-step-up-v1.sql;
3. database/security-privilege-mfa-hardening-v1.sql;
4. database/security-readiness-v1.sql.

Das ist **kein vollständiges Upgrade-Manifest für Production**. Die globale postgres-Vorgabe für künftige Function-EXECUTE-Rechte ist bewusst geschlossen; neue Erweiterungs-/Anwendungsfunktionen benötigen explizite Grants. Nicht durch Anwendung alter, breiter Defaults wieder öffnen.

## 4. Tatsächlicher Betriebsstand / BLOCKIERT

Staging xhmjxrcskfhbovhitdej, Production enifiaqsnqtbzylnfrpi.

In Schritt9A keine SQL-Abfrage oder Mutation auf echten Datenbanken, kein Deployment einer Edge-Function und keine Environmentänderung. Damit keine frische Behauptung über fremde Änderungen seit V51; dessen zuletzt belegte Staging-Zähler/Fixture-Hashes/Stripe-OFF-Nachweise bleiben historische Ausgangsevidenz.

**P0-02 ist operativ noch nicht geschlossen.** Die laufenden Projekte wurden nicht gehärtet. V51 belegte0 verifizierte MFA-Faktoren; ein echter sicherer MFA-/Recoveryzugang wurde in9A nicht neu hergestellt oder nachgewiesen. Keine künstliche Session oder Faktorzeile in Supabase anlegen, um die Abnahme zu simulieren.

Weitere P0-01/03/04/05 sowie P1/P2 aus V51 bleiben offen. Keine anwaltliche/steuerliche Schlussprüfung ersetzt. Stripe-Brandingthema, Backup-/Migrationsmanifest, Production-Routing und Notfallsperre nicht als erledigt ausgeben.

7A/7B-Fixtures, pending-Outbox und historische Testzahlungen unverändert erhalten. Keine realen Mails aus synthetischen Nachrichten. Stripe/Sandbox/Mail nicht zur Security-Abnahme einschalten.

## 5. Nächster EINZIGER Arbeitsschritt

**Schritt 9B – kontrollierte Staging-Abnahme des P0-02-Kandidaten mit echtem MFA-/Recovery-Zugang.**

Erst nach separatem Folgeauftrag. Nicht jetzt ausführen. Keine Production-Mutation oder Migrationsplanung weiterer Blöcke im selben Auftrag.

1. V52/Bericht/Sollmatrix lesen; tatsächlichen Remote, main, Draft-PR, Arbeitskopien und CI prüfen. Keine erneute Entwicklung einer parallelen Härtung.
2. Read-only Staging-Baseline, aktuelle Auth-/Sessionstruktur, vorhandene Funktionen/Policies/ACL und echte Betreiberidentität gegen den Kandidaten verifizieren. Keine Sollwerte aus unerklärter Drift übernehmen.
3. **Vor jeder Anwendung** echtes Betreiber-MFA-Enrollment und AAL2 im richtigen Stagingprojekt, verifizierte Session-/Faktorzuordnung sowie praktikablen, separat gesicherten Recoveryzugang nachweisen. Der Benutzer bedient seinen echten Faktor selbst. Keine Token-/Faktor-/Session-Manipulation, keine Browser-Schutzabschaltung. Ohne diesen Nachweis endet9B als BLOCKIERT ohne Migration.
4. Frischen sicheren Staging-Wiederherstellungspunkt sowie Erhalt der7A/7B-Fixtures bestätigen. Kompatibilität beider Invite-Function-Namen und vorhandener technischer Worker prüfen, ohne Einladungen/Mails auszulösen. Production bleibt read-only.
5. Erst mit erfüllten Voraussetzungen und entsprechendem9B-Auftrag den exakt geprüften Kandidaten kontrolliert auf Staging anwenden; passende Migration-History und Reihenfolge sauber dokumentieren. Kein Übernehmen der Testfixtures oder Test-Auth-Zeilen. Beide betroffenen Edge-Namen als gemeinsame Sicherheitsgrenze behandeln, alte ungeschützte Version nicht aktiv zurücklassen.
6. Security-Readiness privilege-mfa-v1 UND Legal-Readiness compatible=true verifizieren. Echte AAL1/AAL2-/Sessionwiderruf-/Ownerprüfung und legitime COLLECT-/BATTLE-/TRADE-Pfade abnehmen; zusätzliche Staffrollen nur kontrolliert und explizit autorisiert. Keine Zahlung, Sandboxaktivierung, reale E-Mail oder Löschung synthetischer Bestandsdaten.
7. Abweichungen sperrend behandeln und minimal im selben Branch beheben; keine Fingerprint-Änderung zum Umgehen der fachlichen Tests. Vollständige CI bei Änderungen. Abschlussbericht und V53 mit tatsächlichem Betriebsstand; danach STOP.

Recovery bleibt identitätsgeprüft über gesicherten Betreiber-/Supabase-Projektzugang. Kein Wiederherstellen breiter Browserrechte, kein Service-Key als menschlicher MFA-Ersatz, kein Ausschalten des Session-Guards.

## 6. Unveränderte Grenzen

Nur marketplace-ux-v1. main/PR nicht mergen. Production-SQL/-Migration/-Deployment verboten. Kein Stripe Live, keine echte Sandboxaktivierung, Zahlung/Refund/Payout, echte E-Mail, Domainumschaltung, unautorisierte globale Sicherheitsänderung oder kommerzieller Launch. Kein TinyFish. Keine neuen Rechts-/Steuerentscheidungen.

**Schritt 9A ist beendet. Nach V52 STOP. Schritt9B wurde nicht begonnen.**
