# DUELVANTA – Masterhandout V6

Stand: 15.09.2026. **B01 / PROFILE-Preview-Isolation ist geschlossen.** Der gezielte Codefix am technischen Checkpoint `d108eba6033ea2d94d3a06e639202260e2d69717`, lokale Negativ-/Runtime-Tests, CI Run #219 und die statische Auslieferungsprüfung des festen Preview-Deployments sind vollständig. NO-GO für Produktion und Live-Payments bleibt bestehen.

## 1. Verbindlicher Stand

V5 bleibt Detailreferenz für F02–F04, B02–B15 sowie den nicht ausgeführten Rollout-/Rollbackplan. V4 bleibt Detailreferenz für abgeschlossene Funktionsabnahmen. Dieses V6 aktualisiert ausschließlich den B01-Status.

- Repository / Branch: `Bennyescaped/duelvanta` / `marketplace-ux-v1`
- Technischer B01-Codecheckpoint: `d108eba6033ea2d94d3a06e639202260e2d69717`
- V5-Dokumentationscommit: `c26b97472f69cd13fa2f79e2b2705d742ab0c5ea`
- V6 ursprünglicher Dokumentationscommit: `3375024a787949fbb5fdf4f0e0aa889214542908`
- V6 Teilnachtrag vor B01-Abschluss: `3f11f0aef4b2404ecbc7f9b02c0c344dd4a2b9fe`
- main: `50f88213571be13255bb52eb489cc28cca660001`, unverändert vor diesem Dokumentationsupdate
- PR #5: offen, Draft, nicht gemergt vor diesem Dokumentationsupdate
- Festes technisches Preview: `dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK`, Host `duelvantav5vision-33t1a6azf-bennyescaped-3783.vercel.app`, gebaut aus technischem SHA `d108eba6033ea2d94d3a06e639202260e2d69717`
- CI: Scanner V16 Check Run #219 / `34955359914`, success
- Staging: `xhmjxrcskfhbovhitdej`
- Produktion-Supabase: `enifiaqsnqtbzylnfrpi`; in B01 nicht für Profil-/Datenschutzaktionen verwendet oder verändert

## 2. B01-Fix

Geänderter Produktcode bleibt exakt der technische Commit `d108eba6033ea2d94d3a06e639202260e2d69717`:

- `profile.html`: lädt `/api/compliance-message-dispatch?runtime_config=1` vor `profile.js?v=1.2`.
- `profile.js`: kein fest eingebauter Produktions-Fallback; setzt einen alten `window.__dvAppDb` zunächst auf null; validiert Runtime-Environment, Host, HTTPS, exakte Supabase-Projekt-URL und Publishable-Key-Format vor `createClient`; Clientquelle ausschließlich `window.DV_SUPABASE`; danach weiterhin Bereitstellung als `window.__dvAppDb`.
- `tests/supabase-runtime-config-test.mjs`: PROFILE-Runtime-, Negativ-, Ladefolge- und Clientweitergabetests.
- `.github/workflows/scanner-v16-check.yml`: ausschließlich fehlende PR-Pfadfilter für `profile.js` und den Runtime-Test ergänzt.

`profile-data-rights.js` wurde nicht geändert und übernimmt weiterhin ausschließlich `window.__dvAppDb`.

## 3. Test- und CI-Nachweise

Lokale, netzwerkfreie Tests am technischen Checkpoint waren erfolgreich. Unter anderem wurden 22 ungültige Konfigurationen, falsche Produktionskonfiguration auf Preview, Staging-only Preview, vier lokale Produktionsaliase, Ladefolge und gemeinsamer Client für abhängige Profilmodule geprüft. Keine reale Profiländerung, Auth-Aktion, Exportanforderung oder Kontolöschung wurde ausgelöst.

CI Run #219 / `34955359914` lief für `d108eba6033ea2d94d3a06e639202260e2d69717` erfolgreich. Der bestehende Schritt `Trade contracts and mobile order flow` führte `node tests/supabase-runtime-config-test.mjs` vollständig aus. Kein manueller Wiederholungslauf wurde benötigt.

## 4. Abschließender statischer Auslieferungsnachweis

Der bereits vorhandene Vercel `Protection Bypass for Automation` wurde ausschließlich für einen passiven GET-Abruf des festen technischen Deployments verwendet. Der Deployment-Schutz wurde nicht deaktiviert oder verändert; kein neues Secret wurde angelegt. Das Secret selbst wurde weder in Chat/Git noch in diesem Dokument gespeichert.

Der direkt gespeicherte HTTP-Inhalt von `/profile.html` enthält am Dokumentende in dieser Reihenfolge:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/api/compliance-message-dispatch?runtime_config=1"></script>
<script src="profile.js?v=1.2"></script>
<script src="profile-data-rights.js?v=1"></script>
<script src="site-nav.js"></script>
```

Damit ist am ausgelieferten Artefakt bestätigt, dass die Runtime-Konfiguration als klassisches blockierendes Script vor `profile.js?v=1.2` geladen wird und das Datenschutzmodul erst danach folgt. Der gespeicherte Response enthält außerdem die Vercel-Markierung `data-deployment-id="dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK"`; der Nachweis gehört damit zum vorgesehenen festen technischen Deployment und nicht zu einem beweglichen Branch-Alias.

Bereits zuvor war am selben festen Deployment `profile.js?v=1.2` semantisch ausgeliefert bestätigt: `window.__dvAppDb=null`, Konfiguration ausschließlich aus `window.DV_SUPABASE`, Environment-/Host-/HTTPS-/URL-/Key-Prüfung, Fail-closed und `createClient(config.url,config.key,...)` ohne Produktions-Fallback. Der Runtime-Endpunkt lieferte HTTP 200 mit `environment=preview` und ausschließlich `https://xhmjxrcskfhbovhitdej.supabase.co`.

Der abschließende GET-Abruf führte das HTML nicht als DUELVANTA-Anwendung aus. Es wurde keine DUELVANTA-Anmeldung, Profiländerung, Sessionaktion, Datenexport-, Lösch-, Zahlungs- oder Datenbankaktion ausgelöst.

**B01 ist damit geschlossen.**

## 5. Releaseblocker nach B01

- **B01 GESCHLOSSEN:** PROFILE-Preview-Isolation implementiert, lokal/CI geprüft und am festen ausgelieferten Preview-Artefakt nachgewiesen.
- **B02 OFFEN:** F02 – `prepare_account_deletion_data` setzt `profiles.username=null`, ohne den erforderlichen internen Freigabekontext für `guard_profile_username_direct_update`. Nächster isolierter Engineeringblock. Globalen Username-Schutz niemals entfernen; keinen echten Löschlauf zur Diagnose starten.
- **B03 OFFEN:** eigener standardmäßig deaktivierter Live-Paymentmodus; Schlüsselwechsel allein genügt nicht.
- **B04 OFFEN:** wirksamer main-Schutz mit PR-/CI-Pflicht, Force-Push-/Delete-Sperre und Notfallweg.
- **B05 OFFEN:** `.gitignore`, aktueller/historischer Secret- und Supply-Chain-Scan, echte Treffer gegebenenfalls rotieren.
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

## 6. Harte Rolloutgrenzen

Kein Merge und keine Änderung an main. PR #5 bleibt Draft. Keine Produktionsänderung, Domain-Promotion oder Live-Konfiguration. Keine Live-Zahlung, Live-Erstattung oder Live-Auszahlung. Stripe-Sandbox nicht reaktivieren. Keine Worker, Scheduler oder Warteschlangen aktivieren. Keine kostenpflichtigen Tarifwechsel. Keine Staging-Daten, Nutzer, Provider-IDs oder Secrets nach Produktion kopieren. Keine Secrets oder personenbezogenen Exporte ins öffentliche Repository. Payment-, Steuer-, Vertrags- und Refund-Belege nicht nachträglich mutieren. Kein zweiter Refundpfad. `v-logo.svg` und **COLLECT. TRADE. BATTLE.** unverändert lassen.

V5 Abschnitte 7 und 8 bleiben der verbindliche, NICHT ausgeführte Rollout-/Rollbackplan. B01 erteilt keine Produktionsfreigabe. NO-GO für Produktion und Live-Payments bleibt bestehen.

## 7. Nächster Arbeitsauftrag – B02 / F02 isoliert

1. Vor Änderungen aktuellen Branch-Head, PR-Draftstatus und main lesen; neuere Commits nur anhand ihres tatsächlichen Diffs einordnen, nichts zurücksetzen.
2. Gezielt die Löschfunktion `prepare_account_deletion_data`, `guard_profile_username_direct_update`, deren Trigger/Helper sowie `api/account-data-erasure.js` und bestehende Erasure-Tests lesen.
3. Minimalen Fix ausschließlich am kontrollierten Service-Role-Erasure-Pfad implementieren. Der globale Username-Schutz bleibt vollständig erhalten. Der interne Freigabekontext muss eng auf den autorisierten Löschpfad begrenzt und nach Verwendung sicher zurückgesetzt werden; keine allgemein nutzbare Browser-/authenticated-Umgehung schaffen.
4. Mit isolierter Testdatenbank einschließlich des echten Username-Triggers nachweisen: autorisierter Erasure-Pfad kann Username entfernen; normale direkte Username-Änderung bleibt blockiert; Fehler-/Rollbackpfade hinterlassen keinen wirksamen Freigabekontext; kein realer Nutzer-/Storage-/Auth-Löschlauf.
5. Nur notwendige Tests/CI-Pfadfilter ändern. Bestehende abgeschlossene Sandbox-/Payment-/TRADE-Abnahmen nicht wiederholen.
6. Technischen B02-Commit separat dokumentieren; automatische CI auswerten. B02 nur schließen, wenn Implementierung und Triggernachweis vollständig sind. Storage/Auth, Session-Entzug, Wiederanlauf, Fristablauf, gesetzliche Holds, Betreiber und Scheduler bleiben darüber hinaus eigenständige Erasure-/Release-Nachweise gemäß V5.

## 8. Dauerhafte Referenzen

- V4: `DUELVANTA_MASTERHANDOUT_V4_2026-09-15.md`, Commit `30d372aee483705565288cd00a71a282482d4ad4`.
- V5: `DUELVANTA_MASTERHANDOUT_V5_2026-09-15.md`, Commit `c26b97472f69cd13fa2f79e2b2705d742ab0c5ea`.
- Technischer B01-Checkpoint: `d108eba6033ea2d94d3a06e639202260e2d69717`.
- CI B01: Run #219 / `34955359914`.
- Festes technisches Preview: `dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK`.

Compact Development Mode bleibt verbindlich. Keine absolute Fehlerfreiheit oder unbelegte Produktionsfreigabe behaupten.
