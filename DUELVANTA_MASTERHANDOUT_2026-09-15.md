# DUELVANTA – Masterhandout V3

Stand: 15.09.2026, nach vollständiger Stripe-Connect-Sandbox-Abnahme und Abschaltung der Sandbox.

## 1. Verbindlicher Ausgangspunkt

Dieses Dokument ist ab sofort der aktuelle Übergabestand für DUELVANTA. Es ersetzt widersprechende Statusangaben älterer Masterhandouts.

Nicht erneut bereits abgeschlossene Stripe-Onboarding-, Erfolgszahlungs-, Fehlerzahlungs-, Webhook-Wiederzustellungs- oder Vollrefund-Tests starten, sofern nicht ausdrücklich eine Regression nach neuen Payment-Änderungen erforderlich ist.

Entwicklung weiterhin ausschließlich auf `marketplace-ux-v1` / Preview / Staging. Produktion und `main` unverändert lassen.

## 2. Verbindliche Repository-/Deployment-Stände

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- geprüfter Code-Checkpoint: `632aa6f66b8fe2a892fe835a485dc5ada8c231d6`
- Commit-Meldung: `Preserve immutable Stripe refund evidence`
- PR: #5, weiterhin Draft
- Produktion / `main`: `50f88213571be13255bb52eb489cc28cca660001`
- GitHub Actions: `Scanner V16 Check` Run #209 = `success`
- aktuell neu redeploytes Preview: `dpl_5QyXUPq9YsvmXbA5KVXNjzfHnZf4`
- Preview-Status: `READY`
- Preview-Code: exakt Commit `632aa6f66b8fe2a892fe835a485dc5ada8c231d6`
- Supabase-Staging-Projekt: `xhmjxrcskfhbovhitdej`

Wichtig: Das Masterhandout selbst ist Dokumentation. Falls das Ablegen dieses Dokuments den Branch-Head auf einen reinen Dokumentations-Commit verschiebt, bleibt `632aa6f...` der geprüfte technische Code-Checkpoint.

## 3. Harte Grenzen

- Produktion nicht verändern.
- `main` nicht verändern oder mergen.
- produktives Supabase nicht verändern.
- keine Live-Zahlung, Live-Erstattung oder Live-Auszahlung ausführen.
- Stripe-Live-Schlüssel dürfen nicht in Preview/Sandbox verwendet werden.
- `v-logo.svg` niemals neu interpretieren oder verändern.
- Slogan unverändert: `COLLECT. TRADE. BATTLE.`
- COLLECT, BATTLE, PROFILE und bereits stabile TRADE-Bereiche nicht unnötig redesignen.
- Payment-/Steuer-/Vertragsbelege nicht nachträglich mutieren; Korrekturen nur über dafür vorgesehene Reconciliation-/Korrekturpfade.

## 4. Stripe-Connect-Sandbox-Abnahme – vollständig abgeschlossen

### Erfolgszahlung

Testorder `DV-260913-000004` wurde erfolgreich über Stripe Connect Direct Charge bezahlt.

- PaymentIntent: `pi_3UFVpNDwFcjtFwoY0OwHMoEf`
- Charge: `ch_3UFVpNDwFcjtFwoY05d3hVxW`
- Betrag: 4,00 EUR
- Connected Account: `acct_1UFU7JDwFcjtFwoY`
- Providerstatus wurde ausschließlich durch signierten Stripe-Webhook bestätigt.

### Webhook-Wiederzustellung / Idempotenz

Der bereits verarbeitete `payment_intent.succeeded`-Event wurde erneut eingespielt.

Ergebnis:
- `replayed:true`
- kein Status-Rückfall
- keine doppelte Vergütungs-/PStTG-Buchung
- keine doppelte Zahlungsbestätigung

### Vollständiger Refund

Die genehmigte vollständige Sandbox-Erstattung über 4,00 EUR wurde praktisch durchgeführt.

Finaler Zustand:
- Order `payment_status = refunded`
- `refund_status = refunded`
- `refund_amount = 4.00`
- `provider_refund_ref = re_3UFVpNDwFcjtFwoY05cpoxGr`
- Payment-Attempt `state = refunded`
- `paid_cents = 400`
- `refunded_cents = 400`
- Refund-Request `status = succeeded`
- `stripe_refund_id = re_3UFVpNDwFcjtFwoY05cpoxGr`
- genau eine PStTG-Korrektur
- Gegenbuchung: -4,00 EUR / activity -1

### Refund-Evidence-Fix

Während der Praxisabnahme wurde festgestellt, dass Stripe bei `charge.refunded` die Refund-Liste im Charge-Objekt nicht zuverlässig eingebettet liefert.

Umgesetzt:
- serverseitiger GET der Refunds im richtigen Connected Account, falls `refund_id` im Event fehlt
- erfolgreiche Vollrefund-Evidenz wird validiert
- bereits archivierte Stripe-/PStTG-Evidenz bleibt unveränderbar
- Reconciliation ergänzt nur operative Provider-Referenzen bei bereits bestätigtem Vollrefund
- keine zweite Steuer-/Ledgerbuchung

Relevante Änderungen:
- `api/market-stripe-lib.js`
- `api/market-stripe-webhook.js`
- `database/market-stripe-refund-evidence-hardening-v1.sql`

### Fehlerzahlung

Separate Testorder: `DV-260915-000007`

- Betrag: 3,00 EUR
- Testkarte: absichtlich abgelehnt
- Event: `payment_intent.payment_failed`
- PaymentIntent: `pi_3UFrklDwFcjtFwoY16ULmNEe`
- Order `payment_status = failed`
- Attempt `state = failed`
- `paid_amount = 0.00`
- `paid_cents = 0`
- keine Payment-Evidence erzeugt
- keine PStTG-/Vergütungsbuchung erzeugt

Das dafür angelegte Testinserat `STAGING FEHLERZAHLUNG TEST – KEINE ECHTE WARE` wurde anschließend wieder auf `paused` gesetzt.

### Teilrefund-Schutz

Ein synthetischer Teilrefund wurde transaktional geprüft und korrekt mit `stripe_partial_refund_requires_review` blockiert.

Ergebnis:
- Probe vollständig zurückgerollt
- echter Vollrefund unverändert 400/400 Cent
- weiterhin exakt eine Refund-/PStTG-Korrektur

### Payout-Sicherheit

Geprüft:
- erlaubte Payout-Zustände: `not_applicable`, `blocked`, `pending`, `released`, `failed`, `reversed`
- aktuell kein Deal als `released` markiert
- keine öffentliche Funktion setzt `released` ohne Provider-Nachweis
- erstattete/disputed Stripe-Order bleibt `blocked`
- fehlgeschlagene Zahlung bleibt `not_applicable`

## 5. Datenrechte / RLS / Browsergrenzen – Regression bestanden

Erneut geprüft nach Payment-Änderungen:

- Datenexport-Funktion vorhanden und umfasst u. a. Orders, Payment-Attempts und finanzielle Belege ohne unnötige Provider-Geheimnisse.
- Testkäufer-Löschblocker greifen korrekt: `open_market_cases`, `open_market_orders`.
- öffentliche Tabellen ohne RLS: `0`
- Browser-Grants (`anon`/`authenticated`) auf `dv_market_private`: `0`
- Datenexport-Probe wurde nur transaktional ausgeführt und zurückgerollt.

## 6. Sandbox jetzt wieder geschlossen

Nach Abschluss der Abnahme wurden beide Schalter deaktiviert:

- Datenbank: `dv_market_private.market_payment_configuration.sandbox_enabled = false`
- `live_mode = false`
- Vercel Preview: `STRIPE_CONNECT_SANDBOX_ENABLED = false`
- Preview danach neu redeployed
- neues Deployment `dpl_5QyXUPq9YsvmXbA5KVXNjzfHnZf4` = `READY`

Stripe-Sandbox darf für weitere Tests erst wieder bewusst und ausschließlich in Preview/Staging aktiviert werden.

## 7. Bekannte Testdaten, nicht mit Produktion verwechseln

- Testkäufer: bestehender Staging-Testnutzer
- Testverkäufer / Connected Account: `acct_1UFU7JDwFcjtFwoY`
- `DV-260913-000004`: erfolgreiche Zahlung, danach vollständig erstattet; bleibt als Abnahmebeleg erhalten.
- `DV-260915-000007`: absichtlich fehlgeschlagene Zahlung; bleibt als Abnahmebeleg erhalten.
- synthetisches Fehlerzahlungs-Inserat ist `paused`.

Keine dieser Staging-Daten in Produktion übertragen.

## 8. Technisch abgeschlossene Stripe-Abnahmepunkte

Die dokumentierte Stripe-Sandbox-Abnahmereihenfolge ist für folgende Punkte erfüllt:

1. Staging-/Preview-Isolation
2. Testverkäufer + Testkäufer
3. Stripe-Onboarding / Connected Account
4. account.updated-Synchronisierung
5. erfolgreiche niedrigwertige Direct-Charge-Zahlung
6. Fehlerzahlung
7. Webhook-Wiederzustellung / Idempotenz
8. vollständige Erstattung
9. Refund-Evidence-Reconciliation
10. Teilrefund-Schutz
11. Payout-Sicherheitsprüfung
12. Datenexport / Löschblocker / RLS-/Browsergrenzen
13. Sandboxschalter wieder deaktiviert

Damit ist der Stripe-Connect-Sandbox-Abnahmeblock abgeschlossen.

## 9. Nächster Entwicklungsblock

Nicht noch einmal den Stripe-Abnahmeblock wiederholen.

Der nächste Arbeitsblock soll auf dem stabilen Stand aufbauen und wieder Produktfunktionalität voranbringen. Priorität:

1. TRADE-/Order-Lebenszyklus nach erfolgreicher Zahlung vollständig durchziehen: Versand, Erhalt, Abschluss und zugehörige Benachrichtigungen gegen den Stripe-Zustand prüfen.
2. Verkäufer-Versandprofile und Combined-Shipping-Regeln finalisieren, soweit noch nicht vollständig abgenommen.
3. Problem-/Storno-/Refund-UX auf den jetzt bestätigten Providerzustand abstimmen; keine zweite Refund-Logik neben dem bestehenden Serverpfad bauen.
4. anschließend Marketplace-Gesamtabnahme auf Mobile/Desktop und Vorbereitung für spätere Produktionsfreigabe.

Vor Produktionsfreigabe weiterhin erforderlich:
- rechtliche/steuerliche Schlussprüfung
- finale Produktionskonfiguration
- bewusste Entscheidung zum Stripe-Live-Rollout
- erneute Security-/Release-Abnahme

## 10. Arbeitsmodus

Compact Development Mode weiterhin beachten:
- gezielte Prüfungen statt Wiederholung bereits grüner Tests
- nur geänderte Funktionen/Dateien anfassen
- keine unnötigen Login-/Browser-Schleifen
- keine Behauptung absoluter Fehlerfreiheit
- nach wesentlichen neuen Blöcken Masterhandout aktualisieren
