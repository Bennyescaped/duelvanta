# DUELVANTA – Masterhandout V7

Stand: 15.09.2026, nach vollständigem Abschluss von B01, B02 und B03. Dieses Dokument ist der verbindliche Einstieg für die weitere Arbeit und ersetzt widersprechende Statusangaben älterer Handouts. V4/V5/V6 bleiben Detailreferenzen, soweit V7 sie nicht ausdrücklich aktualisiert.

## 1. Verbindlicher Repository-Stand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- Technischer B03-Abschluss-Head: `c8a8a02fa4f5b21813ba253e66767a8ee61d95b7`
- PR #5: offen, **Draft**, nicht gemergt; bei B03-Abschluss Head `c8a8a02fa4f5b21813ba253e66767a8ee61d95b7`
- main: `50f88213571be13255bb52eb489cc28cca660001`, unverändert
- Technischer B01-Codecheckpoint: `d108eba6033ea2d94d3a06e639202260e2d69717`
- V6-B01-Abschlussdokumentation: Commit `d28d6c5777bb8120ae6fa373be419b55f49b63ea`
- B02 finale SECURITY-DEFINER-Korrektur: Commit `bfa428e189b3515c44adb0c5bd4194fac03f6e3f`
- B02 final gehärteter Real-Trigger-/ACL-Test: Commit `24c1a6ef0fc437e13f56d18aa23e255dfc7d610c`
- B03 zentrale Provider-/Live-Gates begonnen: Commit `a4705ae9e120b1878e8dea8053c9e17791b0de77`
- B03 DB-Live-Mode-Migration: Commit `b5ac1b15f24eac42fdbe241c0af2597b3abdc504`
- B03 Live-Mode-Tests: Commits `e72f4932fc0e8ffbe223a0d33255f042304be823` und `3812a5af134a7c50c82e3f9749464bcc2ced5a16`
- B03 CI-Wiring: Commit `1fae27518269540c2139e1465100152b5b161170`
- B03 Stripe-Test-Pathfilter: Commit `db56e35d840c3c04e754863c2bdfcffe2ffceef3`
- B03 finaler Testfix / technischer Abschluss-Head: `c8a8a02fa4f5b21813ba253e66767a8ee61d95b7`

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

Der isolierte PGlite-Test bildet das echte Triggerverhalten ab und prüft zusätzlich die relevante Rollen-/Owner-Semantik:

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

Finaler B02-CI-Lauf: Scanner V16 Check Run #228 / `34964941036`, vollständig **success**.

**B02 ist geschlossen.** Nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.

## 6. B03 – GESCHLOSSEN: expliziter, standardmäßig deaktivierter Stripe-Live-Modus

Ausgangslage: Der bestehende Stripe-Connect-Pfad war absichtlich sandbox-only. Checkout, Onboarding, Refund und Webhook waren an `STRIPE_CONNECT_SANDBOX_ENABLED` und Test-Schlüssel/-Events gebunden. Ein separater, sicherer späterer Live-Modus fehlte. Ziel von B03 war, einen Live-Schlüsselwechsel allein technisch wirkungslos zu machen und trotzdem keinen zweiten Payment-/Refundpfad zu schaffen.

### 6.1 Zentraler Provider-Modus

`api/market-stripe-lib.js` enthält jetzt `stripeMode(action)` mit folgenden Grenzen:

- Sandbox bleibt über `STRIPE_CONNECT_SANDBOX_ENABLED=true` explizit aktivierbar.
- Live besitzt einen separaten Master-Schalter `STRIPE_CONNECT_LIVE_ENABLED=true`.
- Sandbox und Live gleichzeitig führen fail-closed zu `stripe_mode_conflict`.
- Sind beide Modi aus, bleibt Stripe deaktiviert.
- Sandbox verlangt weiterhin einen `sk_test_...`-Schlüssel.
- Live verlangt einen `sk_live_...`-Schlüssel.
- Ein Live-Key allein aktiviert **keine** Live-Aktion.
- Live braucht zusätzlich pro Aktionsklasse einen eigenen Schalter:
  - `STRIPE_CONNECT_LIVE_PAYMENTS_ENABLED=true`
  - `STRIPE_CONNECT_LIVE_ONBOARDING_ENABLED=true`
  - `STRIPE_CONNECT_LIVE_REFUNDS_ENABLED=true`
  - `STRIPE_CONNECT_LIVE_WEBHOOKS_ENABLED=true`

Checkout, Onboarding, Refund und Webhook verwenden weiterhin ihre bisherigen API-Routen und Providerpfade; es wurde kein paralleler Zahlungs- oder Refundpfad geschaffen.

### 6.2 API-Grenzen

- `api/market-stripe-checkout.js`: `stripeMode('payments')`; Live verlangt zusätzlich `prepared.live_mode===true`; Session-Präfix wird auf `cs_live_` bzw. `cs_test_` gebunden.
- `api/market-stripe-onboarding.js`: `stripeMode('onboarding')`; Provider-Account und Account-Link müssen denselben `livemode` besitzen. Sandbox nutzt aus Kompatibilitätsgründen weiterhin den bestehenden Testkonto-RPC, Live den generischen mode-bound RPC.
- `api/market-stripe-refund.js`: bestehender Refundpfad bleibt erhalten; `stripeMode('refunds')` plus DB-Modusbindung. Kein zweiter Refundpfad.
- `api/market-stripe-webhook.js`: `stripeMode('webhooks')`; `event.livemode` muss zum konfigurierten Provider-Modus passen. Der Webhook-Schalter ist absichtlich unabhängig vom Schalter für neue Zahlungen, damit bereits ausgelöste Providerereignisse noch verarbeitet werden können, nachdem neue Payments gestoppt wurden.

Die bestehende Sandbox-Oberfläche bleibt weiterhin sandbox-only und lehnt Live-Checkoutantworten ab. B03 stellt nur die sichere Backend-Grenze für eine spätere Freigabe her. B12 bleibt die separate tatsächliche Live-Stripe-/Connect-Freigabe.

### 6.3 DB-Migration – REVIEW ONLY, NICHT angewendet

Neue Datei:

`database/market-stripe-live-mode-v1.sql`

Sie wurde ausschließlich in isolierten PGlite-Tests ausgeführt und **nicht** auf Staging oder Produktion angewendet.

Wesentliche Grenzen:

- `market_payment_configuration` erlaubt nie gleichzeitig Sandbox und Live; Standard bleibt beides aus.
- `live_mode` wird auf Onboarding-Requests und Payment-Attempts gespeichert, Default `false`.
- Stripe-Accounts werden nach `(seller_id, live_mode)` getrennt, sodass Sandbox-/Live-Konten nicht vermischt werden.
- `prepare_market_stripe_payment` bindet Verkäuferkonto, Idempotency und Payment-Attempt an den DB-Modus.
- `bind_market_stripe_checkout_session` akzeptiert je Attempt nur das passende `cs_test_`- oder `cs_live_`-Präfix.
- `apply_market_stripe_event` bindet Event, Account und Attempt an denselben Modus, ist aber bewusst nicht vom aktuellen Neuzahlungs-Schalter abhängig. Dadurch können in-flight Webhooks nach einem Payment-Stop noch verarbeitet werden.
- Steuer-/Providerbelege enthalten den verwendeten `live_mode`.
- `prepare_market_stripe_full_refund` bleibt der einzige Refund-Vorbereitungspfad und gibt den mode-bound Attempt zurück.
- Backend-RPCs bleiben für `public`, `anon` und `authenticated` entzogen und nur für `service_role` ausführbar.

### 6.4 B03 Tests

Neue Tests:

- `tests/market-stripe-live-mode-api-test.mjs`
- `tests/market-stripe-live-mode-database-test.mjs`

Zusätzlich wurde `tests/market-stripe-connect-contract-test.mjs` um die Live-Grenzen erweitert.

Nachgewiesen wird unter anderem:

- Live-Key ohne Live-Master-Schalter führt zu keiner Provideraktion.
- Live-Master-Schalter ohne aktionsspezifischen Schalter führt zu keiner Provideraktion.
- falscher Key-Typ wird vor Providerzugriff blockiert.
- API- und DB-Modus müssen übereinstimmen.
- Sandbox und Live können nicht gleichzeitig aktiv sein.
- falsche Test-/Live-Checkout-Session-Präfixe werden blockiert.
- Wrong-mode Webhooks verändern den Live-Attempt nicht und werden als unmatched/ignored protokolliert.
- bereits bestehende Live-Providerereignisse können nach Deaktivierung neuer Payments noch verarbeitet werden.
- Refund verwendet weiterhin denselben mode-bound Providerpfad.
- direkte private Evidenzabfragen sind unter `service_role` nicht freigegeben; Testverifikation erfolgt nach `RESET ROLE` im isolierten Testowner-Kontext.

Die CI-Pfadfilter enthalten jetzt zusätzlich `tests/market-stripe-*.mjs`, sodass reine Stripe-Teständerungen den PR-Workflow ebenfalls auslösen.

### 6.5 B03 CI-Abschluss

Finaler automatischer Lauf für Head `c8a8a02fa4f5b21813ba253e66767a8ee61d95b7`:

- Scanner V16 Check Run **#245**
- Run-ID: `34966761267`
- Gesamtergebnis: **success**
- `quota_database`: success
- `validate`: success
- `Trade contracts and mobile order flow`: success
- beide neuen B03 Live-Mode-Tests: success
- bestehende Stripe-Sandbox-, API-, DB-, Refund-, Webhook-, Marketplace-, Compliance-, Auth-, Browser- und Scanner-Regressionen: success
- die PR-bedingt nicht ausgeführten Live-Catalog-/Real-Card-Schritte waren skipped, nicht failed.

Historische Zwischenläufe mit Testmodell-/Assertionfehlern sind durch Run #245 ersetzt und keine offenen Produktfehler.

Es wurde im gesamten B03 **keine** Stripe-Sandbox reaktiviert, kein Live-Schlüssel gesetzt, keine Live-/Testzahlung ausgelöst, keine Erstattung oder Auszahlung gestartet, kein Stripe-Account erzeugt, keine Staging-DDL ausgeführt und Produktion nicht verändert.

**B03 ist geschlossen.** Nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.

## 7. Exakter nächster Arbeitsauftrag

Nächster Block ist ausschließlich **B04**: wirksamer Schutz von `main` mit PR-/CI-Pflicht, Force-Push-/Delete-Sperre und einem klar definierten Notfallweg.

1. Branch-Head, PR #5 Draftstatus und `main` vor Änderungen erneut lesen. Nichts zurücksetzen.
2. Aktuellen GitHub-Branch-/Ruleset-Schutz für `main` read-only ermitteln; bestehende Regeln nicht ungeprüft überschreiben.
3. Zielzustand festlegen: Änderungen an `main` nur über PR, erfolgreicher verpflichtender CI-Check, keine Force-Pushes, kein Branch-Delete, keine stillen Bypässe.
4. Einen eng begrenzten Notfallweg dokumentieren, der nicht den normalen Schutz dauerhaft abschaltet und dessen Nutzung nachvollziehbar ist.
5. Schutz nur dann direkt konfigurieren, wenn die verbundene GitHub-Berechtigung die erforderliche Repository-Administration ausdrücklich erlaubt. Andernfalls den exakten erforderlichen GitHub-UI-/Ruleset-Schritt dokumentieren, ohne Schutzwirkung vorzutäuschen.
6. Nach Konfiguration den effektiven Schutz read-only erneut prüfen. Keine absichtlichen Force-Push-/Delete-Versuche gegen `main` ausführen.
7. B04 erst schließen, wenn die wirksame Konfiguration nachgewiesen ist; eine bloße Dokumentation ohne aktivierten Schutz reicht nicht.
8. Danach V7 aktualisieren; erst anschließend B05 beginnen.

## 8. Releaseblocker nach B03

- **B01 GESCHLOSSEN:** PROFILE-Preview-Isolation vollständig nachgewiesen.
- **B02 GESCHLOSSEN:** Username-Triggerkonflikt im Erasure-RPC behoben; Rollen-/Bypassgrenze und Rollback isoliert getestet, CI #228 vollständig grün.
- **B03 GESCHLOSSEN:** expliziter fail-closed Live-Paymentmodus; Schlüsselwechsel allein reicht nicht; DB/API-Modusbindung und unabhängiger Webhook-Gate isoliert getestet, CI #245 vollständig grün.
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
- B03 stellt keine Live-Freigabe dar; alle neuen Live-Schalter bleiben bis zur späteren ausdrücklichen B12-Freigabe aus.

V5 Abschnitte 7 und 8 bleiben der verbindliche, NICHT ausgeführte Rollout-/Rollbackplan. B01-/B02-/B03-Abschluss erteilt keine Produktionsfreigabe. **NO-GO für Produktion und Live-Payments bleibt bestehen.**

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
- B03 zentrale Live-Gates: `a4705ae9e120b1878e8dea8053c9e17791b0de77`
- B03 DB-Migration: `b5ac1b15f24eac42fdbe241c0af2597b3abdc504`
- B03 technischer Abschluss-Head: `c8a8a02fa4f5b21813ba253e66767a8ee61d95b7`
- B03 erfolgreicher CI-Run: #245 / `34966761267`
- Staging Supabase: `xhmjxrcskfhbovhitdej`
- Produktion Supabase: `enifiaqsnqtbzylnfrpi`

Compact Development Mode bleibt verbindlich: gezielte Änderungen, keine unnötigen Wiederholungen, keine unveränderten Abnahmen erneut ausführen und keine absolute Fehlerfreiheit behaupten.
