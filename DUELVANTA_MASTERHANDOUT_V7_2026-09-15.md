# DUELVANTA – Masterhandout V7

Stand: 15.09.2026, Übergabe nach vollständigem Abschluss von B01 und begonnenem, noch NICHT abgeschlossenen B02-Fix. Dieses Dokument ist der verbindliche Einstieg für den nächsten Chat und ersetzt widersprechende Statusangaben älterer Handouts. V4/V5/V6 bleiben Detailreferenzen, soweit V7 sie nicht ausdrücklich aktualisiert.

## 1. Verbindlicher Repository-Stand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- Aktueller Branch-Head bei Erstellung dieses Handouts: `cdf0592b9544c0a25da064148564ac878dff2127`
- PR #5: offen, **Draft**, nicht gemergt; Head bei letzter Prüfung exakt `cdf0592b9544c0a25da064148564ac878dff2127`
- main: `50f88213571be13255bb52eb489cc28cca660001`, unverändert
- Technischer B01-Codecheckpoint: `d108eba6033ea2d94d3a06e639202260e2d69717`
- V6-B01-Abschlussdokumentation: Commit `d28d6c5777bb8120ae6fa373be419b55f49b63ea`
- B02 SQL-Fixdatei hinzugefügt: Commit `8188ccaca6ea36e03f359f7d39ff215cf2be0f5d`
- B02 Real-Trigger-Test hinzugefügt: Commit `571be2855537ff791ca5cd70cbe26db0ede2cf23`
- B02 CI-Wiring / aktueller technischer Head: `cdf0592b9544c0a25da064148564ac878dff2127`

## 2. B01 – GESCHLOSSEN

B01 / PROFILE-Preview-Isolation ist abgeschlossen. Nicht erneut bearbeiten oder die bereits erledigten Prüfungen wiederholen.

Bestätigt sind:

- `profile.html` lädt Runtime-Konfiguration vor `profile.js?v=1.2` und danach `profile-data-rights.js?v=1`.
- `profile.js` besitzt keinen festen Produktions-Supabase-Fallback, setzt einen alten `window.__dvAppDb` zunächst auf null, validiert Environment/Host/HTTPS/exakte Projekt-URL/Publishable-Key und erzeugt erst danach den Client aus `window.DV_SUPABASE`.
- lokale Runtime-/Negativtests erfolgreich, einschließlich 22 ungültiger Konfigurationen und Preview-/Produktionsgrenzen.
- GitHub Actions Scanner V16 Check Run #219 / `34955359914`: success.
- Runtime-Endpunkt des festen Preview-Deployments bestätigt `environment=preview` und Staging `xhmjxrcskfhbovhitdej`.
- Festes Preview: Deployment-ID `dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK`, Host `duelvantav5vision-33t1a6azf-bennyescaped-3783.vercel.app`, Git-SHA exakt `d108eba6033ea2d94d3a06e639202260e2d69717`.
- Mit dem bereits vorhandenen Vercel `Protection Bypass for Automation` wurde `/profile.html` passiv als Datei abgerufen. Der gespeicherte Response enthält `data-deployment-id="dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK"` und am Dokumentende exakt die relevante Reihenfolge:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/api/compliance-message-dispatch?runtime_config=1"></script>
<script src="profile.js?v=1.2"></script>
<script src="profile-data-rights.js?v=1"></script>
<script src="site-nav.js"></script>
```

Damit ist die ausgelieferte PROFILE-Ladefolge des festen technischen Artefakts nachgewiesen. Der Abruf führte keine DUELVANTA-Anwendung aus und löste keine Anmeldung, Profil-, Datenschutz-, Export-, Lösch-, Zahlungs- oder Datenbankaktion aus.

**B01 bleibt geschlossen.**

## 3. B02 / F02 – begonnen, noch OFFEN

Ausgangsfehler: `public.prepare_account_deletion_data(...)` setzt bei der Erasure-Vorbereitung `public.profiles.username=null`. Auf Staging existiert jedoch der Trigger:

```sql
CREATE TRIGGER guard_profile_username_direct_update
BEFORE UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION guard_profile_username_direct_update()
```

Die zugehörige Staging-Funktion blockiert jede Username-Änderung, solange
`current_setting('duelvanta.username_rpc', true) <> 'allowed'`.

Der bestehende geschützte Profil-RPC `public.set_my_public_profile(...)` setzt diesen Wert transaktionslokal mit `set_config(..., true)`, führt die geschützte Änderung aus und setzt ihn anschließend zurück. Der ursprüngliche Erasure-RPC in `database/account-data-rights-v1.sql` tat dies nicht. Dadurch kollidiert der Löschpfad mit dem globalen Username-Schutz.

Wichtig: Der globale Username-Trigger darf NICHT entfernt, gelockert oder browserseitig umgehbar gemacht werden.

## 4. Bereits implementierter B02-Fix

Neue Datei:

`database/account-data-erasure-username-guard-v1.sql`

Sie ersetzt ausschließlich `public.prepare_account_deletion_data(uuid,uuid)` und lässt den globalen Trigger unverändert. Der neue RPC:

- verlangt explizit `current_user='service_role'`;
- verlangt weiterhin die bereits geclaimte Löschanforderung mit passender `p_request_id` + `p_lock_token`;
- setzt unmittelbar vor dem Username-Clear transaktionslokal `duelvanta.username_rpc=allowed`;
- setzt nach dem Profilupdate den Wert wieder leer;
- besitzt einen `exception when others`-Pfad, der den Wert ebenfalls leert und den Fehler erneut wirft;
- behält die bisherigen Retention-Holds, Lösch-/Anonymisierungsschritte, Audit- und `auth_action`-Logik bei;
- `revoke all` für public/anon/authenticated und `grant execute ... to service_role` bleiben bestehen.

Der bestehende Worker `api/account-data-erasure.js` wurde NICHT geändert. Er ist weiterhin standardmäßig deaktiviert und würde erst bei expliziter Aktivierung den Service-Role-RPC verwenden. Kein realer Löschlauf wurde gestartet.

## 5. Neuer B02-Test

Neue Datei:

`tests/account-data-erasure-username-guard-test.mjs`

Ziel des Tests ist eine isolierte PGlite-Datenbank mit dem **echten Triggerverhalten**. Geprüft werden sollen:

- normale direkte Username-Änderung bleibt blockiert;
- authenticated kann `prepare_account_deletion_data` nicht ausführen;
- der kontrollierte Service-Role-Erasure-Pfad kann Username auf null setzen;
- nach erfolgreichem Lauf ist `duelvanta.username_rpc` wieder leer;
- nach dem Lauf bleibt eine direkte Username-Änderung blockiert;
- ein absichtlich nach dem Username-Clear erzeugter Auditfehler rollt die Änderung zurück;
- auch nach dem Fehler ist `duelvanta.username_rpc` wieder leer und der globale Trigger weiterhin wirksam.

## 6. CI-Stand – WICHTIG: aktueller Fehler ist im neuen Test

`.github/workflows/scanner-v16-check.yml` wurde minimal ergänzt:

- PR-Pfadfilter zusätzlich `database/account-data-erasure-*.sql`;
- im bestehenden Schritt `Trade contracts and mobile order flow` zusätzlich:

```bash
node tests/account-data-erasure-username-guard-test.mjs "$PWD/node_modules/@electric-sql/pglite/dist/index.js"
```

Automatischer Run für Head `cdf0592b9544c0a25da064148564ac878dff2127`:

- Scanner V16 Check Run #225
- Run-ID: `34964129105`
- Gesamtergebnis: **failure**
- `quota_database`: success
- `validate`: failure ausschließlich im Schritt `Trade contracts and mobile order flow`
- alle davor gelaufenen Scanner-, Auth-Boundary-, Marketplace-, Compliance-, Runtime-, Tax-, Data-Rights- und Erasure-Worker-Tests waren bis zum neuen B02-Test grün.

Exakter Fehler des neuen Tests:

```text
error: service_role_required
where: PL/pgSQL function prepare_account_deletion_data(uuid,uuid) line 4 at RAISE
query: select public.prepare_account_deletion_data(
  '94000000-0000-4000-8000-000000000002',
  '94000000-0000-4000-8000-000000000003'
) value
```

Ursache sehr wahrscheinlich im **Testmodell**, nicht bereits als Produktfix-Fehler bewerten: In PostgreSQL bedeutet `SECURITY DEFINER`, dass `current_user` innerhalb der Funktion der Funktionsowner ist. Im PGlite-Test wird die Funktion als Default-Owner erstellt; anschließend wird nur `SET ROLE service_role` ausgeführt. Deshalb ist `current_user` innerhalb der SECURITY-DEFINER-Funktion nicht `service_role` und die neue explizite Prüfung schlägt fehl. Auf echtem Supabase ist ebenfalls sorgfältig zu prüfen, welcher Owner die Funktion besitzt; `current_user='service_role'` ist daher möglicherweise strukturell die falsche Absicherung für einen SECURITY-DEFINER-RPC.

**B02 darf nicht geschlossen werden.** Der nächste Chat muss diesen Punkt zuerst sauber korrigieren, statt den Test nur passend zu machen.

## 7. Exakter nächster Arbeitsauftrag

Arbeite ausschließlich an B02 weiter.

1. Zuerst Branch-Head, PR #5 Draftstatus und main erneut lesen. Nichts zurücksetzen.
2. Prüfe die PostgreSQL/Supabase-Ausführungssemantik des bestehenden `prepare_account_deletion_data` als `SECURITY DEFINER`: insbesondere `current_user`, Funktionsowner und RPC-Rollenprüfung.
3. Entferne oder ersetze die neu eingeführte `current_user<>'service_role'`-Prüfung nur dann, wenn eine bessere, belastbare Grenze verwendet wird. Die vorhandene EXECUTE-Berechtigungsgrenze (`revoke ... public, anon, authenticated`; `grant ... service_role`) plus Lock-Token kann der richtige Mechanismus sein; dies muss anhand des realen Supabase-Verhaltens und isolierter Tests begründet werden.
4. Behalte zwingend den globalen `guard_profile_username_direct_update` unverändert wirksam.
5. Der Erasure-RPC darf den bestehenden `duelvanta.username_rpc`-Freigabekontext nur transaktionslokal und nur innerhalb des bereits autorisierten, gelockten Erasure-Pfads setzen. Erfolgs- und Fehlerpfad müssen ihn wieder neutralisieren; Rollback darf keinen wirksamen Freigabekontext hinterlassen.
6. Korrigiere Produkt-SQL und/oder Test minimal. Keine echte Account-, Storage- oder Auth-Löschung ausführen.
7. Automatische CI erneut laufen lassen. Nicht manuell bereits grüne Abnahmen wiederholen.
8. B02 erst schließen, wenn der neue Real-Trigger-Test und die bestehende CI vollständig grün sind und die Rollen-/Bypassgrenze fachlich korrekt ist.
9. Danach B02-Status im Masterhandout aktualisieren. Erst anschließend mit B03 fortfahren.

## 8. Releaseblocker nach B01

- **B01 GESCHLOSSEN:** PROFILE-Preview-Isolation vollständig nachgewiesen.
- **B02 OFFEN / in Arbeit:** Username-Triggerkonflikt im Lösch-RPC; aktueller B02-Test deckt eine Rollenprüfungsfrage im neuen Fix auf.
- **B03 OFFEN:** eigener standardmäßig deaktivierter Live-Paymentmodus; Schlüsselwechsel allein genügt nicht.
- **B04 OFFEN:** wirksamer main-Schutz mit PR-/CI-Pflicht, Force-Push-/Delete-Sperre und Notfallweg.
- **B05 OFFEN:** `.gitignore`, aktueller/historischer Secret- und Supply-Chain-Scan; echte Treffer gegebenenfalls rotieren.
- **B06 OFFEN:** Produktions-Auth-/Berechtigungsprüfung einschließlich MFA/Step-up, Sessions, Recovery und begründeter Advisor-Ausnahmen.
- **B07 OFFEN:** qualifizierte rechtliche Schlussprüfung.
- **B08 OFFEN:** steuerliche Schlussprüfung; `platform_fee_tax_treatment=review_required` bleibt.
- **B09 OFFEN:** tatsächlicher Betreiber-/Gewerbestatus und finale Betreiberangaben.
- **B10 OFFEN:** kommerziell zulässiger Hostingtarif, Budget und Providerlimits.
- **B11 OFFEN:** Produktionsbaseline und exaktes Delta-/Checksum-Migrationsmanifest; keine Staging-Vollkopie.
- **B12 OFFEN:** separate Live-Stripe-/Connect-Freigabe und spätere ausdrückliche Live-Autorisierung.
- **B13 OFFEN:** E-Mail-Domain/DNS, Scheduler, Retry/Dedupe, Zustell-/Bounce-Nachweise und Alerts.
- **B14 OFFEN:** Monitoring, Alarmempfänger, Vertretung und Incident-Runbook.
- **B15 OFFEN:** kompatibler Rückfallstand, DB-/Storage-Restoreprobe, RPO/RTO und serverseitige Schreibsperre.

F03 und F04 aus V5 bleiben unverändert. Alle in V4 abgeschlossenen Abnahmen bleiben ausschließlich in ihrem dokumentierten Umfang geschlossen.

## 9. Harte Grenzen

- Kein Merge und keine Änderung an main.
- PR #5 bleibt Draft.
- Keine Produktionsänderung oder Domain-Promotion.
- Keine Live-Zahlung, Live-Erstattung oder Live-Auszahlung.
- Stripe-Sandbox nicht reaktivieren.
- Keine Worker, Scheduler oder Warteschlangen aktivieren.
- Keine kostenpflichtigen Tarifwechsel.
- Keine Staging-Daten, Nutzer, Provider-IDs oder Secrets nach Produktion kopieren.
- Keine Secrets oder personenbezogenen Exporte ins Repository.
- Payment-, Steuer-, Vertrags- und Refund-Belege nicht nachträglich mutieren.
- Kein zweiter Refundpfad.
- `v-logo.svg` und **COLLECT. TRADE. BATTLE.** unverändert lassen.
- Kein echter Account-Löschlauf zur Diagnose von B02.

V5 Abschnitte 7 und 8 bleiben der verbindliche, NICHT ausgeführte Rollout-/Rollbackplan. B01-Abschluss erteilt keine Produktionsfreigabe. **NO-GO für Produktion und Live-Payments bleibt bestehen.**

## 10. Dauerhafte Referenzen

- V4: `DUELVANTA_MASTERHANDOUT_V4_2026-09-15.md`, Commit `30d372aee483705565288cd00a71a282482d4ad4`
- V5: `DUELVANTA_MASTERHANDOUT_V5_2026-09-15.md`, Commit `c26b97472f69cd13fa2f79e2b2705d742ab0c5ea`
- V6: `DUELVANTA_MASTERHANDOUT_V6_2026-09-15.md`; B01-Abschlussdokumentation Commit `d28d6c5777bb8120ae6fa373be419b55f49b63ea`
- Technischer B01-Checkpoint: `d108eba6033ea2d94d3a06e639202260e2d69717`
- B01 CI: Run #219 / `34955359914`
- B02 aktueller technischer Head: `cdf0592b9544c0a25da064148564ac878dff2127`
- B02 aktueller fehlgeschlagener CI-Run: #225 / `34964129105`
- Staging Supabase: `xhmjxrcskfhbovhitdej`
- Produktion Supabase: `enifiaqsnqtbzylnfrpi`

Compact Development Mode bleibt verbindlich: gezielte Änderungen, keine unnötigen Wiederholungen, keine unveränderten Abnahmen erneut ausführen und keine absolute Fehlerfreiheit behaupten.
