# Stripe Connect Sandbox-Abnahme

Stand: 13.09.2026. Interner Review-Ablauf; keine Produktionsfreigabe.

## Harte Voraussetzungen

- separates Supabase-Stagingprojekt; niemals `enifiaqsnqtbzylnfrpi`
- Vercel-Preview-Umgebung zeigt ausschließlich auf dieses Stagingprojekt
- Stripe-Testmodus und ein eigener Connect-Webhook für die Preview-URL
- aktuelle Accounts-v2-Previewversion unmittelbar vor dem Test erneut gegen die Stripe-Dokumentation prüfen
- `STRIPE_CONNECT_SANDBOX_ENABLED` und die Datenbankoption `sandbox_enabled` bleiben bis zum eigentlichen Test `false`

## Nur in Vercel Preview

- `STRIPE_SECRET_KEY`: ausschließlich `sk_test_…`
- `STRIPE_WEBHOOK_SECRET`: Test-Webhook-Geheimnis
- `STRIPE_ACCOUNTS_V2_VERSION`: vor dem Test verifizierte Previewversion
- `STRIPE_REFUND_WORKER_SECRET`: eigener zufälliger interner Wert
- `DUELVANTA_PUBLIC_ORIGIN`: HTTPS-Preview-URL
- Supabase-URL, Publishable-/Anon-Key und Service-Role-Key ausschließlich des Stagingprojekts

Geheimnisse niemals in Repository, Tickets, Browserprotokolle oder Testausgaben kopieren.

## Stripe-Konfiguration

- Connected Account: Accounts v2, Merchant-Konfiguration, volles Stripe-Dashboard
- Verantwortlichkeiten im Test: Gebühren und Verluste bei Stripe
- Zahlungsmodell: Direct Charge auf dem Connected Account; DUELVANTA erhält nur die konfigurierte Application Fee
- Stripe-gehostetes Onboarding sammelt Identitäts-, Verifizierungs- und Bankdaten
- Connect-Events: `account.updated`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

## Abnahmereihenfolge

1. Review-SQL in der dokumentierten Reihenfolge nur auf Staging anwenden; anschließend Datenbank-Advisors prüfen.
2. Einen freigegebenen Testverkäufer und einen getrennten Testkäufer anlegen.
3. Sandboxschalter zuerst in der Datenbank, danach nur in Vercel Preview aktivieren.
4. Stripe-Onboarding starten und Anforderungen-/Sperrzustände über `account.updated` prüfen.
5. Eine niedrigwertige Testorder mit bestätigtem Versandpreis bezahlen; Betrag, Gebühr, Verkäufernetto und PStTG-Ereignis vergleichen.
6. Fehlerzahlung und doppelte Webhook-Zustellung simulieren; kein doppelter Status-/Ledger-Eintrag darf entstehen.
7. Genehmigte vollständige Erstattung ausführen; erst `charge.refunded` darf den Refund bestätigen und das PStTG-Ereignis korrigieren.
8. Teilrefund muss blockiert bleiben. Auszahlung darf ohne eindeutigen Provider-Nachweis nicht als erfolgt erscheinen.
9. Datenexport, Kontolöschblocker und Browserzugriffsgrenzen erneut prüfen.
10. Beide Sandboxschalter wieder deaktivieren und Testdaten dokumentiert entfernen oder sperren.

## Abbruchkriterien

Sofort abbrechen bei Live-Schlüssel/-Event, Produktions-Supabase-Referenz, ungeprüftem Versandpreis, Betragsabweichung, fehlender Webhook-Signatur, doppelter Vergütungsbuchung oder einer Zahlung auf dem DUELVANTA-Plattformkonto.
