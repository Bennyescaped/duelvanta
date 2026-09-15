# DUELVANTA – Masterhandout V6

Stand: 15.09.2026. B01 / PROFILE-Preview-Isolation: gezielte Korrektur implementiert, lokal geprüft und auf dem Entwicklungsbranch gesichert; automatische CI erfolgreich. **B01 bleibt offen, weil die Prüfung der tatsächlich ausgelieferten statischen PROFILE-Dateien am Vercel-Zugriffsschutz ausstand. NO-GO für Produktion und Live-Payments bleibt bestehen.**

## 1. Verbindlichkeit und exakter Arbeitsstand

Dieses Dokument ersetzt widersprechende B01-Statusangaben aus V5. V5 bleibt die verbindliche Detailreferenz für F02–F04, das vollständige Releaseblockerregister und den nicht ausgeführten Rollout-/Rollbackplan. V4 bleibt die Detailreferenz für bereits abgeschlossene Funktionsabnahmen. Keines dieser Dokumente erteilt eine Produktionsfreigabe.

| Kennung | Verifizierter Stand |
|---|---|
| Repository / Entwicklungsbranch | `Bennyescaped/duelvanta` / `marketplace-ux-v1` |
| Neuer technischer Codecheckpoint B01 | `d108eba6033ea2d94d3a06e639202260e2d69717` |
| Technischer Commit-Text | `Fix B01: isolate PROFILE runtime configuration and fail closed in previews` |
| Technischer Tree | `ff28c49a1b53ab21cc11b7232801cd568c825cec` |
| Unmittelbarer Parent / V5-Dokumentationscommit | `c26b97472f69cd13fa2f79e2b2705d742ab0c5ea` |
| Alter geprüfter technischer Checkpoint | `d1bb533c9ca69a9d33c99bd4378d419abeca897e` |
| V4-Dokumentationscommit | `30d372aee483705565288cd00a71a282482d4ad4` |
| Branch-Head unmittelbar vor Ablage V6 | `d108eba6033ea2d94d3a06e639202260e2d69717` |
| V6-Datei im Stammverzeichnis | `DUELVANTA_MASTERHANDOUT_V6_2026-09-15.md` |
| V6-Dokumentationscommit | Separater, nach dem technischen Checkpoint erzeugter Commit; über die Dateihistorie und die Ablagebestätigung ermitteln. Der obige technische SHA ist NICHT der V6-Dokumentationscommit. |
| PR #5 | Offen, Draft, nicht gemergt; nach dem technischen Push erneut gelesen |
| main | `50f88213571be13255bb52eb489cc28cca660001`; nach dem technischen Push direkt erneut gelesen und unverändert |
| Technisches B01-Preview | `dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK`, READY, Git-SHA exakt `d108eba6033ea2d94d3a06e639202260e2d69717` |
| Fester technischer Preview-Host | `duelvantav5vision-33t1a6azf-bennyescaped-3783.vercel.app` |
| CI des technischen Checkpoints | Scanner V16 Check, Run #219 / `34955359914`, completed / success, Versuch 1 |
| Vercel-Projekt / Team | `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd` / `team_VHCwSwfBWANJvmS3qdkpJ0dK` |
| Supabase-Staging | `xhmjxrcskfhbovhitdej`; ausschließlich dieses Projekt wurde lesend abgefragt |
| Produktions-Supabase | `enifiaqsnqtbzylnfrpi`; NICHT aufgerufen, abgefragt oder verändert |

Der technische Commit enthält ausschließlich die vier Dateien aus Abschnitt 2. Der Branch wurde ohne Force-Push vorwärts aktualisiert. Vorher bestätigte der tatsächliche Diff zwischen altem technischen Checkpoint und V5, dass dazwischen nur die beiden Masterhandouts V4 und V5 hinzugekommen waren. Es wurden keine parallelen Produktänderungen festgestellt oder überschrieben.

Die V6-Ablage ist eine separate reine Dokumentationsänderung. Automatische CI-/Preview-Reaktionen auf diesen späteren Dokumentationscommit sind nicht Bestandteil der oben genannten technischen Abnahme und werden in dieser Datei nicht vorweggenommen. Ein beweglicher Branch-Alias ist keine feste Deployment-ID.

## 2. Implementierter B01-Fix – eng begrenzter Umfang

| Geänderte Datei | Konkrete Änderung |
|---|---|
| `profile.html` | Lädt `/api/compliance-message-dispatch?runtime_config=1` als blockierendes klassisches Script vor `profile.js`. Ausschließlich die geänderte JS-Ressource erhält `profile.js?v=1.2`. |
| `profile.js` | Entfernt die fest eingebauten Client-URL-/Key-Fallbacks. Setzt einen eventuell alten `window.__dvAppDb` zunächst auf null. Prüft Runtime-Umgebung, tatsächlichen Seitenhost, exakte Projekt-URL und Publishable-Key-Format vor `createClient`. Erst danach wird der neue Client wieder als `window.__dvAppDb` bereitgestellt. |
| `tests/supabase-runtime-config-test.mjs` | Erweitert den bestehenden Test um tatsächliche PROFILE-Scriptausführung in lokalen Mocks, Negativfälle, Ladefolge und die Weitergabe an das bestehende Datenschutzmodul. |
| `.github/workflows/scanner-v16-check.yml` | Ergänzt ausschließlich die zwei fehlenden PR-Pfadfilter für `profile.js` und `tests/supabase-runtime-config-test.mjs`. Der bereits vorhandene Runtime-Testschritt bleibt bestehen. |

`profile-data-rights.js`, `site-nav.js` und `session-guard.js` wurden hinsichtlich der Clientweitergabe gelesen, aber nicht geändert. Das Datenschutzmodul übernimmt weiterhin ausschließlich `window.__dvAppDb` und beendet seine Initialisierung, wenn kein Client vorhanden ist. Keine neue API, keine zusätzliche Vercel-Funktion, keine Migration und keine Konfigurationsänderung an Supabase oder Zahlungen.

Der gesamte bisherige Funktionscode in `profile.js` nach der Clientbereitstellung ist bytegleich erhalten. Ebenso blieb das HTML abgesehen von Runtime-Einbindung und JS-Cacheversion unverändert. `profile.css?v=1.1` und `profile-data-rights.js?v=1` bleiben unverändert. Die bisherigen Auth-Optionen `persistSession`, `autoRefreshToken` und `detectSessionInUrl` bleiben jeweils true.

### Host- und Konfigurationsgrenzen

Preview und lokale Entwicklung akzeptieren ausschließlich die exakte Staging-URL. Ein vollständig als production gekennzeichneter Runtime-Payload wird auf einem Preview-Host ebenfalls abgewiesen. Fehlende/ungültige Konfiguration führt vor jeder Client- oder Sessioninitialisierung zum Abbruch; ein alter veröffentlichter Client wird nicht weiterverwendet.

Die Produktionsprojektkennung in der Validierung ist nur ein Vergleichswert, kein Fallback. Der Client erhält URL und Key ausschließlich aus `window.DV_SUPABASE`.

Produktionskonfiguration wird nur über HTTPS und auf den vier in diesem Block über Vercel gelesenen Produktionsaliasen akzeptiert:

- `duelvanta.de`
- `duelvantav5vision.vercel.app`
- `duelvantav5vision-bennyescaped-3783.vercel.app`
- `duelvantav5vision-git-main-bennyescaped-3783.vercel.app`

Andere Hosts, einschließlich beliebiger unveränderlicher Deployment-Hosts, sind nicht für Produktionskonfiguration freigegeben. Das ist eine bewusste Fail-closed-Grenze. Spätere Domainänderungen und ein künftiger nicht öffentlicher Produktionsbuild müssen diese Hostprüfung ausdrücklich berücksichtigen und lokal prüfen; keine automatische Kompatibilität mit zusätzlichen Domains behaupten. Publishable-Key-Formatprüfung ist keine kryptografische Zuordnungsprüfung eines Keys zum Projekt; die Verbindungs-URL bleibt strikt auf das erlaubte Projekt begrenzt.

## 3. Tatsächlich ausgeführte lokale Prüfungen

Die lokale Arbeitsumgebung enthielt einen gezielten, anhand der Git-Blob-SHAs abgeglichenen Dateisnapshot, keinen vollständigen Repository-Checkout. Es wurden keine produktiven oder Staging-Nutzeraktionen als Test ausgeführt. Node-Version lokal: 22.16.0.

Ausgeführt und erfolgreich:

```text
node --check profile.js
node --check profile-data-rights.js
node --check tests/supabase-runtime-config-test.mjs
node --check api/compliance-message-dispatch.js
node tests/supabase-runtime-config-test.mjs --profile-only
```

Der lokale Modus `--profile-only` überspringt ausschließlich die unveränderten älteren Seiten-Quelltextprüfungen. Alle neuen PROFILE-Tests und die Runtime-Endpunkt-Mocks laufen auch in diesem Modus. In GitHub Actions ist dieser verkürzte Modus ausdrücklich verboten; die bestehende CI führt den vollständigen Test ohne diesen Parameter aus.

Nachgewiesen im lokalen Mock:

- Gültige Preview-Runtime erzeugt genau einen Staging-Client; die bisherigen Auth-Optionen, Clientweitergabe und nicht angemeldete Weiterleitung bleiben erhalten.
- 22 ungültige Konfigurationen erzeugen null Clients, null Sessionabfragen und keine Profil-/Datenschutzhandler. Geprüft wurden unter anderem fehlende/null/leere Konfiguration, falsche Typen, Produktions-/HTTP-/fremde/ähnliche URLs, Pfadanhänge, leere/ungültige/Secret-förmige Keys sowie falsche oder fehlende Umgebungsangaben.
- Der tatsächliche Produktions-Runtime-Payload aus dem lokal aufgerufenen Handler wird auf dem Preview-Host abgewiesen. Zusätzlich geprüft: Branch-Alias, Lookalike-Host und localhost. Auch ein fehlgeschlagener Runtime-Payload lässt keinen Client verfügbar.
- Alle vier zugelassenen Produktionsaliase funktionieren mit Produktionskonfiguration ausschließlich im lokalen Mock. Produktionshosts mit Staging-Konfiguration oder HTTP werden abgewiesen. Lokale Entwicklung bleibt Staging-only.
- Runtime-Script vor Profilmodul vor Datenschutzmodul; kein async/defer/module-Rennen; gezielte Cacheversion; genau eine Clienterzeugung.
- Export-, Löschantrags- und Abmeldehandler verwenden im lokalen Spy denselben Client. RPC, Download, Blob, UUID und signOut waren ausschließlich Mocks; keine echten Exporte, Löschanträge oder Abmeldungen.
- Relevante CI-Pfadfilter und der vollständige Runtime-Testaufruf sind vorhanden.

Ergebnis des lokalen Testlaufs:

```text
PASS: PROFILE runtime ordering, shared client, 22 invalid configurations, failed/mislabeled runtime, staging-only previews and four local production aliases
PASS: focused PROFILE/runtime checks (legacy page source scans reserved for full CI)
```

Die vier auf GitHub gespeicherten Dateiblobs wurden anschließend mit den lokal getesteten Dateien abgeglichen. Kein vollständiger Browser-/Profilfunktionstest mit einem echten Account wurde behauptet.

## 4. Automatische CI-Evidenz

Run #219 / `34955359914` gehört zum technischen SHA `d108eba6033ea2d94d3a06e639202260e2d69717` und zum Entwicklungsbranch. Beide Jobs waren erfolgreich:

| Job | ID | Ergebnis |
|---|---|---|
| validate | `104336000155` | success |
| quota_database | `104336000265` | success |

Der vorhandene Schritt **Trade contracts and mobile order flow**, der `node tests/supabase-runtime-config-test.mjs` ohne Einschränkung enthält, wurde ausdrücklich als success gelesen. Damit sind auch die unveränderten älteren Runtime-Seitenprüfungen in CI erfasst. Die für Push-Ereignisse vorbehaltenen Live-Katalogschritte waren in diesem PR-Lauf übersprungen.

Es wurde kein manueller CI-Neulauf gestartet. Die weiteren Tests liefen als Bestandteil der bestehenden automatischen Pipeline, nicht als erneute manuelle Stripe-Sandbox-Abnahme. Ihre Ergebnisse erweitern den fachlichen Abnahmeumfang nicht automatisch.

## 5. Preview-Evidenz und noch fehlender B01-Nachweis

Vercel bestätigte für `dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK`: READY, Quellbranch `marketplace-ux-v1`, exakter technischer Git-SHA `d108eba6033ea2d94d3a06e639202260e2d69717`, Preview/target null und weiterhin zwölf Node-Funktionen. Es erfolgte keine Domain-Promotion.

Am festen technischen Preview-Host wurde der bestehende Runtime-Endpunkt nach der lokalen Absicherung lesend abgerufen:

| Abruf | Ergebnis |
|---|---|
| `/api/compliance-message-dispatch?runtime_config=1` | HTTP 200; `environment=preview`; URL ausschließlich Staging; JavaScript-Antwort mit eingefrorenem `DV_SUPABASE`; `Cache-Control: private, no-store, max-age=0`; `X-Content-Type-Options: nosniff` |
| `/profile.html` | HTTP 302 auf Vercel-SSO, kein ausgeliefertes PROFILE-HTML erhalten |
| `/profile.js?v=1.2` | HTTP 302 auf Vercel-SSO, kein ausgeliefertes Profilscript erhalten |

Auch der autorisierte Share-Link-Abruf lieferte beim HTML eine SSO-Weiterleitung. Danach wurden die wiederholten Abrufversuche beendet. Der Zugriffsschutz wurde nicht abgeschaltet. Es wurde keine Benutzer-/Produktionssession geöffnet und kein Auth-/Profilvorgang ausgelöst. Kurzlebige Share-Token und Cookies gehören nicht in dieses Dokument oder das Repository.

**Offen bleibt ausschließlich innerhalb dieses B01-Blocks:** Die tatsächlich ausgelieferten statischen PROFILE-Dateien des korrigierten Preview-Artefakts gegen den geprüften Quellstand abgleichen und damit Ladefolge/Cacheversion/Guard im bereitgestellten Artefakt bestätigen. Ein READY-Status plus korrekter Runtime-Endpunkt ersetzt diesen fehlenden Nachweis nicht. Deshalb wird B01 nicht geschlossen.

Für den späteren Abgleich gelten diese exakten Git-Blob-SHAs:

| Datei | Git-Blob-SHA am technischen Checkpoint |
|---|---|
| `profile.html` | `9f411966b05247099603751dff3c81ccf33620b9` |
| `profile.js` | `4e81afcddcd18ad4e106f07047576d87722dacf9` |
| `profile-data-rights.js` – unverändert | `bc7b6735fad700ab343c4fe0b511db2659efb87d` |
| `tests/supabase-runtime-config-test.mjs` | `b0330f40a351d42a47c19b49dc8ac8533e2e4538` |
| `.github/workflows/scanner-v16-check.yml` | `030970c062adfbdbdecb9d3906cf8626c34ed93e` |

Das zuvor in V5 noch nicht abschließend verifizierte V5-Dokumentationspreview wurde in diesem Block zusätzlich anhand seiner Metadaten zugeordnet: `dpl_4ciyjevkm6JX59rR7aGo8GHZ6ts5`, READY, SHA `c26b97472f69cd13fa2f79e2b2705d742ab0c5ea`. Es ist NICHT das korrigierte B01-Preview. Ältere technische/V4-Preview-IDs bleiben als historische Referenzen in V5 erhalten.

## 6. Stagingwerte und unveränderte Grenzen

Nach dem technischen Push wurde ausschließlich auf Staging folgende SELECT-Abfrage ausgeführt:

```sql
select sandbox_enabled, live_mode, platform_fee_tax_treatment,
       seller_invoice_issuance_enabled
from dv_market_private.market_payment_configuration
where singleton = true;
```

Direkt bestätigtes Ergebnis: `sandbox_enabled=false`, `live_mode=false`, `platform_fee_tax_treatment=review_required`, `seller_invoice_issuance_enabled=false`. `seller_onboarding_enforced=false` ist weiterhin der zuletzt in V5 dokumentierte Wert, nicht in diesem Block frisch abgefragt.

Kein Merge und keine Änderung an main, Produktions-Supabase, Domains oder Live-Konfiguration. Keine reale Zahlung, Erstattung, Auszahlung, E-Mail, Exportanforderung, Profiländerung oder Kontolöschung als Test. Keine Aktivierung von Stripe-Sandbox, Worker, Scheduler oder Warteschlangen; kein Tarifwechsel und keine Buchung. Keine Staging-Daten, Nutzer oder Provider-IDs nach Produktion übertragen.

Payment-, Steuer-, Vertrags- und Refund-Belege bleiben unverändert. Kein zweiter Refundpfad. Keine Secrets, personenbezogenen Exporte oder Backups ins öffentliche Repository. `v-logo.svg` bleibt unverändert; Slogan bleibt **COLLECT. TRADE. BATTLE.** COLLECT, BATTLE und stabile TRADE-/PROFILE-Funktionen wurden nicht nebenbei umgebaut.

Die effektiven Worker-ENV-Werte, externe Scheduler und E-Mail-Domain-/Zustellfreigaben wurden hier nicht unabhängig geprüft. Aus einem fehlenden `cron.job` oder vorhandenen ENV-Schaltern darf keine vollständig nachgewiesene doppelte Abschaltung abgeleitet werden.

## 7. Releaseblocker – Status nach diesem Arbeitsblock

| ID | Status / weiterhin erforderlicher Nachweis |
|---|---|
| B01 | **Offen, Implementierung und CI erfolgreich:** statische Artefaktprüfung des korrigierten PROFILE-Previews fehlt; siehe Abschnitt 5. |
| B02 | **Offen:** Username-Triggerkonflikt im Lösch-Worker; anschließend Storage/Auth, Session-Entzug, Wiederanlauf, Fristablauf, gesetzliche Holds, verantwortlicher Betreiber und Scheduler gesondert abnehmen. |
| B03 | **Offen:** eigener standardmäßig deaktivierter Live-Paymentmodus mit getrennten Umgebungen, unveränderlichen Belegen und separater Abnahme. |
| B04 | **Offen:** wirksamer main-Schutz mit PR-/CI-Pflicht, Force-Push-/Delete-Sperre und Notfallweg. Die zwei korrigierten CI-Pfadfilter schließen diesen Governanceblocker nicht. |
| B05 | **Offen:** `.gitignore` erweitern; vollständiger aktueller und historischer Secret-/Supply-Chain-Scan; echte Treffer prüfen und gegebenenfalls rotieren. Öffentliche Publishable Keys nicht als Service-Role-Secrets behandeln. |
| B06 | **Offen:** tatsächliche Produktions-Auth-/Berechtigungsprüfung; MFA/Step-up, Session-/Recovery-/Passwortschutz und begründete Advisor-Ausnahmen. Keine pauschale Entfernung funktionsnotwendiger RPC-Rechte. |
| B07 | **Offen:** qualifizierte rechtliche Schlussprüfung von Rollen, Bedingungen, C2C/B2C-Informationen, Widerruf, Bestätigung, DSA, Datenschutz, Dienstleisterverträgen, Transfers und gegebenenfalls Consent. |
| B08 | **Offen:** steuerliche Schlussprüfung von Gebührenmodell, Umsatzsteuer, Belegketten, PStTG/DAC7-Sorgfalt, Exporten, Fristen und Retention. `review_required` bleibt; keine pauschale 19-Prozent-Regel. |
| B09 | **Offen:** tatsächlicher Betreiber-/Gewerbestatus des vorgesehenen Einzelunternehmens von Benjamin Fritz, Betriebsbeginn und finale Betreiberangaben nachweisen; Anmeldung nicht als erledigt behandeln. |
| B10 | **Offen:** kommerziell zulässiger Hostingtarif, freigegebenes Kostenbudget und Providerlimits. V5 dokumentierte Hobby; kein Tarifwechsel in diesem Block. |
| B11 | **Offen:** reale Produktionsbaseline, exaktes Delta-/Checksum-Migrationsmanifest, Schema-/Auth-/Storage-/RLS-/Key-/Laufzeitzuordnung. Keine Staging-Vollkopie. |
| B12 | **Offen:** gesonderte Live-Stripe-Geschäfts-/Connect-Freigabe, Kontozuordnung, API-Version, getrennte Secrets, Signaturen, Events, Gebühren und Support-/Disputezuständigkeit; ausdrückliche spätere Live-Autorisierung. |
| B13 | **Offen:** E-Mail-Domain/DNS und Vertrag, geschützter POST-Scheduler, Retry-/Deduplizierung, Bounce-/Delivery-Rückmeldung und Alerts. Providerannahme ist kein Zustellbeleg; Cron-GET nicht ungeprüft mit POST-only-Handler verbinden. |
| B14 | **Offen:** Monitoring, Alarmempfänger, Vertretung und Vorfallsrunbook für Zahlungs-/Webhook-, Outbox-, Erasure- und Sicherheitsfehler; keine Secrets oder personenbezogenen Rohdaten in Logs. |
| B15 | **Offen:** kompatibler Rückfallstand, DB- UND Storage-Restoreprobe, RPO/RTO und wirksame serverseitige Schreibsperre einschließlich direkter RPCs. F04 beachten. |

Die Verantwortungszuordnung aus V5 bleibt bestehen: Engineering für technische Nachweise; Benjamin Fritz als Betreiber für Betreiber-/Betriebs-/Tarifentscheidungen; qualifizierte Rechts-/Steuerprüfung und Stripe für ihre jeweiligen Freigaben. Externe Nachweise privat und datiert führen, nicht als sensible Unterlagen öffentlich committen.

### Unveränderte Befunde F02–F04

F02: `prepare_account_deletion_data` setzt `profiles.username=null`, ohne den erforderlichen internen Freigabekontext für `guard_profile_username_direct_update`. Dieser bestätigte Konflikt wurde hier NICHT behoben. Späterer Fix ausschließlich am kontrollierten Service-Role-Erasure-Pfad mit isoliertem Test inklusive echtem Trigger. Niemals den globalen Username-Schutz entfernen oder einen echten Löschlauf zur Diagnose starten.

F03: Checkout, Webhook und Datenbank erzwingen derzeit den Testmodus. Schlüsselwechsel allein implementiert keinen Live-Modus. Neue Zahlungsaufträge müssen später unabhängig von bereits laufenden Providerereignissen gestoppt werden können. Vorhandenen Refundpfad beibehalten.

F04: Der alte Frontendstand ist nach den neuen Migrationen nicht automatisch rollback-kompatibel; insbesondere ist die alte Ausführungsberechtigung von `buy_market_listing_v2(...)` nicht automatisch wieder da. Kein unkontrolliertes Wiederöffnen des alten Compliance-umgehenden Kaufpfads.

## 8. Abgeschlossene Abnahmen und Rolloutgrenzen bleiben erhalten

Die in V4 dokumentierten Abnahmen bleiben in ihrem geprüften Umfang geschlossen: Stripe-Onboarding; erfolgreiche/fehlgeschlagene Testzahlung; Webhook-Idempotenz; vollständiger Refund und Reconciliation; Teilrefund- und Payout-Schutz; Datenexport und Löschblocker; geprüfte RLS-/Browsergrenzen; Order-Lifecycle mit Payment-Gates und Benachrichtigungen; Verkäufer-Versandprofile; Combined Shipping mit Fallback; Resolution-UX und TRADE Mobile/Desktop.

Sie wurden nicht als reale Abnahmestrecke wiederholt. Sie beweisen weder sämtliche Preview-Seiten noch den vollständigen Lösch-Worker oder Live-Payments. Ein tatsächlicher unbefugter Produktionszugriff durch F01 wurde auch in diesem Block weder festgestellt noch ausprobiert.

**V5 Abschnitte 7 und 8 bleiben vollständig verbindlicher, NICHT ausgeführter Rollout-/Rollbackplan.** Insbesondere:

- Erst sämtliche erforderlichen Blocker und externen Freigaben schließen, dann einen neuen exakten Releasekandidaten bilden. Vor Merge Produktionsbereitstellung und Domainfreigabe kontrolliert entkoppeln; sichere Schreibsperre einschließlich direkter RPCs und DB-/Storage-Restore nachweisen.
- Nur ein anhand der tatsächlichen Produktionsbaseline freigegebenes Delta-/Checksum-Manifest anwenden. Die SQL-Reihenfolge und Journal-Einschränkungen aus V5 gelten unverändert; kein blindes Wiederabspielen und keine Staging-Vollkopie. B01 fügt keine Migration hinzu. Künftige B02-/Live-Patches erst nach Erstellung und Prüfung ergänzen.
- Auth, Storage und Umgebungs-/Keyzuordnung kontrollieren. Worker bleiben aus. Produktionsbuild, technische Domainfreigabe, Zustell-/Moderationsbetrieb, Erasure-Betrieb, kommerzieller Start und Live-Payments sind getrennte spätere Freigabeschritte. Die neue PROFILE-Hostprüfung aus Abschnitt 2 in die spätere Build-/Domainprüfung einbeziehen.
- Bei Projekt-/Key-Vermischung, unberechtigtem Zugriff, falschen Beträgen, Belegmutation, unsicherer Migration, unerwarteter Löschung, fehlender Zustellung oder neuem kritischem Fehler stoppen. Keine Live-Zahlung zur Diagnose.
- Nur auf einen exakt bezeichneten kompatibilitätsgeprüften Produktionsbuild zurückfallen. Keine automatische Datenvernichtung, kein blindes Revert/Force-Push und kein unkontrolliertes Regrant alter Kauf-RPCs. Laufende Providerereignisse authentisiert sichern/verarbeiten und idempotent abgleichen; kein automatischer Doppelrefund oder erneuter Zahlungsauftrag.
- Desaster-Restore nur nach gesonderter Entscheidung; DB und Storage getrennt behandeln und danach Providerereignisse abgleichen. RPO/RTO und Wiederherstellungsfähigkeit bleiben Nachweispflichten, keine gemessenen Zusagen.

Kein vollständiger Secret-/Historien-Scan, keine vollständige Produktionskonfigurationsprüfung und keine rechtliche oder steuerliche Schlussfreigabe wurden in diesem B01-Block durchgeführt.

## 9. Exakter nächster Arbeitsauftrag

**Zuerst nur den noch offenen B01-Nachweis abschließen, nicht erneut den Fix entwickeln.**

1. Dieses V6-Dokument vollständig lesen; einbringenden V6-Dokumentationscommit, tatsächlichen Branch-Head, main und PR-Draftstatus lesend prüfen. Neuere Änderungen anhand des tatsächlichen Diffs einordnen; nichts überschreiben oder zurücksetzen.
2. Am festen technischen Deployment `dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK` über einen autorisierten Abrufweg ausschließlich die statischen PROFILE-Ressourcen verifizieren. Kein Abschalten von Zugriffsschutz, keine Produktionssession, keine echte Profil-/Datenschutzaktion. Kurzlebige Zugangsparameter nicht in Git speichern.
3. Ausgeliefertes HTML/JS mit den Quellblobs in Abschnitt 5 abgleichen. Bereits erfolgreiche lokale Tests und Run #219 nicht ohne neue Regression wiederholen. READY, korrekte Runtime und Quellcodeprüfung nicht mit dem fehlenden statischen Auslieferungsnachweis gleichsetzen.
4. B01 nur bei vollständigem Nachweis schließen und den Abschluss dokumentieren. Bei weiterhin blockiertem Abruf den Punkt ausdrücklich offen halten; keine unbelegte Freigabe.
5. Erst danach B02 als eigenen Arbeitsblock beginnen: Triggerkonflikt gezielt beheben, mit echtem Trigger in isolierter Testdatenbank prüfen; kein realer Löschlauf und keine Lockerung des globalen Username-Schutzes. B03–B15 bleiben eigenständige offene Freigabepunkte.

Compact Development Mode bleibt verbindlich: kurze Meldungen, gezielte Patches und Tests, bestehende Verbindungen nutzen, keine unnötigen Login-/Stripe-/Browser-Schleifen, keine abgeschlossenen realen Tests wiederholen und keine absolute Fehlerfreiheit behaupten.

## 10. Dauerhafte Referenzen

- V4: `DUELVANTA_MASTERHANDOUT_V4_2026-09-15.md`, Dokumentationscommit `30d372aee483705565288cd00a71a282482d4ad4`.
- V5: `DUELVANTA_MASTERHANDOUT_V5_2026-09-15.md`, Dokumentationscommit `c26b97472f69cd13fa2f79e2b2705d742ab0c5ea`.
- Technischer B01-Diff: https://github.com/Bennyescaped/duelvanta/compare/c26b97472f69cd13fa2f79e2b2705d742ab0c5ea...d108eba6033ea2d94d3a06e639202260e2d69717
- Technische CI: https://github.com/Bennyescaped/duelvanta/actions/runs/34955359914
- PR: https://github.com/Bennyescaped/duelvanta/pull/5 — der ältere Beschreibungstext ist kein Ersatz für V5/V6.
- Technisches Preview: https://duelvantav5vision-33t1a6azf-bennyescaped-3783.vercel.app — kein beweglicher Alias, keine Produktionsfreigabe.

Primäre Nachweise dieses Blocks sind die tatsächlichen GitHub-Dateien/Diffs/Metadaten, der lokale Mocktest, der automatische CI-Lauf, Vercel-Deployment-/HTTP-Antworten und die eng begrenzte lesende Stagingabfrage. Die externen rechtlichen und betrieblichen Referenzen aus V5 bleiben dort dokumentiert und wurden hier nicht als neue Schlussprüfung ausgegeben.
