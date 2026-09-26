# DUELVANTA – Environment Routing Hardening

Stand: 2026-09-20  
Branch: `marketplace-ux-v1`  
Ausgangs-Head: `141fe1c148f20ae296ce737e8ab454b55bb153ff`  
Implementierungs-Head: `bd482d3e241977b655316bd7ab75b03ddf9e1923`

## Ergebnis

Das Supabase-Ziel wird in ausführbaren Runtime-Pfaden zentral durch `supabase-environment.js` bestimmt:

- `VERCEL_ENV=production` → Production `enifiaqsnqtbzylnfrpi`
- `VERCEL_ENV=preview` oder `development` → DUELVANTA-STAGING `xhmjxrcskfhbovhitdej`
- Ein konfiguriertes `SUPABASE_URL`, das nicht zum Deployment-Environment passt, wird vor einem Netzwerkzugriff mit `supabase_environment_mismatch` abgewiesen.

Browser-Clients beziehen URL, publishable Key und Environment weiterhin über die vorhandene Runtime-Config `window.DV_SUPABASE`. Es wurde keine zweite Browser-Environment-Logik eingeführt.

## Vorherige Root Causes

1. `collect.html` und `battle.js` erzeugten Clients mit festem Production-Ziel.
2. `battle-spectator.js` sowie die Spectator-Media-Broker-Aufrufe verwendeten ein festes Staging-Ziel.
3. Ältere Control-/Profile-/MFA-Pfade enthielten zusätzliche Hostname- und Project-Ref-Prüfungen; `site-nav.js` ersetzte Client-Ziele über einen parallelen Monkeypatch.
4. Scanner-V16-Auth, Quota-Reservierung und Accounting verwendeten unabhängig vom Deployment ein festes Production-Ziel.
5. Weitere serverseitige Supabase-Pfade (`compliance-message-dispatch`, Account-Erasure, Marketplace-Stripe-Helfer und AfterShip-Tracking) vertrauten direkt auf einzelne Env-Werte oder besaßen eigene Zuordnungen.

## Geänderte Runtime-Pfade

- Zentraler Resolver: `supabase-environment.js`
- Runtime-Config und Compliance-Worker: `api/compliance-message-dispatch.js`
- Scanner Auth/Quota/Accounting: `benchmark/scanner-pilot/recognize-server.cjs` (damit auch `api/scanner-v16-recognize.js`)
- Weitere serverseitige Zugriffe: `api/account-data-erasure.js`, `api/market-stripe-lib.js`, `market-tracking-aftership.js`
- COLLECT/BATTLE: `collect.html`, `battle.html`, `battle.js`
- Spectator und Spectator Media: `battle-spectator.html`, `battle-spectator.js`, `battle-spectator-media-publisher.js`, `battle-spectator-media-viewer.js`
- Bestehende Control-/Auth-Pfade: `control-center.js`, `control-center-auth-preflight.js`, `profile.js`, `mfa.js`, `site-nav.js`
- Environment-abhängige Preview-UI: `admin.html`, `seller-onboarding.js`

Nicht verändert wurden TRADE-Vertragsschluss, Checkout/Orders, Widerrufslogik, Legal-Texte, Seller-Onboarding-Logik, Stripe-Logik, Battle-Regeln, Spectator-Consent/-Revocation, Scanner-Erkennung und Quoten-/Kostenregeln.

## Tests und Nachweise

Gezielte Regressionen:

- Preview und Development lösen ausschließlich auf Staging auf.
- Production löst ausschließlich auf Production auf.
- Cross-Environment-Konfigurationen werden fail-closed abgewiesen.
- COLLECT, Spieler-BATTLE, Spectator und beide Spectator-Media-Adapter verwenden dieselbe Runtime-Config.
- Scanner-Auth und Scanner-Quota adressieren in Preview ausschließlich Staging; ein Production-Ziel führt vor jedem Fetch zu `503 accounting_unavailable`.
- Der Repository-Test erlaubt Project-Refs und statische publishable Keys in ausführbaren Pfaden nur im zentralen Resolver.

Lokale Nachweise bestanden unter anderem:

- `tests/runtime-routing-contract-test.mjs`
- `tests/supabase-runtime-config-test.mjs`
- `tests/battle-webrtc-restart-test.mjs`
- `tests/battle-spectator-browser-test.mjs` (12 Szenarien)
- `tests/scanner-v16-recognize-server-test.mjs`
- `tests/scanner-v16-collect-e2e.mjs`
- relevante Compliance-, Account-Erasure-, Marketplace-Stripe-, Seller-Onboarding-, TRADE- und Scanner-V16-Regressionen

GitHub Actions für den Implementierungs-Head:

- `Battle WebRTC Check #72`: **success**
  - `battle_webrtc`: success, einschließlich realer Browser-WebRTC-Regression
  - `spectator_database`: success, einschließlich disposable PostgreSQL
- `Scanner V16 Check #596`: **success**
  - `validate`: success
  - `quota_database`: success, einschließlich realer SQL-Quota-Regression

## Repository-Scan

Der abschließende Scan über ausführbare `.js`, `.cjs`, `.mjs` und `.html`-Pfade ergab:

- Production-Project-Ref: nur `supabase-environment.js`
- Staging-Project-Ref: nur `supabase-environment.js`
- statische `sb_publishable_*`-Keys: nur `supabase-environment.js`
- Legacy-JWT-artige Supabase-Keys: keine
- direkte Supabase-Project-URLs: nur `supabase-environment.js`

Dokumentation, SQL und Tests dürfen erwartete beziehungsweise historische Project-Refs enthalten und waren nicht Ziel dieses Runtime-Scans.

## Verbleibende Einschränkungen und separate GAPs

1. Die bestehende Scanner-Verfügbarkeitsfreigabe bleibt unverändert: Preview ist in `recognize-server.cjs` und `api/scanner-v16-reference.js` weiterhin nur für den Branch `scanner-v16` erlaubt, Production nur für `main`. Eine Freigabe für `marketplace-ux-v1` wäre eine Produkt-/Deployment-Änderung außerhalb dieses Environment-Routing-Blocks.
2. Spectator Media V1 bleibt bis zum separaten Mehrgeräte-Test beziehungsweise bis zur serverseitigen Freigabe pausiert. Es wurden weder LiveKit noch Consent-/Revocation-Verhalten verändert.
3. Environment-spezifische Service-/Anon-Keys müssen weiterhin korrekt in der Deployment-Konfiguration hinterlegt sein. Ein Key des falschen Projekts kann wegen des fest aufgelösten Ziel-Hosts nicht auf das andere Projekt umleiten, sondern führt zu einem Authentifizierungsfehler.

## Sicherheitsgrenzen

- `main` blieb unverändert.
- Production-Supabase wurde weder beschrieben noch konfiguriert; es gab keine Production-Migration.
- Stripe Live wurde weder aktiviert noch aufgerufen.
- LiveKit wurde weder getestet noch verändert.
- Es wurde kein manueller Vercel-Deploy ausgelöst; ausschließlich die bestehende Git-Automatik durfte anlaufen.
- Es wurden keine Secrets ausgegeben oder neu committed.
