# DUELVANTA – Masterhandout V11

Stand: 15.09.2026, nach vollständigem Abschluss von B06 – Produktions-Auth-/Berechtigungsprüfung und vorbereiteter Auth-Härtung. Dieses Dokument ist der verbindliche Übergabestand und ersetzt widersprechende ältere Angaben. V10 bleibt Detailreferenz für B05; V9 und ältere Handouts bleiben Detailreferenzen für B01–B04, soweit V11 nichts aktualisiert.

## 1. Verbindlicher Repository- und Release-Stand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- V10-/B05-Ausgangs-Head: `a56cc204e8fa920c2be95c40ac6437ca31e9eb7e`
- B06 technischer Abschluss-Head vor Erstellung dieses Handouts: `bed6d3adaf011137a0fe549b7198c1b316cd4c92`
- `main`: `50f88213571be13255bb52eb489cc28cca660001`, unverändert
- PR #5: **open, Draft, nicht gemergt**
- PR #5 Base: `main`
- B01–B05: geschlossen und in B06 nicht erneut bearbeitet, außer wo ein neuer konkreter B06-Befund unmittelbar an bestehende Auth-/Runtime-Grenzen angrenzte.
- B04 Ruleset `Protect main`, ID `23447544`: unverändert aktiv.
- Produktions-Supabase: `enifiaqsnqtbzylnfrpi`
- Staging-Supabase: `xhmjxrcskfhbovhitdej`
- B06 finaler technischer CI-Lauf: Scanner V16 Check **#266 / Run-ID `34980272602` = success**
- `validate`: success
- `quota_database`: success

Produktion, produktives Supabase-Schema/Auth-Konfiguration, Stripe, Vercel-Produktion, Domains und `main` wurden in B06 **nicht verändert**. Es gab keinen Merge und keine produktive Migration.

## 2. B06 – GESCHLOSSEN: Produktions-Auth-/Berechtigungsprüfung

B06 ist als Audit-, Code- und Härtungsvorbereitungsblock vollständig geschlossen.

Wichtig: „B06 geschlossen“ bedeutet **nicht**, dass die vorbereitete MFA-/AAL2-Datenbankhärtung bereits auf Produktion angewendet wurde. Die produktive Anwendung bleibt ausdrücklich Teil des späteren kontrollierten Produktions-Migrations-/Rolloutblocks. Bis dahin bleibt der nachfolgend dokumentierte Produktions-Istzustand bestehen.

B06 umfasste:

- read-only Prüfung des realen Produktions-Authzustands;
- Prüfung privilegierter `SECURITY DEFINER`-RPCs und ihrer ACL-/RLS-Grenzen;
- MFA-/Step-up-Konzept für privilegierte Rollen;
- Session-/Revocation-Grenzen;
- Password-Recovery-Verhalten;
- Supabase Security Advisors und begründete Ausnahmen;
- Preview-/Produktionsisolation des Owner-Control-Centers;
- review-only Datenbankhärtung und isolierte Regressionstests;
- CI- und Preview-Auslieferungsnachweis ohne echten Auth-, MFA- oder Produktionsvorgang.

## 3. Produktions-Auth-Baseline – read-only ermittelt

Am 15.09.2026 wurde auf dem produktiven Supabase-Projekt ausschließlich lesend bestätigt:

- 15 Auth-Nutzer insgesamt;
- 10 aktuell vorhandene/aktive Sessions;
- 10 nicht widerrufene Refresh-Tokens;
- 0 verifizierte MFA-Faktoren;
- 0 AAL2-Sessions;
- alle 10 vorhandenen aktiven Sessions sind AAL1;
- alle 10 aktiven Sessions besitzen aktuell keine serverseitige `not_after`-Grenze.

Rollenverteilung in `public.profiles`, ausschließlich aggregiert geprüft:

- 1 Owner;
- 1 Moderator;
- 13 Player.

Es wurden keine personenbezogenen Auth-Daten exportiert oder dokumentiert.

## 4. MFA / Step-up – finaler B06-Entwurf

### 4.1 Frontend

Neu:

- `mfa.html`
- `mfa.js`

Der Flow verwendet ausschließlich die offizielle Supabase-TOTP-MFA-API:

- `mfa.listFactors()`
- `mfa.getAuthenticatorAssuranceLevel()`
- `mfa.enroll()`
- `mfa.challenge()`
- `mfa.verify()`
- `mfa.unenroll()`

MFA-Verwaltung und verpflichtende Einrichtung sind gezielt auf privilegierte Rollen begrenzt:

- `owner`
- `admin`
- `moderator`
- `judge`

Normale Player-/Käuferflüsse werden nicht pauschal auf AAL2 gezwungen.

### 4.2 Owner-Control-Center

Neuer vorgeschalteter Sicherheitsgate:

- `control-center-auth-preflight.js`

Vor dem Laden der bisherigen Verwaltungslogik werden jetzt auf dem Entwicklungsbranch geprüft:

1. gültige DUELVANTA-Runtime-Konfiguration;
2. authentifizierte Session;
3. eigene Profilrolle `owner`;
4. `aal2`.

Erst danach werden `control-center.js`, `control-center-permissions.js` und `session-guard.js` geladen.

Ein während B06 gefundener konkreter Grenzfehler wurde damit behoben: `control-center.js` enthielt einen hart codierten Produktions-Supabase-Client. In einer Preview hätte die Legacy-Verwaltungslogik dadurch mit Produktion verbunden werden können. Der neue Preflight fängt den Legacy-Client ab und verwendet ausschließlich die validierte Runtime-Konfiguration. Preview bleibt damit Staging-only und fail-closed.

Die bestehende Control-Center-Oberfläche wurde nicht redesigned.

### 4.3 PROFILE

`profile-data-rights.js` wurde gezielt erweitert:

- MFA-Verwaltung wird nur privilegierten Rollen angeboten;
- wenn ein privilegierter Account bereits einen AAL2-fähigen Faktor besitzt, verlangt eine Passwortänderung zuerst den zweiten Faktor;
- bestehende Datenexport-/Kontolöschpfade bleiben unverändert.

`profile.html` lädt die geänderte Ressource mit `profile-data-rights.js?v=2`, damit keine alte Sicherheitslogik aus Browsercaches weiterverwendet wird.

## 5. Privilegierte Datenbankgrenze – REVIEW ONLY

Neue Datei:

`database/auth-privileged-step-up-v1.sql`

Diese Datei wurde **nicht auf Staging und nicht auf Produktion angewendet**. Sie wurde ausschließlich isoliert in PGlite getestet.

### 5.1 Zentraler Gate

`public.require_duelvanta_privileged_session()` verlangt für privilegierte Browser-/User-Aktionen:

- authentifizierten Benutzer;
- JWT Assurance Level `aal2`;
- gültige `session_id` im JWT;
- dazu passende, noch vorhandene Zeile in `auth.sessions` für denselben Benutzer.

Dadurch wird bei diesen kritischen Aktionen ein bereits serverseitig entfernter/revozierter Session-Datensatz sofort wirksam, statt ausschließlich auf den natürlichen Ablauf eines bereits ausgestellten Access-Tokens zu vertrauen.

`service_role` bleibt als explizit vertrauenswürdiger Backendpfad zugelassen.

### 5.2 Geschützte privilegierte RPCs

Die bestehende Fachlogik wird nicht dupliziert. Die vorhandenen Funktionen werden als private Core-Funktionen gekapselt und unter ihren bisherigen öffentlichen Namen mit dem zentralen AAL2-/Session-Gate vorgeschaltet:

- `join_battle_as_moderator(uuid)`
- `leave_battle_moderation(uuid,text)`
- `moderate_battle_report(uuid,text,text)`
- `review_battle_report(uuid,text,text)`
- `review_staff_application(uuid,text,text)`
- `set_battle_moderation_pause(uuid,boolean,text)`
- `set_staff_permission(uuid,text,boolean)`
- `set_staff_role(uuid,text,text)`

Die bereits vorhandenen Rollen-/Owner-/Permission-Prüfungen dieser RPCs bleiben erhalten; AAL2 und Live-Session werden zusätzlich davor erzwungen.

### 5.3 ACL-Härtung

Ein erster isolierter Test zeigte korrekt einen PostgreSQL-ACL-Sonderfall: `REVOKE ... FROM anon` allein reicht nicht, wenn `PUBLIC` weiterhin standardmäßig `EXECUTE` besitzt. Die finale Review-Migration entzieht deshalb bei internen Helfern ausdrücklich `PUBLIC`/`anon` und vergibt benötigte Rechte anschließend explizit.

Direkter Browser-EXECUTE wird unter anderem für interne Trigger-/Hilfsfunktionen entfernt:

- `assign_founder_generation_i()`
- `guard_profile_username_direct_update()`
- `handle_duelvanta_new_user()`
- `prevent_duelvanta_owner_delete()`
- `protect_duelvanta_owner_profile()`

Für RLS-/Self-Service-Helfer bleibt `authenticated` gezielt erhalten, `anon`/`PUBLIC` wird entfernt:

- `has_staff_permission(text,uuid)`
- `is_duelvanta_admin(uuid)`
- `is_duelvanta_owner(uuid)`
- `get_my_battle_history(integer)`
- `get_my_market_deals()`

## 6. Session- und Recovery-Härtung

### 6.1 Bestehender Session-Guard

`session-guard.js` besitzt bereits clientseitige Idle-/Maximalzeiten:

- Owner: 30 Minuten Idle / 8 Stunden Maximum;
- Admin/Moderator/Judge: 30 Minuten Idle / 12 Stunden Maximum;
- Player: 60 Minuten Idle / 24 Stunden Maximum.

Diese Grenzen bleiben Defense-in-Depth, ersetzen aber keine serverseitigen Session-Limits.

### 6.2 Password Recovery

`reset-password.html` wurde gehärtet:

- ein gültiger Recovery-Flow bleibt Voraussetzung;
- Passwortlänge bleibt mindestens 10 Zeichen;
- nach erfolgreichem Passwortwechsel wird `signOut({scope:'global'})` ausgeführt;
- sämtliche Refresh-Sessions werden beendet;
- anschließend ist eine neue Anmeldung erforderlich.

Für privilegierte Aktionen ergänzt der vorbereitete DB-Gate zusätzlich die `session_id`-Prüfung gegen `auth.sessions`.

## 7. Supabase Security Advisors – Klassifizierung

### 7.1 Leaked Password Protection

Advisor-Befund:

`auth_leaked_password_protection` = deaktiviert.

Bewertung:

- echter sicherheitsrelevanter Hinweis;
- auf dem aktuell verwendeten Supabase-Free-Plan nicht aktivierbar;
- Supabase stellt Leaked Password Protection erst in einem kostenpflichtigen Plan bereit;
- deshalb **keine stillschweigende „grün“-Bewertung**;
- als begründete planbedingte Release-Ausnahme dokumentiert;
- muss gemeinsam mit B10 (kommerziell zulässiger Hosting-/Providerplan, Budget und Limits) vor kommerziellem Produktionsstart erneut entschieden und aktiviert werden, sobald der gewählte Tarif dies unterstützt.

### 7.2 Serverseitige Session Policies

Serverseitige Time-box-/Inactivity-/Single-Session-Regeln stehen im aktuellen Supabase-Free-Plan ebenfalls nicht als vollständige konfigurierbare Produktionskontrolle zur Verfügung.

Bewertung:

- bestehender Client-Session-Guard bleibt Defense-in-Depth;
- kritische privilegierte RPCs erhalten zusätzlich AAL2 + `session_id`-Validierung;
- tarifabhängige serverseitige Session Policies werden ebenfalls an B10 weitergereicht und müssen vor kommerziellem Start erneut bewertet werden.

### 7.3 RLS enabled but no policy

Die Advisor-INFO-Hinweise auf Tabellen mit aktivierter RLS, aber ohne Policy wurden gegen reale Grants geprüft. Für sämtliche betroffenen Tabellen besitzen `anon` und `authenticated` **keine direkten Tabellenrechte**.

Bewertung:

- intentional deny-all / RPC-only;
- keine offene B06-Schwachstelle;
- RLS bleibt als Defense-in-Depth aktiv.

### 7.4 Anonymous executable SECURITY DEFINER

Produktion meldete 21 `SECURITY DEFINER`-Funktionen, die durch `anon` ausführbar waren.

Davon sind 11 bewusst öffentliche Read-/Availability-RPCs:

- `get_battle_leaderboard(text,integer)`
- `get_market_seller_profile(uuid)`
- `get_public_battle_ranked_profile(text)`
- `get_public_battle_ratings(text)`
- `get_public_battle_recent(text,integer)`
- `get_public_battle_stats(text)`
- `get_public_duelvanta_collection(text)`
- `get_public_duelvanta_identity(uuid)`
- `get_public_duelvanta_profile(text)`
- `get_public_market_reviews(uuid,integer)`
- `is_username_available(text)`

Die übrigen 10 waren interne oder Self-Service-Helfer und werden durch `auth-privileged-step-up-v1.sql` ACL-seitig gehärtet.

Da die Review-Migration noch nicht produktiv angewendet wurde, bestehen diese 10 Advisor-Warnungen **im aktuellen Produktions-Istzustand weiterhin**. Ihre Remediation ist vorbereitet, getestet und muss im späteren Produktions-Migrationsmanifest enthalten sein.

## 8. Tests und CI

### 8.1 DB-Regressionsprüfung

`tests/auth-boundary-database-test.mjs` wurde erweitert.

Isoliert nachgewiesen:

- AAL1 kann privilegierte RPC-Hülle nicht passieren;
- AAL2 mit unbekannter/entfernter Session wird als `session_revoked` blockiert;
- AAL2 + vorhandene passende Session passiert den zentralen Gate;
- `anon` kann privilegierte RPCs nicht ausführen;
- `service_role` bleibt explizit zugelassen;
- unnötige `PUBLIC`-/`anon`-EXECUTE-Rechte der geprüften internen Helfer sind nach der Review-Migration entfernt;
- bestehende Battle-/Auth-Boundary-Regressionen bleiben grün.

### 8.2 Runtime-/Frontend-Contracts

`tests/supabase-runtime-config-test.mjs` prüft zusätzlich:

- MFA- und Control-Center-Seiten laden zuerst den geschützten Runtime-Endpunkt;
- Preview bleibt auf Staging beschränkt;
- MFA-Code enthält die aktuellen Supabase-TOTP-Flows;
- MFA-Einrichtung/-Verwaltung bleibt auf privilegierte Rollen begrenzt;
- Control Center verlangt AAL2 vor dem Laden der Legacy-Verwaltungslogik;
- kein direkter Produktions-URL-Fallback im neuen Control-Center-Preflight;
- Password-Recovery führt globalen Sign-out aus;
- geänderte Auth-Dateien triggern den bestehenden CI-Workflow.

### 8.3 CI-Läufe

Zwischenläufe:

- #264 / Run-ID `34979895916`: `quota_database` grün; `validate` fand den realen inherited-`PUBLIC`-EXECUTE-Fall. Danach gezielt korrigiert.
- #265 / Run-ID `34980067122`: DB-AAL2-/Session-Gate grün; `validate` scheiterte anschließend ausschließlich an einer neuen Test-Assertion, die einen String statt eines RegExp an `assert.doesNotMatch` übergab. Anwendungscode war dabei bereits grün. Test gezielt korrigiert.

Finaler technischer Lauf:

- Scanner V16 Check **#266**
- Run-ID `34980272602`
- Gesamtergebnis: **success**
- `quota_database`: success
- `validate`: success
- Auth-Boundary inkl. AAL2/Session: success
- Marketplace-/Runtime-/MFA-Contracts: success
- bestehende Scanner-, COLLECT-, TRADE-, Compliance-, Payment-, Browser- und Datenbankregressionen: success.

## 9. Preview-Auslieferungsnachweis

Fester technischer Preview-Stand für den finalen B06-Code vor V11:

- Commit: `bed6d3adaf011137a0fe549b7198c1b316cd4c92`
- Deployment-ID: `dpl_HihezWmJCKE6W1oHrmQptMywPWS7`
- Host: `duelvantav5vision-23kcu7fb4-bennyescaped-3783.vercel.app`
- Deployment: READY

Der ausgelieferte Runtime-Endpunkt wurde read-only geprüft:

- HTTP 200;
- `environment=preview`;
- Supabase-Projekt = Staging `xhmjxrcskfhbovhitdej`;
- `Cache-Control: private, no-store, max-age=0`.

Die statischen Preview-Seiten waren zusätzlich durch Vercel-SSO geschützt. Es wurde **keine Anmeldung**, kein TOTP-Enroll, kein MFA-Challenge, kein Password-Reset und kein sonstiger echter Auth-Vorgang ausgeführt. Die ausgelieferte Sicherheitslogik wurde deshalb über Repository-Quelle + vollständige CI-Contracts nachgewiesen.

## 10. Verbindlicher Rolloutstatus nach B06

Die folgenden Punkte sind **vor Produktion erforderlich**, wurden in B06 aber wegen der bestehenden No-Production-Grenze bewusst nicht ausgeführt:

1. `database/auth-privileged-step-up-v1.sql` muss im späteren B11-Produktionsbaseline-/Delta-Migrationsmanifest enthalten und dort kontrolliert angewendet werden.
2. Danach müssen alle tatsächlich privilegierten Accounts vor Verwendung privilegierter Funktionen einen TOTP-Faktor einrichten und AAL2 erreichen.
3. Nach produktiver Migration sind Security Advisors, RPC-ACLs und tatsächliche AAL2-/Session-Grenzen erneut read-only zu verifizieren.
4. Leaked Password Protection und serverseitige Session Policies müssen im Rahmen von B10 mit dem finalen kommerziellen Supabase-/Hostingtarif entschieden werden.
5. Kein produktiver privilegierter Workflow darf als MFA-geschützt behauptet werden, bevor diese Rolloutschritte tatsächlich erfolgt sind.

## 11. Harte Grenzen – weiterhin verbindlich

- Kein Merge und keine Änderung an `main`.
- PR #5 bleibt Draft.
- Keine Produktionsänderung, Domain-Promotion oder produktive Supabase-Migration.
- Keine Stripe-Sandbox- oder Live-Payments aktivieren.
- Keine Staging-Daten nach Produktion kopieren.
- Keine neuen Worker/Scheduler aktivieren.
- Kein zweiter Payment- oder Refundpfad.
- `v-logo.svg` niemals verändern oder nachbauen.
- Slogan unverändert: **COLLECT. TRADE. BATTLE.**
- B01–B06 nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.
- V5 Abschnitte 7 und 8 bleiben der verbindliche, noch nicht ausgeführte Rollout-/Rollbackplan.
- **NO-GO für Produktion und Live-Payments bleibt bestehen.**

## 12. Releaseblocker nach V11

- **B01 GESCHLOSSEN:** PROFILE-Preview-Isolation.
- **B02 GESCHLOSSEN:** Erasure-/Username-Guard.
- **B03 GESCHLOSSEN:** fail-closed Stripe-Live-Modus.
- **B04 GESCHLOSSEN:** GitHub Release-Governance / `main`-Schutz.
- **B05 GESCHLOSSEN:** Secret-, Repository- und Supply-Chain-Härtung.
- **B06 GESCHLOSSEN:** Produktions-Auth-/Berechtigungsprüfung; MFA-/Session-Härtung vorbereitet und isoliert getestet; produktive Anwendung bleibt B11/B10-abhängig.
- **B07 OFFEN:** qualifizierte rechtliche Schlussprüfung.
- **B08 OFFEN:** steuerliche Schlussprüfung; `platform_fee_tax_treatment=review_required` bleibt.
- **B09 OFFEN:** tatsächlicher Betreiber-/Gewerbestatus und finale Betreiberangaben.
- **B10 OFFEN:** kommerziell zulässiger Hosting-/Provider-Tarif, Budget, Limits sowie die hier dokumentierten Auth-Planfeatures.
- **B11 OFFEN:** Produktionsbaseline und exaktes Delta-/Checksum-Migrationsmanifest einschließlich `auth-privileged-step-up-v1.sql`; keine Staging-Vollkopie.
- **B12 OFFEN:** separate Live-Stripe-/Connect-Freigabe und spätere ausdrückliche Live-Autorisierung.
- **B13 OFFEN:** E-Mail-Domain/DNS, Scheduler, Retry/Dedupe, Zustell-/Bounce-Nachweise und Alerts.
- **B14 OFFEN:** Monitoring, Alarmempfänger, Vertretung und Incident-Runbook.
- **B15 OFFEN:** kompatibler Rückfallstand, DB-/Storage-Restoreprobe, RPO/RTO und serverseitige Schreibsperre.

F03 und F04 aus V5 bleiben unverändert relevant.

## 13. Dauerhafte Referenzen

- V10: `DUELVANTA_MASTERHANDOUT_V10_2026-09-15.md`; B05-Head `a56cc204e8fa920c2be95c40ac6437ca31e9eb7e`
- B06 technischer Abschluss-Head vor V11: `bed6d3adaf011137a0fe549b7198c1b316cd4c92`
- B06 finaler technischer CI: #266 / `34980272602`
- B06 feste Preview-Deployment-ID: `dpl_HihezWmJCKE6W1oHrmQptMywPWS7`
- B06 Review-Migration: `database/auth-privileged-step-up-v1.sql`
- `main`: `50f88213571be13255bb52eb489cc28cca660001`
- Ruleset `Protect main`: ID `23447544`
- Staging Supabase: `xhmjxrcskfhbovhitdej`
- Produktion Supabase: `enifiaqsnqtbzylnfrpi`

## 14. Übergaberegel

Der nächste Chat muss dieses Masterhandout V11 vollständig lesen und den nach Erstellung von V11 ermittelten Branch-Head verwenden. B01–B06 sind geschlossen. **B07 ist der nächste offene Block und darf erst auf ausdrücklichen neuen Arbeitsauftrag begonnen werden.**

Produktion, `main`, Merge, produktive Migrationen und Payment-Aktivierung bleiben gesperrt. Insbesondere darf aus „B06 geschlossen“ nicht abgeleitet werden, dass MFA/AAL2 bereits produktiv erzwungen wird; die produktive Aktivierung bleibt Bestandteil des späteren kontrollierten Rollouts.