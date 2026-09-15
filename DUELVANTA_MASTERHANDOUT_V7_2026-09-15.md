# DUELVANTA – Masterhandout V7

Stand: 15.09.2026, nach vollständigem Abschluss von B01 und B02. Dieses Dokument ist der verbindliche Einstieg für die weitere Arbeit und ersetzt widersprechende Statusangaben älterer Handouts. V4/V5/V6 bleiben Detailreferenzen, soweit V7 sie nicht ausdrücklich aktualisiert.

## 1. Verbindlicher Repository-Stand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- Technischer B02-Abschluss-Head: `24c1a6ef0fc437e13f56d18aa23e255dfc7d610c`
- PR #5: offen, **Draft**, nicht gemergt; bei B02-Abschluss Head `24c1a6ef0fc437e13f56d18aa23e255dfc7d610c`
- main: `50f88213571be13255bb52eb489cc28cca660001`, unverändert
- Technischer B01-Codecheckpoint: `d108eba6033ea2d94d3a06e639202260e2d69717`
- V6-B01-Abschlussdokumentation: Commit `d28d6c5777bb8120ae6fa373be419b55f49b63ea`
- B02 SQL-Fixdatei ursprünglich hinzugefügt: Commit `8188ccaca6ea36e03f359f7d39ff215cf2be0f5d`
- B02 Real-Trigger-Test ursprünglich hinzugefügt: Commit `571be2855537ff791ca5cd70cbe26db0ede2cf23`
- B02 CI-Wiring: Commit `cdf0592b9544c0a25da064148564ac878dff2127`
- B02 finale SECURITY-DEFINER-Korrektur: Commit `bfa428e189b3515c44adb0c5bd4194fac03f6e3f`
- B02 final gehärteter Real-Trigger-/ACL-Test: Commit `24c1a6ef0fc437e13f56d18aa23e255dfc7d610c`

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

## 3. B02 / F02 – GESCHLOSSEN

Ausgangsfehler: `public.prepare_account_deletion_data(...)` setzt bei der Erasure-Vorbereitung `public.profiles.username=null`. Auf Staging existiert jedoch der Trigger:

```sql
CREATE TRIGGER guard_profile_username_direct_update
BEFORE UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION guard_profile_username_direct_update()
```

Die zugehörige Staging-Funktion blockiert jede Username-Änderung, solange
`current_setting('duelvanta.username_rpc', true) <> 'allowed'`.

Der bestehende geschützte Profil-RPC `public.set_my_public_profile(...)` setzt diesen Wert transaktionslokal mit `set_config(..., true)`, führt die geschützte Änderung aus und setzt ihn anschließend zurück. Der ursprüngliche Erasure-RPC in `database/account-data-rights-v1.sql` tat dies nicht. Dadurch kollidierte der Löschpfad mit dem globalen Username-Schutz.

Der globale Username-Trigger wurde NICHT entfernt, gelockert oder browserseitig umgehbar gemacht.

## 4. Finaler B02-Fix und Rollen-/Bypassgrenze

Datei:

`database/account-data-erasure-username-guard-v1.sql`

Sie ersetzt ausschließlich `public.prepare_account_deletion_data(uuid,uuid)` und lässt den globalen Trigger unverändert. Der finale RPC:

- verlangt weiterhin die bereits geclaimte Löschanforderung mit passender `p_request_id` + `p_lock_token`;
- setzt unmittelbar vor dem Username-Clear transaktionslokal `duelvanta.username_rpc=allowed`;
- setzt nach dem Profilupdate den Wert wieder leer;
- besitzt einen `exception when others`-Pfad, der den Wert ebenfalls leert und den Fehler erneut wirft;
- behält die bisherigen Retention-Holds, Lösch-/Anonymisierungsschritte, Audit- und `auth_action`-Logik bei;
- `revoke all` für public/anon/authenticated und `grant execute ... to service_role` bleiben die RPC-Aufrufgrenze.

Die zwischenzeitlich eingeführte Prüfung `current_user='service_role'` wurde in Commit `bfa428e189b3515c44adb0c5bd4194fac03f6e3f` wieder entfernt. Grund: `prepare_account_deletion_data` ist `SECURITY DEFINER`; auf dem realen Staging gehört die Funktion `postgres`. Innerhalb einer SECURITY-DEFINER-Funktion repräsentiert `current_user` daher den Funktionsowner und nicht den aufrufenden PostgREST-RPC-Rollenprincipal. Eine Prüfung auf `current_user='service_role'` war strukturell falsch.

Read-only auf Staging verifiziert:

- Owner `prepare_account_deletion_data(uuid,uuid)`: `postgres`;
- `SECURITY DEFINER`: aktiv;
- `anon`: kein EXECUTE;
- `authenticated`: kein EXECUTE;
- `service_role`: EXECUTE;
- `postgres`: EXECUTE.

Damit besteht die belastbare Grenze aus der EXECUTE-ACL plus dem bereits geclaimten Request-/Lock-Token. Der transaktionslokale Username-Bypass wird erst hinter dieser Grenze gesetzt.

Der bestehende Worker `api/account-data-erasure.js` wurde NICHT geändert. Er bleibt standardmäßig deaktiviert und würde erst bei expliziter Aktivierung den Service-Role-RPC verwenden. Kein realer Account-, Storage- oder Auth-Löschlauf wurde gestartet.

## 5. Finaler B02-Test

Datei:

`tests/account-data-erasure-username-guard-test.mjs`

Der isolierte PGlite-Test bildet das echte Triggerverhalten ab und prüft nun zusätzlich die relevante Rollen-/Owner-Semantik:

- normale direkte Username-Änderung bleibt blockiert;
- `authenticated` besitzt kein EXECUTE auf `prepare_account_deletion_data`;
- `service_role` besitzt EXECUTE;
- SECURITY-DEFINER-Owner wird nicht mit dem Service-Role-Aufrufer gleichgesetzt;
- der kontrollierte Service-Role-Erasure-Pfad kann Username auf null setzen;
- nach erfolgreichem Lauf ist `duelvanta.username_rpc` wieder leer;
- nach dem Lauf bleibt eine direkte Username-Änderung blockiert;
- ein separater zweiter Testdatensatz erzwingt nach dem Username-Clear einen Auditfehler;
- dieser Fehler rollt die Username-Änderung vollständig zurück;
- auch nach dem Fehler ist `duelvanta.username_rpc` wieder leer und der globale Trigger weiterhin wirksam.

Die Verwendung eines zweiten Testdatensatzes beseitigt außerdem die frühere Testschwäche, bei der der Test selbst einen geschützten Username zurücksetzen wollte.

## 6. B02 CI-Abschluss

`.github/workflows/scanner-v16-check.yml` enthält weiterhin minimal:

- PR-Pfadfilter zusätzlich `database/account-data-erasure-*.sql`;
- im bestehenden Schritt `Trade contracts and mobile order flow` zusätzlich:

```bash
node tests/account-data-erasure-username-guard-test.mjs "$PWD/node_modules/@electric-sql/pglite/dist/index.js"
```

Finaler automatischer Run für Head `24c1a6ef0fc437e13f56d18aa23e255dfc7d610c`:

- Scanner V16 Check Run #228
- Run-ID: `34964941036`
- Gesamtergebnis: **success**
- `quota_database`: success
- `validate`: success
- `Trade contracts and mobile order flow`: success einschließlich des finalen B02-Real-Trigger-/ACL-Tests
- übrige ausgeführte Scanner-, Auth-Boundary-, Marketplace-, Compliance-, Runtime-, Tax-, Data-Rights-, Browser- und Erasure-Worker-Regressionen: success
- die regulär bedingten Schritte `Real complex-card reference recognition and recovery` und `Read-only live catalog availability` waren skipped, nicht failed.

Der frühere fehlgeschlagene Run #225 / `34964129105` bleibt nur historische Fehlerreferenz und ist durch Run #228 ersetzt.

**B02 ist geschlossen.** Nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.

## 7. Exakter nächster Arbeitsauftrag

Nächster Block ist ausschließlich **B03**: eigener standardmäßig deaktivierter Live-Paymentmodus; ein bloßer Wechsel von Sandbox- auf Live-Schlüsseln darf keine Live-Zahlungsfähigkeit freischalten.

1. Branch-Head, PR #5 Draftstatus und main vor Änderungen erneut lesen. Nichts zurücksetzen.
2. Bestehende Payment-/Stripe-Konfiguration, API-Routen, Worker und Environment-Gates vollständig auf die aktuelle Sandbox-/Live-Trennung prüfen.
3. Einen expliziten, standardmäßig deaktivierten Live-Paymentmodus entwerfen und nur minimal implementieren. Live-Schlüssel allein dürfen nicht genügen.
4. Bestehende Sandbox-, Payment-, Refund-, Connect- und Webhook-Sicherheitsgrenzen unverändert erhalten; keinen zweiten Zahlungs- oder Refundpfad schaffen.
5. Ausschließlich Mocks/isolierte Tests verwenden. Keine Live-Zahlung, Live-Erstattung, Live-Auszahlung oder Stripe-Sandbox-Reaktivierung ausführen.
6. Automatische CI laufen lassen; bereits grüne, unveränderte Abnahmen nicht manuell wiederholen.
7. B03 erst schließen, wenn der Modus technisch fail-closed ist, die Regressionen grün sind und ein versehentlicher Schlüsselwechsel allein nachweislich keine Live-Aktion aktivieren kann.
8. Danach V7 aktualisieren; erst anschließend B04 beginnen.

## 8. Releaseblocker nach B02

- **B01 GESCHLOSSEN:** PROFILE-Preview-Isolation vollständig nachgewiesen.
- **B02 GESCHLOSSEN:** Username-Triggerkonflikt im Erasure-RPC behoben; Rollen-/Bypassgrenze und Rollback isoliert getestet, CI #228 vollständig grün.
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

V5 Abschnitte 7 und 8 bleiben der verbindliche, NICHT ausgeführte Rollout-/Rollbackplan. B01-/B02-Abschluss erteilt keine Produktionsfreigabe. **NO-GO für Produktion und Live-Payments bleibt bestehen.**

## 10. Dauerhafte Referenzen

- V4: `DUELVANTA_MASTERHANDOUT_V4_2026-09-15.md`, Commit `30d372aee483705565288cd00a71a282482d4ad4`
- V5: `DUELVANTA_MASTERHANDOUT_V5_2026-09-15.md`, Commit `c26b97472f69cd13fa2f79e2b2705d742ab0c5ea`
- V6: `DUELVANTA_MASTERHANDOUT_V6_2026-09-15.md`; B01-Abschlussdokumentation Commit `d28d6c5777bb8120ae6fa373be419b55f49b63ea`
- Technischer B01-Checkpoint: `d108eba6033ea2d94d3a06e639202260e2d69717`
- B01 CI: Run #219 / `34955359914`
- V7 ursprünglicher Dokumentationscommit vor B02-Abschluss: `773d1b1e23395647d6a992174aecbfd939afad02`
- B02 finale SQL-Korrektur: `bfa428e189b3515c44adb0c5bd4194fac03f6e3f`
- B02 technischer Abschluss-Head / finaler Test: `24c1a6ef0fc437e13f56d18aa23e255dfc7d610c`
- B02 erfolgreicher CI-Run: #228 / `34964941036`
- B02 historischer fehlgeschlagener CI-Run: #225 / `34964129105`
- Staging Supabase: `xhmjxrcskfhbovhitdej`
- Produktion Supabase: `enifiaqsnqtbzylnfrpi`

Compact Development Mode bleibt verbindlich: gezielte Änderungen, keine unnötigen Wiederholungen, keine unveränderten Abnahmen erneut ausführen und keine absolute Fehlerfreiheit behaupten.
