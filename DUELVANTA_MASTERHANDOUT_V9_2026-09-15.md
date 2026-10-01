# DUELVANTA – Masterhandout V9

Stand: 15.09.2026, nach vollständigem Abschluss von B01, B02, B03 und B04. Dieses Dokument ist der verbindliche Einstieg für den nächsten Chat und ersetzt widersprechende Statusangaben älterer Handouts. V4–V8 bleiben Detailreferenzen, soweit V9 sie nicht ausdrücklich aktualisiert.

## 1. Verbindlicher Repository- und Release-Stand

- Repository: Bennyescaped/duelvanta
- Entwicklungsbranch: marketplace-ux-v1
- Branch-Head vor Erstellung von V9: 33def25cbb173316e28dc3f41b1d76bbfd217465
- Technischer B03-Abschluss-Head: c8a8a02fa4f5b21813ba253e66767a8ee61d95b7
- V8-Dokumentationscommit / Branch-Head vor B04-Abschluss: 33def25cbb173316e28dc3f41b1d76bbfd217465
- PR #5: open, Draft, nicht gemergt
- PR #5 Base: main
- PR #5 Head vor V9: 33def25cbb173316e28dc3f41b1d76bbfd217465
- main: 50f88213571be13255bb52eb489cc28cca660001, unverändert
- Staging Supabase: xhmjxrcskfhbovhitdej
- Produktion Supabase: enifiaqsnqtbzylnfrpi
- B03 technischer CI-Abschluss: Scanner V16 Check #245 / Run-ID 34966761267 = success
- V7-Dokumentationsstand: Scanner V16 Check #246 / Run-ID 34967049764 = success
- B04 GitHub Ruleset: Protect main, Ruleset-ID 23447544, Active
- Effektive Ruleset-Ansicht: https://github.com/Bennyescaped/duelvanta/rules/23447544?ref=refs%2Fheads%2Fmain

V9 selbst ist Dokumentation. Der V9-Dokumentationscommit ist der Commit, der diese Datei auf marketplace-ux-v1 anlegt; er ist kein neuer fachlicher oder technischer Abnahmepunkt.

## 2. Harte Projektgrenzen – unverändert

- Kein Merge und keine Änderung an main im Rahmen der laufenden Release-Vorbereitung.
- PR #5 bleibt Draft, bis die offenen Releaseblocker ausdrücklich abgeschlossen sind.
- Keine Produktionsänderung, keine Domain-Promotion und keine produktive Supabase-Migration.
- Keine Live-Zahlung, Live-Erstattung oder Live-Auszahlung.
- Stripe-Sandbox nicht reaktivieren, sofern kein ausdrücklich neuer Abnahmeschritt dies verlangt.
- Keine Worker, Scheduler oder Warteschlangen aktivieren.
- Keine kostenpflichtigen Tarifwechsel ohne ausdrückliche Betreiberfreigabe.
- Keine Staging-Daten, Nutzer, Provider-IDs oder Secrets nach Produktion kopieren.
- Keine Secrets oder personenbezogenen Exporte ins öffentliche Repository.
- Payment-, Steuer-, Vertrags- und Refund-Belege nicht nachträglich mutieren.
- Kein zweiter Refundpfad.
- v-logo.svg niemals verändern oder nachbauen.
- Slogan unverändert: COLLECT. TRADE. BATTLE.
- COLLECT, BATTLE, PROFILE und stabile TRADE-Bereiche nicht nebenbei redesignen.
- V5 Abschnitte 7 und 8 bleiben der verbindliche, noch NICHT ausgeführte Rollout-/Rollbackplan.
- NO-GO für Produktion und Live-Payments bleibt bestehen.

Compact Development Mode bleibt verbindlich: gezielte Prüfungen, minimale Änderungen, keine bereits grünen unveränderten Abnahmen manuell wiederholen und keine unnötigen Login-/Provider-Schleifen.

## 3. B01 – GESCHLOSSEN: PROFILE-Preview-Isolation

B01 nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.

Gesichert:

- profile.html lädt Runtime-Konfiguration vor profile.js?v=1.2, anschließend profile-data-rights.js?v=1.
- profile.js besitzt keinen festen Produktions-Supabase-Fallback und initialisiert den Client nur aus validiertem window.DV_SUPABASE.
- Preview-/Produktionsgrenzen inklusive Negativtests wurden erfolgreich geprüft.
- Festes technisches Preview: Deployment-ID dpl_A1ow6bsPtSttqWJK4skuvmwbnmtK, Host duelvantav5vision-33t1a6azf-bennyescaped-3783.vercel.app.
- Technischer B01-Checkpoint: d108eba6033ea2d94d3a06e639202260e2d69717.
- Runtime-Endpunkt und ausgelieferte PROFILE-Ladefolge verweisen auf Staging xhmjxrcskfhbovhitdej.
- B01 CI: Scanner V16 Check #219 / 34955359914 = success.
- Kein echter Profil-, Export-, Lösch-, Zahlungs- oder Datenbankvorgang wurde zur Auslieferungsprüfung ausgeführt.

## 4. B02 – GESCHLOSSEN: Erasure/Username-Guard

B02 nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.

Ausgangsfehler: prepare_account_deletion_data(...) wollte profiles.username=null setzen, wurde aber durch guard_profile_username_direct_update blockiert.

Finale Lösung:

- Datei: database/account-data-erasure-username-guard-v1.sql
- globaler Username-Trigger bleibt vollständig erhalten;
- Erasure-RPC setzt den transaktionslokalen Kontext duelvanta.username_rpc=allowed nur innerhalb des bereits geschützten Löschpfads;
- Kontext wird nach Erfolg und im Fehlerpfad wieder geleert;
- Request-/Lock-Token-Grenze bleibt erhalten;
- public, anon, authenticated: kein EXECUTE;
- service_role: EXECUTE;
- SECURITY-DEFINER-Owner auf realem Staging: postgres.

Wichtig: Die zwischenzeitliche Prüfung current_user='service_role' wurde entfernt, weil current_user innerhalb einer SECURITY-DEFINER-Funktion den Funktionsowner repräsentiert und nicht den PostgREST-Aufrufer.

Test:

- tests/account-data-erasure-username-guard-test.mjs
- prüft echten Trigger, ACL, SECURITY-DEFINER-Semantik, Erfolgsweg, Fehler-Rollback und erneute Blockierung direkter Username-Änderungen.

B02 technischer Abschluss-Head: 24c1a6ef0fc437e13f56d18aa23e255dfc7d610c.
B02 CI: Scanner V16 Check #228 / 34964941036 = success.

Kein echter Account-, Storage- oder Auth-Löschlauf wurde ausgeführt.

## 5. B03 – GESCHLOSSEN: expliziter fail-closed Stripe-Live-Modus

B03 nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.

### 5.1 Zentrale API-Grenze

api/market-stripe-lib.js enthält jetzt stripeMode(action).

Modi:

- Sandbox-Master: STRIPE_CONNECT_SANDBOX_ENABLED=true
- Live-Master: STRIPE_CONNECT_LIVE_ENABLED=true
- beide gleichzeitig => stripe_mode_conflict
- beide aus => Stripe bleibt deaktiviert
- Sandbox verlangt sk_test_...
- Live verlangt sk_live_...

Ein Live-Key allein reicht ausdrücklich nicht zur Aktivierung.

Zusätzliche Live-Aktionsschalter:

- STRIPE_CONNECT_LIVE_ONBOARDING_ENABLED=true
- STRIPE_CONNECT_LIVE_PAYMENTS_ENABLED=true
- STRIPE_CONNECT_LIVE_REFUNDS_ENABLED=true
- STRIPE_CONNECT_LIVE_WEBHOOKS_ENABLED=true

Die Aktionsschalter sind getrennt. Insbesondere kann der Webhook-Empfang für bereits ausgelöste Providerereignisse unabhängig von neuen Payments freigegeben werden.

### 5.2 Bestehende Routen bleiben erhalten

Es wurde kein zweiter Payment- oder Refundpfad geschaffen.

- api/market-stripe-onboarding.js nutzt stripeMode('onboarding') und erzwingt DB-/Provider-Modusgleichheit.
- api/market-stripe-checkout.js nutzt stripeMode('payments'), erzwingt prepared.live_mode passend zum API-Modus und bindet Session-Präfixe cs_test_ / cs_live_.
- api/market-stripe-refund.js nutzt weiterhin den bestehenden Refundpfad mit stripeMode('refunds') und DB-Modusabgleich.
- api/market-stripe-webhook.js nutzt stripeMode('webhooks'), Signaturprüfung und verlangt, dass event.livemode exakt dem konfigurierten Modus entspricht.

### 5.3 DB-Live-Migration – REVIEW ONLY

Datei: database/market-stripe-live-mode-v1.sql

Diese Datei wurde nicht auf Staging und nicht auf Produktion angewendet. Sie lief ausschließlich in isolierten PGlite-Tests.

Wesentliche Grenzen:

- market_payment_configuration: Sandbox und Live können nie gleichzeitig aktiv sein.
- live_mode wird auf Onboarding-Requests und Payment-Attempts persistiert.
- Connected Accounts sind nach seller_id und live_mode getrennt.
- prepare_market_stripe_payment bindet Idempotency, Verkäuferkonto und Attempt an den Modus.
- bind_market_stripe_checkout_session akzeptiert nur zum Attempt passende cs_test_-/cs_live_-IDs.
- apply_market_stripe_event bindet Account, Event und Attempt an denselben Modus.
- Bereits bestehende Providerereignisse können nach Deaktivierung neuer Payments noch verarbeitet werden.
- Steuer-/Providerbelege tragen den verwendeten live_mode.
- prepare_market_stripe_full_refund bleibt der einzige Refund-Vorbereitungspfad.
- Backend-RPCs bleiben nicht browserseitig ausführbar.

### 5.4 B03 Tests / CI

Neue Tests:

- tests/market-stripe-live-mode-api-test.mjs
- tests/market-stripe-live-mode-database-test.mjs

Zusätzlich wurde tests/market-stripe-connect-contract-test.mjs um die Live-Grenzen erweitert.

Nachgewiesen:

- Live-Key allein => keine Provideraktion.
- Live-Master ohne Aktionsgate => keine Provideraktion.
- falscher Key-Typ => Block vor Providerzugriff.
- API- und DB-Modus müssen übereinstimmen.
- Sandbox + Live gleichzeitig => fail-closed.
- falsches Checkout-Session-Präfix => blockiert.
- Wrong-mode Webhook verändert den fremden Attempt nicht und wird als unmatched/ignored protokolliert.
- laufende Live-Providerereignisse können verarbeitet werden, nachdem neue Payments abgeschaltet wurden.
- Refund bleibt im bestehenden mode-bound Pfad.

CI-Pfadfilter enthält jetzt auch tests/market-stripe-*.mjs.

Technischer B03-Abschluss-Head:
c8a8a02fa4f5b21813ba253e66767a8ee61d95b7

Finaler B03-Lauf:

- Scanner V16 Check #245
- Run-ID 34966761267
- Gesamtergebnis: success
- quota_database: success
- validate: success
- Trade contracts and mobile order flow: success
- neue Live-Mode-API-/DB-Tests: success
- bestehende Sandbox-, Refund-, Webhook-, Marketplace-, Compliance-, Auth-, Browser- und Scanner-Regressionen: success.

V7-Dokumentationshead f2c602c4109f854773ad6419a2345cdc0ed46fc4 erhielt danach ebenfalls einen vollständigen erfolgreichen PR-CI-Lauf #246 / 34967049764.

Im gesamten B03 wurden keine Stripe-Sandbox oder Live-Zahlungen aktiviert, keine echten Zahlungen/Refunds/Payouts ausgelöst, keine Stripe-Accounts erzeugt, keine Staging-DDL ausgeführt und keine Produktion verändert.

## 6. B04 – GESCHLOSSEN: GitHub Release-Governance

B04 nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.

### 6.1 Vorzustand

Vor B04 war main ungeschützt:

- main protected=false
- keine klassische Branch-Protection
- Required Status Checks: enforcement off
- Repository-Rulesets: leer
- keine Schutzkonfiguration geändert bis zum V8-Stand

### 6.2 Aktivierter Ruleset

Am 15.09.2026 wurde im GitHub Cloud Browser durch den Repository-Owner der folgende Branch Ruleset tatsächlich angelegt und gespeichert:

- Name: Protect main
- Ruleset-ID: 23447544
- Enforcement status: Active
- Target: Include Default
- Effektives Ziel: genau 1 Branch, main
- Bypass list: empty
- Required approvals: 0
- Allowed merge methods: Merge, Squash, Rebase
- Require branches to be up to date before merging: aus
- Do not require status checks on creation: aus

Aktive Branch-Regeln, exakt vier:

1. Restrict deletions
2. Require a pull request before merging
3. Require status checks to pass
4. Block force pushes

Erforderliche Status Checks, Quelle jeweils GitHub Actions:

- validate
- quota_database

Nicht aktiviert:

- Restrict creations
- Restrict updates
- Require linear history
- Require deployments to succeed
- Require signed commits
- Require code scanning results
- Require code quality results
- Restrict code coverage
- Merge Queue
- Copilot-Zusatzreview
- permanente Owner-, Admin-, Benutzer-, App- oder sonstige Bypass-Regel

### 6.3 Read-only-Nachweis nach Speicherung

Nach dem Speichern wurde die Konfiguration erneut read-only über GitHub verifiziert:

- GitHub-Bestätigung: Ruleset created
- gespeicherte Einstellungsseite: /Bennyescaped/duelvanta/settings/rules/23447544
- effektive Branch-Regelansicht: /Bennyescaped/duelvanta/rules/23447544?ref=refs%2Fheads%2Fmain
- Ruleset wird dort als Active angezeigt;
- Target zeigt Include: Default und Applies to 1 target: main;
- effektive Übersicht zeigt 4 branch rules targeting 1 branch;
- die vier aktiven Regeln werden in der effektiven Ansicht angezeigt;
- unter Require status checks to pass werden validate und quota_database jeweils mit Quelle GitHub Actions angezeigt;
- Bypass list ist leer;
- Branchübersicht zeigt bei main View rules.

Es wurden ausdrücklich keine absichtlichen Force-Push-, Direkt-Push- oder Delete-Tests gegen main durchgeführt.

main blieb während B04 unverändert bei 50f88213571be13255bb52eb489cc28cca660001. PR #5 blieb open, Draft und nicht gemergt. Produktion, Vercel, Supabase und Stripe wurden nicht verändert.

### 6.4 Verbindlicher Notfallweg

Normalbetrieb bleibt PR + verpflichtende CI.

Ein Bypass darf ausschließlich für einen echten Notfall temporär eingerichtet werden:

- so eng wie technisch möglich;
- bevorzugt For pull requests only;
- keine dauerhafte Owner-/Admin-Ausnahme;
- Ursache, Risiko, betroffene Änderung und Freigabe müssen im Emergency-PR dokumentiert werden;
- Bypass unmittelbar nach dem Emergency-PR wieder entfernen;
- anschließend Ruleset und Bypass-Liste read-only prüfen;
- die normale Schutzwirkung darf nicht dauerhaft deaktiviert werden.

## 7. Exakter nächster Arbeitsauftrag

B04 ist geschlossen. Der nächste fachliche Block ist B05, wurde in diesem Chat jedoch ausdrücklich nicht begonnen.

Beim nächsten Arbeitsauftrag:

1. Dieses Masterhandout V9 vollständig lesen.
2. Branch-Head, main und PR #5 nur kurz auf erwarteten Stand prüfen.
3. B01–B04 nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.
4. Ausschließlich B05 bearbeiten: .gitignore sowie aktueller und historischer Secret- und Supply-Chain-Scan.
5. Echte Treffer gegebenenfalls nach klarer Bewertung rotieren; keine Secret-Werte in Chat, Repository, Logs oder Handout schreiben.
6. Produktion, main, Merge, Payment-, Supabase- und Vercel-Produktion unverändert lassen.
7. Nach B05 ein neues Masterhandout anlegen; nicht ungefragt zu B06 springen.

## 8. Releaseblocker nach V9

- B01 GESCHLOSSEN: PROFILE-Preview-Isolation vollständig nachgewiesen.
- B02 GESCHLOSSEN: Erasure-/Username-Triggerkonflikt behoben; Rollen-/Bypassgrenze und Rollback isoliert getestet; CI #228 grün.
- B03 GESCHLOSSEN: fail-closed Live-Paymentmodus implementiert; Schlüsselwechsel allein reicht nicht; API-/DB-Modusbindung und unabhängiger Webhook-Gate isoliert getestet; CI #245 grün.
- B04 GESCHLOSSEN: Protect main ist aktiv; PR-Pflicht, validate, quota_database, Delete-Sperre und Force-Push-Sperre wirken für main; keine Bypass-Liste.
- B05 OFFEN / nicht begonnen: .gitignore, aktueller/historischer Secret- und Supply-Chain-Scan; echte Treffer gegebenenfalls rotieren.
- B06 OFFEN: Produktions-Auth-/Berechtigungsprüfung einschließlich MFA/Step-up, Sessions, Recovery und begründeter Advisor-Ausnahmen.
- B07 OFFEN: qualifizierte rechtliche Schlussprüfung.
- B08 OFFEN: steuerliche Schlussprüfung; platform_fee_tax_treatment=review_required bleibt.
- B09 OFFEN: tatsächlicher Betreiber-/Gewerbestatus und finale Betreiberangaben.
- B10 OFFEN: kommerziell zulässiger Hostingtarif, Budget und Providerlimits.
- B11 OFFEN: Produktionsbaseline und exaktes Delta-/Checksum-Migrationsmanifest; keine Staging-Vollkopie.
- B12 OFFEN: separate Live-Stripe-/Connect-Freigabe und spätere ausdrückliche Live-Autorisierung.
- B13 OFFEN: E-Mail-Domain/DNS, Scheduler, Retry/Dedupe, Zustell-/Bounce-Nachweise und Alerts.
- B14 OFFEN: Monitoring, Alarmempfänger, Vertretung und Incident-Runbook.
- B15 OFFEN: kompatibler Rückfallstand, DB-/Storage-Restoreprobe, RPO/RTO und serverseitige Schreibsperre.

F03 und F04 aus V5 bleiben unverändert relevant. Alle in V4 abgeschlossenen Abnahmen bleiben ausschließlich in ihrem dokumentierten Umfang geschlossen.

## 9. Dauerhafte Referenzen

- V4: DUELVANTA_MASTERHANDOUT_V4_2026-09-15.md, Commit 30d372aee483705565288cd00a71a282482d4ad4
- V5: DUELVANTA_MASTERHANDOUT_V5_2026-09-15.md, Commit c26b97472f69cd13fa2f79e2b2705d742ab0c5ea
- V6: DUELVANTA_MASTERHANDOUT_V6_2026-09-15.md; B01-Abschlussdokumentation d28d6c5777bb8120ae6fa373be419b55f49b63ea
- V7: DUELVANTA_MASTERHANDOUT_V7_2026-09-15.md; letzter V7-Dokumentationscommit vor V8 f2c602c4109f854773ad6419a2345cdc0ed46fc4
- V8: DUELVANTA_MASTERHANDOUT_V8_2026-09-15.md, Commit 33def25cbb173316e28dc3f41b1d76bbfd217465
- B01 technischer Checkpoint: d108eba6033ea2d94d3a06e639202260e2d69717
- B01 CI: #219 / 34955359914
- B02 finale SQL-Korrektur: bfa428e189b3515c44adb0c5bd4194fac03f6e3f
- B02 technischer Abschluss-Head: 24c1a6ef0fc437e13f56d18aa23e255dfc7d610c
- B02 CI: #228 / 34964941036
- B03 zentrale Live-Gates: a4705ae9e120b1878e8dea8053c9e17791b0de77
- B03 DB-Migration: b5ac1b15f24eac42fdbe241c0af2597b3abdc504
- B03 technischer Abschluss-Head: c8a8a02fa4f5b21813ba253e66767a8ee61d95b7
- B03 CI: #245 / 34966761267
- V7-Dokumentations-CI: #246 / 34967049764
- B04 Ruleset: Protect main, ID 23447544, Active
- B04 effektive Regelansicht: https://github.com/Bennyescaped/duelvanta/rules/23447544?ref=refs%2Fheads%2Fmain
- main: 50f88213571be13255bb52eb489cc28cca660001
- Staging Supabase: xhmjxrcskfhbovhitdej
- Produktion Supabase: enifiaqsnqtbzylnfrpi

## 10. Übergaberegel

Der nächste Chat soll B01–B04 nicht erneut auditieren. B04 ist durch den tatsächlich aktiven GitHub Ruleset geschlossen. B05 wurde noch nicht begonnen und darf erst auf einen neuen ausdrücklichen Arbeitsauftrag hin bearbeitet werden. Produktion, Payment-Aktivierung, main und Merge bleiben bis zur ausdrücklichen späteren Freigabe gesperrt.
