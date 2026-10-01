# DUELVANTA – Schritt 9B: Staging MFA Acceptance

24.09.2026. **V54-Abschluss: echte Owner/Admin/Moderator/Judge-AAL1/AAL2-Abnahme, echter Sessionwiderruf und Geschäftssmokes PASS. Streng vollständige Live-Abnahme weiterhin BLOCKIERT: Sessionablauf und fremde Session-ID-Bindung nur isoliert geprüft. Keine Production-Freigabe.**

Die folgenden ursprünglichen Abschnitte dokumentieren den V53-Zwischenstand. Für den aktuellen Zustand hat der Abschnitt „V54 – Fortsetzung und Abschluss“ am Ende Vorrang; insbesondere sind Staffzugänge und direkte RPC-Nachweise inzwischen vorhanden.

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


## V54 – Fortsetzung und Abschluss

Verbindlich vollständig gelesen: V53, dieser Bericht und database/security-privilege-mfa-matrix-v1.md sowie die ausdrücklich erteilte Staff-MFA-Autorisierung. Fortsetzungsbasis `db706f405fa49b943df0d1c1e24a0077a35e2022`; technischer Abschluss `a40e4b7d03cd9877b80b7b751ae12a4f31d3c3df`. main unverändert `50f88213571be13255bb52eb489cc28cca660001`, PR5 frisch open/Draft/unmerged bestätigt. Abschlusshead ist der Commit mit diesem aktualisierten Bericht, V54 und den neuen Evidenzdateien; konkrete SHA/Abschluss-CI im Chatabschluss. Keine selbstreferenzielle SHA.

### Minimale Branch-Ergänzung und CI

Versionierte Preview-Prüfoberfläche security-live-acceptance.html/.js verwendet den bestehenden zentralen Runtime-Resolver, reguläre Supabase-Browsersitzung und eine feste Liste von 19 Prüfungen. Keine freie RPC-/SQL-Eingabe. Keine Token-/Seed-Ausgabe. NULL-Ziele für zwei privilegierte Mutationspfade brechen nach Autorisierung vor der Geschäftsänderung ab; Invite-Aufrufe enthalten ausschließlich eine leere E-Mail. Production-Routing wird nicht freigeschaltet.

Commit14f11b0933b65d925f5928090c1d277b491b3d34 ergänzte Oberfläche und isolierte Tests. CI718/194 erkannte eine doppelte hartcodierte Staging-URL. Commita40e4b7 korrigierte die Oberfläche auf die bestehende zentrale Routingarchitektur. Kein Test oder Readiness-Fingerprint wurde gelockert. Scanner719 Run35998601938 und Battle195 Run35998601930 SUCCESS; nativer PostgreSQL17-Job107629425333 SUCCESS, inklusive bestehender Rollen-/ACL-/RLS-/Defaults-/Session-/Geschäftsregressionen. Finale Dokumentations-CI wird zusätzlich kontrolliert.

READY Preview der Liveprüfungen: dpl_7NmLkn9bSG7cook46KrXhFM5yoHw, https://duelvantav5vision-mew9qr0vy-bennyescaped-3783.vercel.app. Anonymer Erstlauf noch auf erstem Oberflächenhead; authentifizierte Staff-/Owner-Nachweise auf korrigiertem technischen Head.

### Echte Staffidentitäten und MFA

Der Benutzer hat alle drei Authkonten regulär angelegt, persönlich angemeldet und ihre TOTP-Faktoren über den Produktpfad verifiziert. Jeder AAL2-Nachweis wurde read-only gegen Session-AAL, aktive Session, zugehörige Benutzer-ID und denselben verifizierten Faktor geprüft. Kein künstlicher Faktor, kein manipuliertes JWT und keine künstliche auth.sessions-Zeile.

| Rolle im Test | Synthetische E-Mail | Benutzer-ID |
|---|---|---|
|Admin|dv-step9b-admin-20260924@invalid.example|5c3d1d09-6fd3-4cb8-a091-a24023bbc5d8|
|Moderator|dv-step9b-moderator-20260924@invalid.example|4e4d60fb-cc94-4104-a50b-75e57ad892e4|
|Judge|dv-step9b-judge-20260924@invalid.example|2b46a3c4-6bc7-428c-a65f-f87b395b3677|

Gezieltes Fixture-Setup: Waitlist12/13/14, source synthetic-step9b-staff-authorized-20260924, consent=false, invited_at=NULL, keine Founderrechte. Rollen active und jeweils ausschließlich battle_moderate für den erlaubten Staffpfad. Audit step9b_synthetic_staff_provisioned mit actor_id=NULL und expliziter administrativer Fixture-Herkunft; kein behaupteter menschlicher Owneraufruf.

### Live-Ergebnismatrix

| Prüfung | Ergebnis / Beweisgrenze |
|---|---|
|Owner, Admin, Moderator, Judge unter echter AAL1|Jeweils sieben direkte privilegierte RPCs HTTP403/42501 mfa_step_up_required; beide Invites403 owner_mfa_session_required|
|Owner unter echter AAL2|owner=true/privileged=true; Scanner, Disputes, Notices, Seller Reviews und Delivery Reviews jeweils200|
|Owner NULL-Mutationsziele|review_staff_application: Application unavailable; join_battle_as_moderator: Match not found. Autorisierung bestanden, keine Geschäftsänderung|
|Admin/Moderator/Judge unter echter AAL2|privileged=true/owner=false; Disputes200, joinNULL: Match not found; Ownerfunktionen verweigert. review_staff_application bleibt Owner approval required during beta|
|Beide Invite-Namen unter Owner-AAL2|Je400 invalid_email mit leerer E-Mail. Guard passiert, Versand nicht erreicht|
|Beide Invite-Namen unter Staff-AAL2|Je403 owner_mfa_session_required|
|Echter Admin-Sessionwiderruf|Zweite reguläre Admin-Anmeldung auf anderem Preview-Origin; reguläres globales SDK-signOut entfernte beide Sessions. Ursprünglicher unveränderter Browserclient verweigert danach sieben RPCs mit403/42501 privileged_session_required. Kein Token ausgelesen oder injiziert|
|Dashboard-Ban-Versuch|Temporäres24h-Ban entfernte die Session nicht. Unmittelbar regulär aufgehoben; nicht als Widerrufs-PASS gewertet. Danach obiger echter globaler Logout|
|Alte dv_core-Namen|Zwei direkte Namen liefern404/PGRST202: nicht vorhandene API, kein erreichbarer Bypass. Bestehende übrige Varianten und Servicegrenzen über Sollvergleich/native Tests geprüft|
|Private/Auth-Schemaaufrufe|HEAD406 ohne Fehlerbody; belegt fehlende API-Erreichbarkeit, allein kein RLS-Verhaltenstest|
|RLS/ACL/Default Privileges|Live-Sollvergleich kompatibel; native Negativtests einschließlich TRUNCATE, Sequenzmutation und RLS bei absichtlichem Fehlgrant PASS. Kein destruktiver TRUNCATE-/MAINTAIN-Versuch gegen Stagingdaten|

Die echten Staffkonten beweisen fremde Rollenabgrenzung gegenüber dem Owner. Das ist ausdrücklich **kein** Test eines JWT mit fremder session_id. Der echte Widerruf beweist fehlende Session; er ist ausdrücklich **kein** Test eines natürlichen Ablaufs von not_after/JWT.

### Normale Geschäftssmokes

Mit der ausdrücklich autorisierten synthetischen Judge-Fixture, nicht mit erfundenen persönlichen Angaben des Betreibers:

- COLLECT: normaler Browser-INSERT eines zweitseitigen Binders SYNTHETIC STEP9B 20260924; Reload zeigt persistierten Binder. ID89b8eea0-dafe-44ea-aae6-8d9e66d40ea7.
- TRADE: normale Berechtigungsmaske mit synthetischem Geburtsdatum1990-01-01/DE gespeichert; optionale private Käufererklärung blieb false. Markt- und Bestellansicht laden, null eigene/fremde Bestellungen sichtbar. Kein neuer Kauf-/Vertragsabschluss; vollständige Rechts-/Paymentabläufe weiterhin frühere7A/7B plus native Regressionen.
- BATTLE: synthetische18+-/Arena-Fixture über normale UI; Judge Desk lädt. Privates Casual-Match257accd3-7e7e-4253-9876-887731a910ff erstellt und normal verlassen; DBstatus cancelled, guest_idNULL. Keine Kamera/Übertragung aktiviert; kein neues Mehrgeräte-WebRTC-E2E behauptet.

Evidenz: live-business-smokes.json sowie live-collect-binder.png, live-trade-orders.png, live-battle-private.png. Binder, abgebrochenes Match und synthetische Eligibility bleiben als markierte Stagingdaten erhalten und sind von Geschäftsauswertungen auszuschließen.

### Sicherer Endzustand

Alle drei synthetischen Staffkonten regulär abgemeldet; Sessions jeweils0. Anschließend gezielt role=player/account_status=suspended, Staffpermissions jeweils0. Je1 echter verifizierter MFA-Faktor bleibt unverändert erhalten. Audit step9b_synthetic_staff_deactivated dokumentiert vorherige Rolle/Status und administrative Herkunft. Keine immutable Evidenz gelöscht. Betreiberbindung und Ownerzugang unverändert; dessen echte AAL2-Sitzungen bleiben verfügbar.

Frische read-only Abschlussabfrage24.09.2026 13:47:59UTC: History53, ausschließlich die ursprünglichen drei9B-Migrationen an der Spitze. Security privilege-mfa-v1 compatible=true; Legal trade-legal-contract-model-v1.2 compatible=true. Kernzähler16/4/10/8/10/1/3/3, beide7A/7B-SHA256 unverändert und korrekt. Outbox12pending/0Versuche/0Fehler/0gesendet. Stripe sandbox_enabled=false/live_mode=false. Vollständige maschinenlesbare Zusammenfassung: live-final-state-v54.json.

### Verbleibende harte Nachweisgrenze und Status

**Operativ getestete Rollen-/MFA-/Widerrufs-/Geschäftssmokes PASS. Gesamte wörtlich geforderte Live-Abnahme BLOCKIERT, P0-02 noch nicht vollständig geschlossen.**

Es fehlt der echte Live-Negativnachweis für (a) natürlich abgelaufene Session und (b) fremde Session-ID-Zuordnung. Beide Fälle sind im nativen PG17 isoliert bestanden; Code prüft die Benutzerbindung und not_after. Eine regulär ausgestellte Sitzung kann nicht absichtlich einem fremden Benutzer zugeordnet werden, ohne die ausdrücklich verbotene Session-/JWT-Manipulation oder einen gesonderten Testmechanismus. Solche Manipulationen wurden nicht durchgeführt. Kein globales Sessionlimit geändert, keine Auth-Sicherheitsgrenze gelockert und keine SQL-Claim-Simulation als Livebeweis ausgegeben. Ein Ablaufbeweis benötigt einen vorher definierten natürlichen Ablauf und einen regulären Client ohne vorherigen Refresh; dieser Beobachtungsaufbau wurde nicht abgeschlossen.

Die Grenze liegt im noch nicht sicher vereinbarten echten Nachweisverfahren, nicht in einem beobachteten Sicherheitsbypass. Kein pauschales PASS und kein automatischer Übergang zu9C. V54 definiert ausschließlich die Auflösung dieser verbliebenen9B-Nachweisgrenze. Alle übrigen V51-Blocker bleiben bestehen.

### Nicht ausgeführt

Keine erneute/zusätzliche Staging-Migration in dieser Fortsetzung, keine Production-Abfrage mit Mutation, keine Production-SQL/Migration/Deployment, kein Merge/main-Eingriff, keine Sandbox-/Stripe-Live-Aktivierung, keine Zahlung/Refund/Payout, keine echte E-Mail/Einladung, keine Domain-/Environment-Änderung, keine neue Rechts-/Steuerentscheidung, kein TinyFish. V54 wird erst nach Abschluss dieser Nachweise und sicherer Fixture-Rückführung erstellt. Danach STOP.
