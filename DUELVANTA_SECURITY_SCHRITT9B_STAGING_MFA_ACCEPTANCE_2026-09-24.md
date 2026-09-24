# DUELVANTA – Schritt 9B: Staging MFA Acceptance

24.09.2026. **Staging-Kandidat angewandt; Schemaabnahme und echter Owner-AAL2-Zugang PASS. Vollständige geforderte Live-Abnahme noch BLOCKIERT/offen. Keine Production-Freigabe.**

## Repository und verbindlicher Ausgangspunkt

V52, Schritt9A-Bericht und Sollmatrix wurden vollständig gelesen; V51/Preflight bleiben für übrige Blocker maßgeblich. Ausschließlich Bennyescaped/duelvanta / marketplace-ux-v1. Ausgangshead `3d03ed6351e29d661b4eb66e8e6e46dfab751a33`. Technischer 9B-Kandidat `53365b10105bb37de3a78e23dcc4642b544ffd25`. Dokumentationsabschluss ist der Commit, der diesen Bericht und V53 hinzufügt; dessen SHA und CI-Ergebnis stehen im Chatabschluss. Keine selbstreferenzielle erfundene Commit-ID.

main frisch bestätigt unverändert `50f88213571be13255bb52eb489cc28cca660001`; PR5 offen, Draft, unmerged. Arbeitskopie duelvanta-step9a weiterverwendet; andere Arbeitskopien unverändert. Kein Reset, Branchwechsel oder Force-Push.

Staging: `xhmjxrcskfhbovhitdej`. Production: `enifiaqsnqtbzylnfrpi`, in diesem Block nicht verändert.

## Echter Betreiberzugang und Recovery

Der echte Betreiber fehlte zunächst auf Staging. Benutzer autorisierte ausdrücklich Erstellung von info@duelvanta.de und gezielte Ownerrechte. Supabase-Dashboard-Anmeldung, CAPTCHA, Accountpasswort und TOTP wurden persönlich durch den Benutzer bedient. Es wurden keine Passwörter, TOTP-Seeds, JWTs oder Sessiontokens ausgelesen.

Die erste Accountanlage scheiterte am vorhandenen Beta-Waitlist-Trigger. Gezielte autorisierte Datenkorrektur: Waitlist für diesen Betreiber auf invited, consent=false, invited_at=NULL, Quelle operator-staging-step9b-user-authorized-20260924. Automatisch vergebene Founder-Felder wurden innerhalb derselben Transaktion entfernt. Keine Einladung/E-Mail, keine erfundene Einwilligung. Anschließende Benutzeranlage mit Auto-confirm ohne Bestätigungsmail erfolgreich.

Echte Betreiber-ID: `d222ffad-234c-41fa-a688-ade146edfd71`. Bestätigte E-Mail, Profile owner/beta; nach Anwendung der sicheren Bindung gezielt owner/active gesetzt, damit bestehende active-only Scannerrechte funktionieren. Kein anderer Benutzer erhielt neue Rechte.

Ein verifizierter Faktor und passende gültige AAL2-Session wurden vor jeder der drei Migrationen read-only serverseitig nachgewiesen. Nach regulärem Logout null Betreiber-Sessions. Erneuter echter Passwortlogin: genau eine AAL1-Session; CONTROL leitete zur 2FA-Bestätigung. Nach erneuter persönlicher TOTP-Bestätigung wieder eine passende gültige AAL2-Session.

Recovery: Benutzer bestätigt unabhängig bereits angemeldetes Apple-Gerät mit iCloud-Zugangsdaten; authentifizierter Supabase-Projektzugang wurde tatsächlich verwendet. Zusätzliche Papierablage im Tresor vom Benutzer angekündigt, nicht unabhängig verifiziert. Kein Faktorverlust-/Recovery-Reset live durchgeführt; keine automatisierten Recoverycodes erfunden. Menschlicher MFA-Zugang wird niemals durch Service-Key ersetzt.

## Notwendige Kandidatenkorrektur und isolierte Prüfung

Drei historische Ownerfunktionen enthielten eine feste UUID aus dem anderen Projekt. Die echte Staging-Betreiber-ID war deshalb trotz owner-Profil nicht kanonischer Owner. Kein Kopieren/Fälschen der Auth-ID.

Minimaler Fix im ersten vorgesehenen SQL-Kandidaten: private singleton-Bindung dv_v16_private.operator_identity_v1, einmal aus bestätigtem Betreiberprofil initialisiert; keine automatische Neubindung bei E-Mail-Übertragung. RLS ohne Browserpolicy und ohne Browser-/Servicetabellenrechte. FK schützt die gebundene Auth-Identität; Ownerprofil-/Löschschutz bezieht sich auf die Bindung. Session-/AAL2-Guard bleibt separat wirksam.

Native Tests verwenden absichtlich eine andere synthetische UUID. Negativtests umfassen leere Bindung, historische UUID, unbestätigte/geänderte E-Mail, E-Mail-Übertragung und erneute Anwendung, Owner-Schutz und verbotenen Browser-/Servicezugriff. Readiness ausschließlich offline aus bewusst geändertem Soll erzeugt; kein Live-Fingerprint zur Testumgehung übernommen.

CI auf technischem Head: Scanner715 Run35985062999 SUCCESS; Battle191 Run35985063240 SUCCESS. Native PostgreSQL17.11 Job107585688475, 30 Prüfgruppen PASS, Artefakt10801334230. Digest `885d948461bddd1210e91f8fc20838f3f4dcf9a812aad699687a7e593bf05d44`. Ergebnis und Ausgabe in evidence/security-step9b-20260924. Diese isolierten Rollen-/AAL-/Session-/Geschäftspfadprüfungen bleiben als solche gekennzeichnet; sie sind keine echten MFA-Sessions zusätzlicher Staffpersonen.

## Backup vor Anwendung

Staging Free-Plan hatte keinen verwalteten Backup-Wiederherstellungspunkt. Benutzer setzte sein Staging-DB-Passwort nach Abhängigkeitsprüfung selbst neu; der Wert blieb bei ihm. Direkter read-only Verbindungstest vom Mac über Session-Pooler erfolgreich, Server17.6, Client17.11.

Frischer vollständiger Custom-pg_dump am 24.09.2026 13:15:52 CEST, ca.3,1MB, auf Benutzer-Mac. Vollständiges Offline-Dekodieren mit pg_restore --file=/dev/null erfolgreich, keine Wiederherstellung. TOC:2107 Einträge laut Header, Auth/MFA, Anwendungsdaten, Migration History, RLS/Policies und ACLs enthalten. Hochgeladenes TOC geprüft und komprimiert gesichert. Ein TOC belegt keine einzelnen Zeilen oder Vertrags-Hashes.

Separater pg_dumpall --roles-only --no-role-passwords:16 Rollen,21 Mitgliedschaften, keine Passwortklauseln. Dateiinhalt geprüft; SHA256 `75f70ca11af01fd3d4d5f375c83ca8fd3e9e07b282c4f63fe4321d2aa3a7ecf7` stimmt mit Terminalnachweis überein. Kein Restore dieser SQL auf Live ausgeführt.

Grenzen: kein Restore-Rehearsal; Storage-Dateibytes, Provider-Secrets und externe Konfiguration sind kein Bestandteil dieser logischen Datenbanksicherung. Der sensible Hauptdump verbleibt beim Betreiber und wurde nicht in Git/CI veröffentlicht. Vor einer Wiederherstellung müssen Supabase-managed Rollen/Extensions/Services berücksichtigt werden; kein blindes Komplett-Restore-Rezept. Dieser Backupstatus ist keine vollständige Plattform-Disaster-Recovery-Abnahme.

## Tatsächliche Anwendung und Migration History

Vor SQL wurden beide Invite-Namen als gemeinsame Sicherheitsgrenze geschützt. owner-invite-beta-user wurde von der ausgelesenen alten is_owner-only-Implementierung auf den versionierten get_my_privileged_access_v1-Guard aktualisiert. Historischer Alias invite-beta-user wurde mit Import derselben Implementierung bereitgestellt. Fehlendes Guard-RPC vor SQL führte geschlossen zur Ablehnung. Kein Einladungsvorgang aufgerufen.

| Staging Edge | Version | JWT-Prüfung |
|---|---:|---|
| owner-invite-beta-user |5|true|
| invite-beta-user |1|true|

Danach ausschließlich die drei vorgesehenen SQL-Dateien, exakt vom geprüften technischen Head:

| Version | Name | Datei |
|---|---|---|
|20260924113112|auth_privileged_step_up_v1|database/auth-privileged-step-up-v1.sql|
|20260924113132|security_privilege_mfa_hardening_v1|database/security-privilege-mfa-hardening-v1.sql|
|20260924113153|security_readiness_v1|database/security-readiness-v1.sql|

Alle Anwendungen erfolgreich. History vorher50, danach53 Migrationen. Quellenhashes und Edge-Bundlehashes: live-staging-state.json. Keine vierte Reparaturmigration.

## Nachweise und verbleibende Grenzen

| Prüfung | Tatsächliches Ergebnis |
|---|---|
|Security Readiness|Live compatible=true / privilege-mfa-v1|
|Legal Readiness|Live compatible=true / trade-legal-contract-model-v1.2|
|Drei RLS-Lücken|Live alle aktiviert: market_pickup_handovers, trade_user_eligibility, market_notification_sync_state|
|Gefährliche Tabellenrechte|Live null TRUNCATE/MAINTAIN/TRIGGER/REFERENCES für anon/authenticated/service_role in den sechs Anwendungsschemas|
|Default Privileges, private Grenzen, Function-/Policy-Soll|Live Readiness-Sollvergleich PASS; isolierte Verhaltens-Negativtests PASS|
|Echter Owner AAL2|Live verifizierter Faktor/Session; Control zeigt6Mitglieder; Scanner-RPC dv_v16_owner_openai_scan_settings liefert über normale KI-Scanner-UI „Einstellungen aktuell“|
|Echter Owner AAL1|Server aal1 bestätigt; Control führt zur MFA-Eingabe. Direkte RPC-Ablehnung mit dieser echten Session noch nicht separat live nachgewiesen|
|Widerruf|Reguläres App-Logout entfernt echte Auth-Session; kein Replay eines zuvor gültigen Requests ausgeführt|
|Fremde/abgelaufene Session, Admin/Moderator/Judge|Isolierte native Negativtests PASS; entsprechende echte Live-Sessionabnahme fehlt|
|Alte RPC-/dv_core-/Service-Bypässe|Versionierter Live-Sollvergleich plus native Tests; kein vollständiger echter Browser-Replay aller Alternativpfade|
|Invite-Sicherheitsgrenze|Beide Namen guarded/JWT aktiv; isolierte Handlerfälle PASS; Live-AAL1/AAL2-Negativaufrufe ohne Mail noch offen|
|COLLECT|Echtes Ownerkonto lädt leere Collection; kein neuer vollständiger Live-Schreibablauf|
|TRADE|Neuer Owner erreicht reguläre persönliche Alters-/Wohnsitzabfrage; keine erfundenen Erklärungen; isolierte Geschäftsabläufe PASS|
|BATTLE|Neuer Owner erreicht reguläre Alters-/Arena-/Safety-Einwilligung; keine Einwilligung stellvertretend erfunden; native/CI-Regression PASS|

Damit **kein vollständiges Schritt9B-Live-PASS**. Fehlende echte Staff-MFA-Zugänge sind keine Berechtigung, künstliche Faktoren oder Sessions anzulegen. Bestehende Schutzmechanismen bleiben aktiv. Der verbleibende direkte Session-/RPC-Nachweis muss im selben Sicherheitsumfang ergänzt werden; UI-Weiterleitung allein ersetzt ihn nicht.

## 7A/7B und OFF-Zustand

Vorher/nachher unverändert:16 Listings,4 Offers,10 Deals,8 Orders,10 Contract Snapshots,1 Withdrawal,3 Payment Attempts,3 Allocations. Outbox12 pending, max attempts0, errors0. Stripe sandbox_enabled=false, live_mode=false. Keine Zahlung, kein Refund/Payout, keine Sandboxaktivierung und keine echte E-Mail ausgelöst.

7A Snapshot `801ae92b-9569-4178-a1c2-2ece5165d6a3`, SHA256 `f736fd45f67cba0411580fe65976daa7ccc185abbf69b52cea29114f43bf3091`.

7B Snapshot `a4642a8f-3167-42c1-953b-eb3e9234b611`, SHA256 `dfbc9dd2fc3c3d5677e62a23d29637e038522491e3b5f419c81fdaf9196469d7`.

Beide Hashes frisch aus confirmation_text geprüft und unverändert. Keine Fixture gelöscht/bereinigt. Keine neuen Bestellungen zur Security-Abnahme angelegt.

## Abschlussgrenze

Keine Production-Mutation/-Migration/-Deployment, kein Merge/main-Eingriff, kein Stripe Live, keine echte Zahlung/E-Mail, keine Domainumschaltung, keine neue Rechts-/Steuerentscheidung, kein TinyFish. P0-02 ist auf Staging technisch angewandt, aber insgesamt noch nicht operativ geschlossen. Production bleibt NO-GO. V53 legt ausschließlich die Vervollständigung der offenen Schritt9B-Live-Abnahme fest, nicht9C.
