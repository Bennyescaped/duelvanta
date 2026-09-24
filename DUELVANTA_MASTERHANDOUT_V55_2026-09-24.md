# DUELVANTA – MASTERHANDOUT V55

24.09.2026. **Schritt 9B ist abgeschlossen. P0-02 – Berechtigungs-/RLS-/MFA-Härtung – ist auf Staging technisch und operativ im dokumentierten Umfang abgenommen. Production bleibt NO-GO.**

## 1. Verbindlich lesen

Vor Folgearbeit vollständig:

1. `DUELVANTA_MASTERHANDOUT_V55_2026-09-24.md`
2. `DUELVANTA_SECURITY_SCHRITT9B_EVIDENCE_ACCEPTANCE_2026-09-24.md`
3. `DUELVANTA_MASTERHANDOUT_V54_2026-09-24.md`
4. `DUELVANTA_SECURITY_SCHRITT9B_STAGING_MFA_ACCEPTANCE_2026-09-24.md`
5. `DUELVANTA_MASTERHANDOUT_V51_2026-09-24.md`
6. `DUELVANTA_PRODUCTION_READINESS_PREFLIGHT_2026-09-24.md`

V55 ist der aktuelle Checkpoint.

V54 bleibt Live-Evidenz der tatsächlich ausgeführten Rollen-/MFA-/Widerrufs-/Geschäftstests.

Die neue Evidence-Acceptance-Datei dokumentiert ausschließlich die ausdrücklich akzeptierte Methodikgrenze für die zwei nicht regulär herstellbaren Sessionfälle.

## 2. Repository

Ausgangshead vor V55:

`2a2d016c64529f736fef1a2dcfba688bf523d47f`

`main`:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5:

- open
- Draft
- unmerged

Letzter bestätigter CI-Stand:

- Scanner V16 #720 / Run `36008675991` – SUCCESS
- Battle WebRTC #196 / Run `36008675983` – SUCCESS

Vor jeder Folgearbeit tatsächlichen Remote-Head frisch prüfen.

## 3. Schritt 9A / 9B Gesamtstatus

### 9A

PASS als isoliert getesteter Branch-Kandidat:

- Least Privilege
- RLS-Schließung
- Default Privileges
- 20 privilegierte Funktionspfade
- AAL2 / aktive Session
- Owner/Admin/Moderator/Judge-Grenzen
- native PostgreSQL-17-Tests
- Browser-/Edge-Regressionen

### 9B

PASS im dokumentierten Staging-Betriebsumfang:

- Härtungsmigrationen auf Staging angewandt
- Security Readiness `compatible=true / privilege-mfa-v1`
- Legal Readiness weiterhin `compatible=true / trade-legal-contract-model-v1.2`
- echter Owner-MFA-Faktor
- echte AAL1- und AAL2-Sessions
- Owner/Admin/Moderator/Judge live abgegrenzt
- echte AAL1-RPC-Ablehnungen
- echte AAL2-fachliche Positiv-/Negativgrenzen
- echter Admin-Sessionwiderruf
- beide Invite-Namen negativ ohne Mailversand geprüft
- alte dv_core-Pfade nicht erreichbar
- COLLECT-/TRADE-/BATTLE-Smokes bestanden
- synthetische Stafffixtures sicher deaktiviert
- keine aktiven Staff-Test-Sessions

## 4. Ausdrücklich akzeptierte Session-Nachweisgrenze

Der Betreiber hat ausdrücklich akzeptiert:

Für

1. natürlichen `not_after`-Ablauf
2. fremde `session_id`-Benutzerbindung

gelten die vorhandenen nativen PostgreSQL-17-Negativtests zusammen mit den echten Live-Nachweisen für MFA, Rollenbindung und Sessionwiderruf als ausreichende Abnahme.

Es werden dafür keine JWTs, Sessionzeilen oder Auth-Claims manipuliert.

Die beiden Fälle bleiben transparent klassifiziert als:

**isoliert nachgewiesen; nicht künstlich live erzeugt.**

Dies ist keine Absenkung der fachlichen Sicherheitsanforderung, sondern eine Entscheidung gegen einen künstlichen Live-Test, der selbst eine Auth-Manipulation voraussetzen würde.

Damit ist P0-02 operativ geschlossen.

## 5. Staging-Stand

Staging:

`xhmjxrcskfhbovhitdej`

Angewandte Security-Migrationen:

- `20260924113112 / auth_privileged_step_up_v1`
- `20260924113132 / security_privilege_mfa_hardening_v1`
- `20260924113153 / security_readiness_v1`

Nicht erneut anwenden.

Weiterhin:

- Stripe Sandbox OFF
- Stripe Live OFF
- keine echten Zahlungen
- keine echten Compliance-E-Mails
- 7A/7B-Evidenz erhalten
- synthetische Staffkonten nicht operativ privilegiert
- Staffsessions 0

## 6. Production

Production:

`enifiaqsnqtbzylnfrpi`

Unverändert.

Kein Security-Kandidat auf Production angewandt.

Keine Production-Migration.

Kein Production-Deploy.

Kein Merge.

P0-02 ist nur auf dem getesteten Branch/Staging geschlossen und muss später Bestandteil des vollständigen Production-Upgrade-Manifests sein.

## 7. Noch offene P0 aus V51

Nach Abschluss von P0-02 bleiben insbesondere:

### P0-01

Vollständige sources-/abhängigkeitsgebundene Production-Migrationskette und isoliertes Rehearsal fehlen.

### P0-03

Aktuelles vollständiges Backup-/Restore-/Recovery-Rehearsal für DB/Auth/Storage fehlt.

Der vorhandene neue Staging-pg_dump ist wertvolle Evidenz, aber:

- kein vollständiger Restore durchgeführt
- Storage-Dateibytes nicht Bestandteil
- Production aktueller Restorebeleg fehlt

### P0-04

Production Environment-/Key-/Auth-Redirect-Projektbindung noch nicht vollständig attestiert.

### P0-05

Vollständige serverseitige TRADE-Notfallsperre inklusive Fixed-Price/service_role-Pfaden noch nicht als Production-Kandidat abgenommen.

P1/P2 aus V51 bleiben ebenfalls offen.

## 8. Nächster EINZIGER Arbeitsschritt

**Schritt 9C – P0-03 schließen: Backup-, Restore- und Recovery-Rehearsal in isolierter Umgebung.**

Begründung:

Vor einem Production-Migrationsrehearsal (P0-01) muss verifiziert sein, dass der aktuelle Zustand vollständig sicherbar und technisch wiederherstellbar ist.

Schritt 9C darf ausschließlich Recovery-Fähigkeit nachweisen.

Noch keine Production-Migration.

### Ziel 9C

Ein aktuelles, nachvollziehbares Backup-/Restore-Konzept für:

- Production DB
- Production Auth
- Production Storage
- Staging DB
- Staging Auth
- relevante Storage-Originale
- Rollen/ACLs
- Migration History
- notwendige Environment-/Provider-Konfiguration als Inventar

und mindestens einen **isolierten Restore-Rehearsal** durchführen.

### Grundregeln

- Production während Backup-/Inventarisierung read-only
- Restore ausschließlich in isolierte, dafür vorgesehene Umgebung
- niemals über laufendes Production/Staging restaurieren
- keine Echtdaten in öffentlich zugängliche CI-Artefakte schreiben
- personenbezogene/vertragsbezogene Daten nicht unnötig exportieren
- sensitive Dumps nicht in Git committen
- Storage-Dateien sicher behandeln
- Restore-Ziel nach Test wieder kontrolliert entfernen, sofern kein anderer Zweck besteht
- Restore-Nachweise und Checksums dokumentieren

### Mindestens prüfen

Nach Restore:

- PostgreSQL-Version / Extensions
- Migration History
- Auth-Benutzer-/Identity-Zählkonsistenz
- Profile
- FK-/Constraint-Integrität
- RLS/Policies
- Funktionen
- ACL/Default Privileges
- Security-/Legal-Readiness soweit Zielstack dies unterstützt
- Storage-Bucket-/Objektinventar
- stichprobenartige Objektintegrität per Hash, ohne private Inhalte im Bericht
- bekannte Marketplace-/COLLECT-/BATTLE-Kernzähler
- Restorezeit und dokumentierte Reihenfolge
- Rollen-/Passwort-/Secrets-Grenzen
- welche Providerdaten nicht aus DB-Backup rekonstruierbar sind

### Production

Keine Mutation.

Keine Schemaänderung.

Keine Migration.

Keine Wiederherstellung auf Production.

## 9. Staging Test Authority Mode

Für eine ausdrücklich isolierte Restore-Testumgebung dürfen technische Fixtures und Prüfwerkzeuge verwendet werden.

Keine künstliche Behauptung eines erfolgreichen Production-Restores, wenn nur ein Staging-/Clone-Rehearsal stattgefunden hat.

Kleine Backup-/Restore-Testprobleme im selben Work-Block lösen.

Kein Zwischen-Masterhandout wegen Mini-Blockern.

## 10. HARD STOP 9C

Nur bei:

- Gefahr einer Wiederherstellung auf laufendem Production/Staging
- unklarer Zielumgebung
- Export von Secrets/Passwortmaterial in unsichere Artefakte
- unbekannter Datenkorruption
- erforderlicher irreversibler Production-Mutation
- Kostenpflicht für neue Cloud-Ressource ohne vorherige Bestätigung

## 11. Abschluss Schritt 9C

Erstelle bei Abschluss:

`DUELVANTA_RECOVERY_SCHRITT9C_BACKUP_RESTORE_REHEARSAL_2026-09-24.md`

und danach:

`DUELVANTA_MASTERHANDOUT_V56_2026-09-24.md`

V56 muss tatsächlichen PASS/BLOCKIERT-Stand und den nächsten einzigen Arbeitsschritt festlegen.

Danach STOP.

Kein P0-01 automatisch beginnen.

## 12. Unveränderte Verbote

- kein Merge
- keine main-Änderung
- keine Production-Migration
- kein Production-Deployment
- kein Stripe Live
- keine echte Zahlung
- keine Refunds/Payouts
- keine echte E-Mail
- keine Domainumschaltung
- keine neue Rechts-/Steuerentscheidung
- kein TinyFish

**Schritt 9B ist abgeschlossen. Nächster Block ausschließlich Schritt 9C.**
