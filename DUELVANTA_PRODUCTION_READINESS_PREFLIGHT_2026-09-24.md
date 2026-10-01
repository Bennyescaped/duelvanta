# DUELVANTA – Schritt 8: Production Readiness Preflight

24.09.2026. **Bestandsaufnahme abgeschlossen, Rollout NO-GO.** Der Preflight enthält bestätigte Befunde und ausdrücklich offene Provider-/Betriebsnachweise. Er ist weder eine vollständige Sicherheitszertifizierung noch eine Rechts-, Merge-, Production-, Stripe-Live- oder kommerzielle Freigabe. Schritt 6, 7A und 7B bleiben abgeschlossen; sie wurden nicht wiederholt.

## A. Basis, Heads und Arbeitskopien

- Repository `Bennyescaped/duelvanta`, ausschließlich `marketplace-ux-v1`.
- Ausgangsremote und finaler geprüfter Anwendungscode-Stand: `c43bcf37659bb53f8bd2d52f1b9d3e2388f2017f`, exakt wie beauftragt. Darunter finaler technischer Änderungshead `ca6c04557e8f80fb558e961e5c4e13c0542b5db6`. In Schritt 8 keine Änderung an Anwendungscode, Schema oder Konfiguration.
- `main`: `50f88213571be13255bb52eb489cc28cca660001`; frisch über GitHub und `git ls-remote` bestätigt. PR #5 open, draft=true, merged=false. Die PR-Beschreibung enthält historische Zustände und ist kein aktueller Staging-Nachweis.
- V50 sowie die sechs beauftragten Folgedokumente vollständig gelesen. V49/V47/V43 nur historische Evidenz, V50 hat Vorrang. Dieser Auftrag erweitert ausschließlich den Lesezugriff auf Production.
- Staging `xhmjxrcskfhbovhitdej`; Production `enifiaqsnqtbzylnfrpi`.
- 15 vorhandene ältere Arbeitskopien plus neue separate Prüfungskopie inventarisiert. Mehrere alte Kopien haben lokale Commits, geänderte oder unversionierte Dateien. Nichts überschrieben, zurückgesetzt oder bereinigt. Neue Kopie direkt auf demselben Entwicklungsbranch geklont; kein Branchwechsel.
- Finaler **Dokumentationshead** ist der Commit, der V51 hinzufügt; sein vollständiger SHA wird nach Veröffentlichung im Abschluss genannt. Er ist von den oben genannten unveränderten technischen Heads zu unterscheiden; eine Datei kann den Hash ihres eigenen enthaltenden Commits nicht selbst referenzieren.

Frische CI des Ausgangsheads: Scanner V16 #710 / `35968715199` SUCCESS; Battle WebRTC #186 / `35968715240` SUCCESS. Vercel-Status SUCCESS. GitGuardian ist in der abgefragten Combined-Status-Antwort nicht enthalten; kein neuer GitGuardian-PASS behauptet.

## B. Staging-Gesundheit

Read-only, zuletzt `2026-09-24T07:43:54Z`: `compatible=true`, Revision `trade-legal-contract-model-v1.2`; letzte Migration weiterhin `20260923081953 / trade_legal_contract_model_v1`. Insgesamt 50 History-Einträge. Die History ist kein vollständiges Wiederaufbaumanifest der zuvor eingerichteten Basis.

| Objekt | Frisch bestätigt |
|---|---:|
| Listings | 16 |
| Offers | 4 |
| Deals | 10 |
| Orders | 8 |
| Contract snapshots | 10 |
| Withdrawal drafts | 0 |
| Withdrawals | 1 |
| Payment attempts / allocations | 3 / 3 |

DB `sandbox_enabled=false`, `live_mode=false`; Direct Charges, EUR, Plattformgebühr 0 BPS + 0 Cent, Steuerbehandlung `review_required`, Verkäuferrechnungsausstellung false. `seller_onboarding_enforced=false`, Tax-ID für Aktivierung true. Dies sind Staging-Konfigurationen, keine Production-Sollwerte.

Alle 12 Outboxeinträge pending, attempts=0, sent/delivered=0, last_error=0. Keine fehlgeschlagene Zustellung. Keine aktive Offer-Reservation und keine Reservation-Expiry vorhanden. Kein Listing hat Status active; 7A und 7B reserved/available=0. Die übrigen Listings sind erkennbare historische Testfälle, sold/paused/reserved; keine Bereinigung.

Payment-Zustände: historischer Attempt `1032d35e-f6ce-4dfc-9923-5232b33f137b` refunded (400/400 Cent); `09ff4163-71ae-4c81-8400-63f35acb5336` failed (0 paid); 7B `af15faff-b883-4db5-ac56-3da50d902921` session_created (300 fällig, 0 paid/refunded). Damit ist der offene 7B-Zustand erklärt. Historischer Refund ist **keine Aktion dieses Preflights**. Keine Aussage über den aktuellen Stripe-Sessionstatus ohne Providerread.

Beide 7A-/7B-Vertragshashes und der Widerrufshash wurden frisch neu berechnet: jeweils true. Beide Verträge trader/consumer/b2c, checkout-contract-v2, withdrawal_eligible=true. Outbox-Dedupe-IDs und alle synthetischen Objekt-IDs im Evidenzpaket.

V50-Anwendungskanten-Nachweis bleibt PASS als historische Evidenz. Der zusätzliche frische GET-Versuch wurde heute durch SSO-302 abgefangen; Browserzugriff auf die aktuelle Preview-API endete mit ERR_BLOCKED_BY_CLIENT. Dies ist **kein neuer HTTP200-OFF-Nachweis** und widerlegt V50 nicht. Kein Schutz gelockert, keine Sandbox eingeschaltet.

## C. Production-Schema-Inventar

Alle SQL-Aufrufe mit `BEGIN READ ONLY` und ausschließlich SELECT/Katalogabfragen. Keine Anwendungs-Mutations-RPC auf Production aufgerufen. Vollständige Katalogmetadaten liegen in `evidence/production-readiness-20260924/production-catalog.json.gz`; keine Nutzerdatensätze, Secret-Werte, Passwort-Hashes oder Auth-Tokens darin.

Beide Projekte: PostgreSQL 17.6, x86_64. Production-Extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1. Staging zusätzlich pg_cron 1.6.4 und pg_net 0.20.4. Kein automatisches Extensions-Upgrade oder -Angleichen.

Production: 72 Migrationen, letzte `20260911181702 / harden_battle_and_profile_auth_boundaries`. Schemas: auth, dv_v16_private, extensions, graphql, graphql_public, pgbouncer, public, realtime, storage, supabase_migrations, vault. Temporäre/Systemschemas aus Inventarvergleich ausgeschlossen.

| Anwendungskatalog (public + private Schemas) | Production | Staging |
|---|---:|---:|
| Tabellen | 39 | 92 |
| Relationen inkl. Views/Sequenzen | 47 | 108 |
| Spalten | 513 | 1090 |
| Constraints | 309 | 616 |
| Indizes | 95 | 215 |
| Nicht-interne Trigger | 19 | 61 |
| Policies | 31 | 33 |
| Functions/RPCs | 144 | 299 |

Gesamterfasste nicht-systemische Kataloge inklusive Supabase-Schemas: Production 97 Relationen, 1002 Spalten, 457 Constraints (103 FKs), 246 Indizes, 28 Trigger, 43 Policies, 244 Funktionen, 24 Default-Privilege-Einträge. Staging 167/1632/771 (200 FKs)/374/71/47/418/27. Die beiden Zählumfänge nicht vermischen.

Erfasst: Datentypen, NULL/Defaults/Identity/Generated, Constraints und FK-Definitionen, Indizes, Triggerdefinition und Aktivierung, RLS/FORCE RLS, Policy-Prädikate, Funktionssignaturen/Owner/SECURITY DEFINER/search_path/Volatilität/ACL/Definitionsfingerprint, Schema-/Tabellen-/Spalten-/Sequenz-ACL und Default Privileges. Views und Sequenzparameter separat im Supplemental-Inventar. Funktionskörper wurden lokal zum Abgleich gelesen; Fingerprints im versionierten Inventar sind Ist-Evidenz, kein generiertes Migrations-Soll.

Production hat 30 public- und 9 dv_v16_private-Tabellen, alle RLS aktiviert. Keine Browser-Tabellenrechte in privaten Schemas in beiden Projekten. Schema-USAGE von authenticated auf dv_v16_private ist vorhanden und allein keine Tabellenfreigabe. `market_seller_stats` ist in beiden Projekten dieselbe aggregierte View; ihre Optionen/ACL sind erfasst und vor Freigabe gesondert zu bewerten.

Auth/Profile: Production 17 Auth-Nutzer / 17 Profile (15 player/beta, 1 owner/active, 1 moderator/beta); Staging 5/5. In beiden Projekten **0 verifizierte MFA-Faktoren**. Keine einzelnen echten Nutzer exportiert. Auth- und Storage-Grundtabellen samt Katalogstruktur erfasst. API-exponierte Schemas waren über abgefragte SQL-Settings nicht bestimmbar (NULL bedeutet unbekannt, nicht leer); Auth-URL-/SMTP-/Backup-Dashboard war nicht angemeldet.

Production-Storage: collection-cards privat (74 Objekte), market-listing-images privat (6), profile-avatars öffentlich (6), insgesamt 86. Staging ausschließlich market-listing-images privat (5). Keine Bilddateien heruntergeladen oder verändert.

## D. Staging ↔ Production: klassifizierter Diff

Maschinenlesbar: `catalog-diff.json.gz`, lesbares Register `catalog-diff-register.csv` mit 1338 Objektabweichungen. ACL-Reihenfolge normalisiert; MD5-Funktionsfingerprints dienen nur dem Gleichheitsvergleich. Jede registrierte Abweichung hat Kategorie, Begründung und Blockerreferenz. Kategorie 5 wird als zusätzlicher Rollout-Blocker über das Register/folgende Matrix ausgewiesen; eine erwartete Migration kann zugleich Blocker sein.

| Kategorie | Tatsächlicher Befund | Bewertung |
|---|---|---|
| 1 – noch nicht angewandter Stack | 6 zusätzliche Staging-Schemas, 61 App-Relationen, 577 Spalten, 307 Constraints, 120 Indizes, 42 Trigger, 2 Policies, 155 Funktionen | Erwarteter Entwicklungsrückstand; **nicht** einfach alle History-Einträge replayen. Exakte Quellen-/Abhängigkeitskette fehlt als Production-Rehearsal, P0-01. |
| 2 – legitime Umgebungsspezifik | Zusätzliche Production-Buckets; gezielte anon-INSERT-Spaltenrechte auf beta_waitlist email/consent/source | Beibehalten/gegen ursprüngliche Baseline verifizieren; keine Anpassung an reduzierte Staging-Fixture. |
| 3 – älterer Stand | 18 geänderte gemeinsame Funktionssignaturen, 2 Constraints, 1 Policy | Unter anderem Angebotstypen price/trade statt price/fixed_price, alte Offer-Löschpolicy und alte Checkout-/Shipping-/Battle-Funktionen. |
| 4 – nicht als Soll freigegebene Drift | 40 gemeinsame Relationen mit ACL-Abweichungen | Owner-Grantoption/PG17-MAINTAIN und echte Browser-/service_role-Differenzen getrennt bewerten. Breite Rechte nicht in die neue Baseline übernehmen, P0-02. |
| 5 – Rolloutblocker | Fehlende sichere Migrationskette, Rechte/MFA, Backup/Recovery, Routing-/Betriebsnachweise | Siehe P0-Register. |

Legal Contract Model, Snapshots, Widerruf, Outbox, Data Rights, Retention, Tax-Ledger/DAC7, Seller Compliance und Notice & Action befinden sich wesentlich in `dv_market_private` und fehlen in Production vollständig. Fixed Price und Preisangebote benötigen die vorgelagerten Verkäufer-/Checkout-/Payment-/Sale-only-Objekte. Die einzelne Datei `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql` ist deshalb **kein** vollständiges Production-Upgrade.

Stripe-Staging-DB ist weiterhin sandbox-only: `apply_market_stripe_event` verwirft `p_live_mode=true`. `database/market-stripe-live-mode-v1.sql` ist ein separater Review-Kandidat, nicht als angewandt oder mit V50 live-abgenommen ausgeben. Environment-Hardening und Production-TRADE-UI-Gate befinden sich im Entwicklungsbranch, nicht im bekannten main-Deployment.

COLLECT-F3, Battle-Account-/Judge-/Spectator-/Media-Erweiterungen sind ebenfalls Teil des Branch-/Schema-Deltas. Keine TRADE-Migration darf diese Abhängigkeiten oder Providerkonfigurationen übergehen. Historische Swap-Tabellen bleiben Archiv-/Abhängigkeitsbestand; dies ist keine Wiedereinführung des entfernten Tauschprodukts.

Edge-Functions frisch inventarisiert: Production invite-beta-user v2 und public-card-image v2; Staging owner-invite-beta-user v3, battle-spectator-media-broker v4, reconciler v5 und inspect v2. Damit ist auch der Edge-/Scheduler-/Secret-Stack Bestandteil des fehlenden Rolloutmanifests. Nicht getrackte Production-/Diagnosefunktionen dürfen weder still gelöscht noch ohne überprüfte Quelle als Ziel übernommen werden.

## E. Vercel und Environment Routing

Projekt `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd`, Team `team_VHCwSwfBWANJvmS3qdkpJ0dK`, Node 24.x, Region iad1. Aktuelle Production `dpl_ENc313pWZJMSn6y21VbURMEWLMkt`, READY, target=production, main `50f8821…`. Aktuelle V50-Preview `dpl_EkajBVrPjKTNWjtCPsNjgqjqDTs7`, READY, target=null, c43bcf3…. V50 technische OFF-Preview `dpl_9AeELHwqnbgnKwyahAkCKdFbTCPu`, ca6c045…, ebenfalls READY. Keine manuelle Bereitstellung.

Frischer authentifizierter Dashboardread: Project vollständig sichtbar, Shared: **No shared variables linked**. Keine Werte offengelegt. Übersicht der relevanten Scopes:

| Variable | Preview | Production |
|---|---|---|
| SUPABASE_URL | Default + marketplace-ux-v1 Override | fehlt |
| SUPABASE_ANON_KEY | Default + Branch Override | fehlt |
| SUPABASE_SERVICE_ROLE_KEY | Default + Branch Override | fehlt |
| STRIPE_CONNECT_SANDBOX_ENABLED | nur marketplace-ux-v1 | fehlt |
| STRIPE_SECRET_KEY | Default | fehlt |
| STRIPE_WEBHOOK_SECRET | Default + Branch Override | fehlt |
| STRIPE_REFUND_WORKER_SECRET | Default | fehlt |
| STRIPE_ACCOUNTS_V2_VERSION | Default | fehlt |
| DUELVANTA_PUBLIC_ORIGIN | Default | fehlt |
| OPENAI_API_KEY | Production und Preview gemeinsam | vorhanden |
| DV_OPENAI_ACCOUNTING_KEY | separat Preview / Production | vorhanden |
| XIMILAR_API_TOKEN / GEMINI_API_KEY | Preview | fehlen |

Alle fünf LIVE-Schalter und alle Compliance-Mail-Variablen fehlen in Project/linked Shared. Der gespeicherte Sandbox-Wert wurde nicht aufgedeckt; V50 belegt OFF, frische DB OFF. Der Secret-Key-Modus wurde nicht erneut aus einem Schlüsselwert gelesen; historische TEST-Nutzung und Codepräfixprüfung sind getrennte Evidenz.

`supabase-environment.js` erzwingt production → enifiaqsnqtbzylnfrpi, preview/development → xhmjxrcskfhbovhitdej; widersprüchliche SUPABASE_URL führt zum Abbruch. Browser erhält nur Publishable-Key, niemals service_role. Server-Anon-/Service-Key-Zielbindung ist vor Rollout separat sicher zu attestieren, ohne Werte zu protokollieren. Vorhandene Preview-Scopes dürfen nicht nach Production kopiert werden. Fehlende Production-Serverkeys verhindern insbesondere künftige Trade-/Dispatcher-/Storage-Serverpfade; das ist keine Behauptung, die heutige COLLECT-Beta sei deshalb ausgefallen.

## F. Stripe Readiness und Branding

Ist-Architektur: Accounts v2, merchant/card_payments, full Dashboard, fees_collector=stripe, losses_collector=stripe; Direct Charge per Stripe-Account-Header. Verkäufer ist Vertragspartner des Käufers. Keine Änderung dieser fachlichen Strategie. Live separat pro onboarding/payments/webhooks/refunds plus Mastergate; gleichzeitiges sandbox/live wird verworfen, sk_test_/sk_live_-Modusprüfung vorhanden. Eine Live-Aktivierung nur durch Env würde am sandbox-only DB-Stand scheitern.

Code: Request-UUID, eingefrorene Beträge/Gebühren, Session-/Account-/Currency-/Metadata-Prüfung, genau eine Attempt/Allocation-Kette, Event-ID-Dedupe und Refund-Reconciliation vorhanden. Signaturprüfung Raw Body, HMAC-SHA256, timingSafeEqual, 300-Sekunden-Toleranz. Vollrefund über authentisierten Worker; Teilrefund und positive Gebühren mit ungeklärter Steuerbehandlung nicht als freigegeben ansehen. Gebühren im aktuellen Test 0; kein finales Geschäfts-/Steuermodell daraus ableiten.

Webhookcode `/api/market-stripe-webhook`: account.updated, checkout.session.completed/async_payment_succeeded, payment_intent.succeeded/payment_failed, charge.refunded. Kein eigener vollständig abgenommener Dispute-/Chargebackbetrieb aus diesem Befund ableitbar; Accounts-v2-Ereignisse und Accountänderungen vor Live gegen die tatsächliche Providerkonfiguration abgleichen. Live-Webhook-Endpoint, Ereignisabonnement, Secrets, Production-Onboarding, Capabilities, Verantwortlichkeiten und Branding sind providerseitig **nicht frisch verifiziert**: Stripe-Connector meldet UNAUTHORIZED/Reauthentication. Keine Wiederanmeldung oder Ersatzsession durchgeführt.

**„DUELVANTA Privatverkäufer“ ist nicht bloß eine beliebige Testanzeige:** `api/market-stripe-onboarding.js` setzt bei neuer Kontoerstellung `display_name` abhängig von `prepared.seller_type` auf „DUELVANTA Händler“ oder „DUELVANTA Privatverkäufer“. Bestehende Account-ID wird wiederverwendet, ohne den Namen bei späterer Rollenänderung zu synchronisieren. Der Account war bereits vor der 7A-Trader-Fixture vorhanden. Dies erklärt die beobachtete Anzeige plausibel; der aktuelle Stripe-Business-Profile-Wert und seine exakte Vorrangregel wurden mangels Accountzugriff nicht bestätigt.

Direct-Charge-Checkout verwendet laut Stripe die Connected-Account-Brandingdaten. Die generische DUELVANTA-Bezeichnung kann auch im Live-Kontoerstellungszweig entstehen; daher **P2 vor Live**: tatsächlichen Händlernamen, business profile/display_name/Statement Descriptor, Plattformkennzeichnung und Rollenwechselstrategie prüfen und anhand fachlich bestätigter Händleridentität abnehmen. Kein stilles Umbenennen, keine Vermutung als Änderung. B2C-Snapshot bleibt nachweislich korrekt.

Quellen: https://docs.stripe.com/connect/end-to-end-saas-platform und https://docs.stripe.com/payments/checkout/customization/appearance (24.09.2026 geprüft). Keine neue Charge-/Gebührenentscheidung getroffen.

## G. E-Mail / Compliance Messages

`COMPLIANCE_EMAIL_DELIVERY_ENABLED`, `RESEND_API_KEY`, `COMPLIANCE_EMAIL_FROM`, `COMPLIANCE_DISPATCH_SECRET` fehlen frisch in Project/linked Shared; damit Anwendung default OFF. Resend-Providerpfad im Code vorhanden. From-Domain/Adresse nicht konfiguriert nach diesem Inventar; kein Reply-To-Parameter im sendEmail-Payload. Supabase-Auth-Mail ist ein separater bestehender SMTP-Pfad (Datenschutz nennt access@duelvanta.de), kein Beleg für Compliance-Zustellbereitschaft.

Outbox: eindeutiger Dedupe-Key; FOR UPDATE SKIP LOCKED, Lock-Token, Rückgewinnung nach 15 Minuten; maximal 8 Versuche, Wiederholung nach 5 Minuten × min(attempts,12). Resend Idempotency-Key vorhanden. Providerannahme wird als sent erfasst; delivered_at bleibt einem gesonderten Zustellereignis vorbehalten. Eventtabelle enthält claimed/sent/failed; kein vollständiger Resend-Delivery/Bounce/Complaint-Webhook gefunden. Kein aktiver Dispatcher-Scheduler in vercel.json nachgewiesen.

Vor öffentlichem TRADE: freigegebene Vorlagen/Absender/Reply-To, Providerkonto/Domain-Verifikation, produktionsgetrennte Secrets, Dispatcherbetrieb, Retry-Eskalation/Deadletter und Delivery-/Bounce-Nachweis notwendig. Historische synthetische pending-Outbox darf dabei niemals real versandt werden. SPF/MX/DMARC-Abfragen über DNS-over-HTTPS liefen in Timeout; direkte DNS-Abfrage war netzseitig unerreichbar. DKIM-Selector/Providerkonfiguration unbekannt. **Unbestätigt bedeutet nicht, dass DNS-Einträge fehlen.** Keine Mail versandt und keine Zustellung aktiviert.

## H. Legal Surface

Technischer Faktenabgleich, keine eigene Rechtsentscheidung. Vollständiger Kanzlei-SOLL/IST-Bericht vom 21.09. bleibt hinsichtlich nicht später geschlossener Themen Referenz; dessen damalige offenen Vertragsschluss-/B2C-/Widerrufspunkte sind durch Schritte 1–7 technisch weiterentwickelt, nicht erneut als unimplementiert behauptet.

| Fläche | Ist / notwendiger Nachweis |
|---|---|
| Impressum | statisch vorhanden, Stand 04.09., Benjamin Fritz; tatsächliche Betreiber-/Gewerbedaten vor Launch extern bestätigen. |
| Datenschutz | statische Beta-Fassung, Stand 09.09., COLLECT-Nachträge und Versandadressen; vollständige aktualisierte Abdeckung von Stripe, LiveKit, OpenAI, Tax/Notice/Retention nicht nachgewiesen. |
| Nutzungsbedingungen / AGB | keine eigenständige veröffentlichte Nutzungsbedingungen-/AGB-Datei im aktuellen Inventar gefunden; seller_terms_version ersetzt keinen vollständigen Rechtstext. |
| Widerrufsbelehrung / Muster | elektronische Erklärung und Beleg technisch vorhanden; vollständig freigegebene vorvertragliche Händlerbelehrung/Muster pro Händler nicht nachgewiesen. |
| Händler / Plattformrolle | trader/private getrennt, Seller Party im Snapshot, consumer/b2c eingefroren; freigegebene öffentliche Texte und reale Händlerdaten separat erforderlich. |
| Vertragsschluss / Buttons | Preisangebot verbindlich senden → Verkäuferannahme; Festpreis „Zahlungspflichtig bestellen“ → TEST-Zahlungsaufforderung; 7A/7B belegt. Kein neuer Rechtsentscheid. |
| Notice & Action | Intake/Entscheidung/Einspruch/Audit im Branch/Staging; verantwortlicher menschlicher Betrieb und Art.-18-Eskalationsprozess extern festlegen. |
| PStTG/DAC7 | Ledger/Export/Retentiondaten technisch; Meldekanal, Finanzkontodatenquelle, Verantwortung und Fristenkontrolle nicht vollständig betrieblich belegt. |
| Bestätigung / Hashes | checkout-contract-v2 und SHA256 frisch korrekt; Providerzustellung aus. Vertragshash ist keine Kanzleifreigabe. |
| IT-Recht-Kanzlei | kein automatischer Rechtstext-Sync-/Update-Client oder veröffentlichter individueller Textbestand nachgewiesen. Vertrag/Generator/Updates/individuelle Ergänzungen und deren Überschreibschutz extern bestätigen. |

Retention-Policy umfasst neun Kategorien, teilweise ausdrücklich manuell/external_review_required. Scanner-Accounting in dv_v16_private wird vom geprüften Account-Erasure-SQL nicht ausdrücklich erfasst. Provider-DPA/Region/Retention für LiveKit, OpenAI, Supabase und Google-STUN bleiben gesonderte Nachweise. Anwaltliche **und steuerliche Schlussprüfung** vor kommerzieller Nutzung zwingender externer Freigabepunkt; hier keine neuen gesetzlichen Pflichten oder Fristen entschieden.

## I. Domains / TLS / Public Routing

Frischer Vercel-Dashboardstand: duelvanta.de Valid Configuration/Production; www.duelvanta.de Valid Configuration/308 → duelvanta.de; duelvantav5vision.vercel.app 307 → duelvanta.de. Production-Deployment ausdrücklich main, kein Preview auf Production-Domain.

HTTPS GET duelvanta.de und www.duelvanta.de erfolgreich mit normaler Zertifikatsprüfung; HSTS max-age=63072000. Keine Zertifikatsablauf-/SAN-Komplettinventur behauptet. .com: Timeout; www.com: HTTP502; beide nicht in Projekt-Domainliste. Kein Beweis für weltweite Nichterreichbarkeit; separate DNS/TLS/Registrarzuordnung erforderlich, keine Umschaltung.

Canonical: .de über Routing; öffentliche Listing-Route bildet Canonical aus Request-Origin, interne Trade-Seite noindex,nofollow, Listing noindex,follow. Kein globales robots.txt/sitemap.xml im getrackten Dateiinventar. Vercel SSO-Schutz all_except_custom_domains, geschützte Previewantwort mit X-Robots-Tag noindex. Vollständige Header-/Canonical-Abdeckung vor Launch prüfen; Schutz nicht abschalten.

Stripe Redirects im Code ausschließlich aus DUELVANTA_PUBLIC_ORIGIN zu trade.html?payment=return/cancelled bzw. seller-onboarding.html?stripe=refresh/return. Production-Origin fehlt. Login-/Callback-Frontendpfade vorhanden; tatsächliche Supabase Site URL und Redirect-Allowlist mangels angemeldetem Dashboard nicht verifiziert. Keine Auth-Mail ausgelöst.

## J. Security

Frischer begrenzter Muster-/JWT-Rollenscan über 599 getrackte Dateien: 0 Treffer für geprüfte Stripe-/Supabase-Secret-/GitHub-/Private-Key-/service_role-JWT-Muster. Dies ist **kein vollständiger neuer Gitleaks-History-Scan**. Historischer B05-Scan ist dokumentiert, GitGuardian-Status aktuell nicht verfügbar. Öffentliche Publishable Keys sind keine Secrets. Keine Schlüsselwerte im Bericht oder Evidenzpaket.

**P0-02 – konkrete Rechte-/MFA-Lücke:** `has_table_privilege(...,'TRUNCATE')` bestätigt in Production Rechte für authenticated auf battle_matches, battle_reports, battle_signals, beta_waitlist, collection_folders, collection_items, profiles; anon auf collection_folders und profiles. Staging ebenfalls authenticated auf battle_reports, beta_waitlist, collection_items, profiles und anon auf profiles. RLS schützt TRUNCATE nicht. Damit wird **keine direkte PostgREST-TRUNCATE-Ausnutzung behauptet**; kein destruktiver Versuch erfolgte. Überbreite Rechte sind vor Rollout auf erforderliche DML-/RPC-Rechte zu reduzieren und isoliert zu testen.

Beide public-Default-Privilege-Sätze vergeben breite Tabellen-/Sequenzrechte und Function EXECUTE an Browserrollen. Keine Änderung von Standards ohne Abhängigkeits- und Regressionstest. Der bisherige Readiness-Fingerprint akzeptiert diese Baseline und ist kein vollständiger Security-Check.

Staging hat drei Tabellen ohne RLS: private market_pickup_handovers, private trade_user_eligibility (je nur postgres ACL), public market_notification_sync_state (postgres/service_role). Kein aktueller Browserzugriff aufgrund ACL; RLS als zusätzliche Absicherung und explizites Soll vor Übernahme prüfen. Alle Production-App-Tabellen haben RLS. Keine anonymen privaten Tabellenrechte gefunden.

`database/auth-privileged-step-up-v1.sql` enthält AAL2 + aktive auth.sessions-Prüfung, aber `require_duelvanta_privileged_session()` und AAL2-Code fehlen in beiden Live-Katalogen. Owner-RPCs prüfen Owneridentität, jedoch ersetzt das keine MFA. Browser-Control-Center fordert AAL2; 0 verifizierte Faktoren in beiden Projekten bedeuten zusätzlich Risiko eines zukünftigen Bedienlockouts. Serverhärtung, Rollenmatrix (Owner/Admin/Moderator/Judge), Enrollment-/Recoveryablauf und Negativtests gemeinsam vorbereiten.

Session Guard ist browserseitige Inaktivitäts-/Maximaldauersteuerung; keine serverseitige Revokationsgarantie. Bearer-Auth/User-Validierung für Checkout/Onboarding; Dispatcher/Refund Worker-Secret; Webhooksignatur vorhanden. CSRF-Risiko wird bei diesen JSON/Bearer-Pfaden durch fehlende automatische Cookieauth reduziert, aber das ist kein vollständiger CSRF-/XSS-Pentest. Rate Limits: Scannerquota/Reservationen vorhanden, kein umfassender zentraler HTTP-Rate-Limit-Nachweis für alle Trade-APIs. Owner/Judge-Grenzen vor Rollout gegen neue RPCs testen.

verify_jwt=false ist bei public-card-image und Media-Reconciler/Inspect kein alleiniger Beweis fehlender Autorisierung. Production-public-card-image-Quelltext frisch gelesen: signiert nur nach Prüfung von Accountstatus und public/custom-Folder-Sichtbarkeit, 900 Sekunden; kein Aufruf ausgelöst. Staging-Inspect prüft MEDIA_RECONCILER_SECRET; Reconciler hat eigenen Secret-/Service-Authpfad. Restprüfung: Bildpfad-/Ownership-Invarianten, Cache/Privatsphärenwechsel, exakte Abhängigkeitspins und reproduzierbare Versionierung. Gefundene Imports mit Major-Pin @2 sind kein exakter Versionslock.

Keine globale CSP-/Security-Header-Regel in vercel.json; öffentlicher GET zeigte HSTS, keine CSP/X-Frame-Options/X-Content-Type-Options. Nicht blind eine CSP aktivieren: vorhandene Inline-Skripte/CDNs benötigen gezielte Vorbereitung. SSO-Schutz bleibt an.

Supabase Security Advisors: Staging 75 INFO RLS-no-policy, 25 anon-SD WARN, 165 authenticated-SD WARN; Production 26/21/107. Beiderseits Leaked Password Protection disabled. SD-/RPC-only-Hinweise sind keine automatisch bewiesenen Schwachstellen; Stichproben zeigen beabsichtigte Ranking-/Trigger-/Ownerpfade. Findings vollständig im Evidenzpaket, keine pauschale Warnungsunterdrückung.

Quellen: https://www.postgresql.org/docs/17/ddl-rowsecurity.html ; https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## K. Backup / Rollback / Recovery

Belegtes Paket `DUELVANTA-Code-Datenbank-Backup-2026-09-11.zip` gefunden; zugehörigen Prüfbericht vollständig gelesen. Historisch logisch wiederhergestellt: 39 Anwendungstabellen, 144 Funktionen, 15 Auth-Konten/Identitäten; fünf öffentliche Avatare enthalten; **49 Collection- und 5 Marketplace-Originalbilder fehlten**. Das ist kein aktuelles vollständiges Restorepaket. Heute 17 Nutzer und 86 Storage-Objekte; fehlende Originale nicht auf dieselbe Zahl fortschreiben.

Supabase aktuelle Backups/PITR/Retention/letzter erfolgreicher Restore nicht einsehbar über verfügbare direkte Readtools; Dashboardlogin fehlt. Aktuelles vollständiges Stagingbackup inklusive Fixtures ebenfalls nicht belegt. Katalogexports dieses Preflights sind **keine Datenbackups**.

Known-good Code main `50f8821…`, Productiondeployment `dpl_ENc313pWZJMSn6y21VbURMEWLMkt`. Ein Vercel-Rollback allein macht DB-Rechte/Vertragsschema nicht rückgängig. Keine pauschale Down-Migration oder Wiederherstellung über neu entstandene Verträge/Payments. Vor Änderung vollständiges DB/Auth/Storage-/Konfigurationsbackup, isolierter Restore, Kompatibilität des Rückfalldeployments und Zeit-/Verantwortungsplan nachweisen.

Production-TRADE-Lock: UI-Gate im Branch sperrt normale Nutzer, Owner hat Diagnosebypass. `database/market-production-trade-lock-v1.sql` ist review-only, noch nicht in Production angewandt; entzieht ausgewählten Neugeschäftspfaden Rechte, lässt bestehende Abwicklung bestehen. Nach neuem Fixed-Price-Stack muss auch die serverseitige service_role-/API-Schreibgrenze geprüft werden; ein UI-Lock allein ist kein Emergencylock. Stripe Master-/Aktionsschalter und DB-Modus sowie Mailkill-Switch sind getrennte Mechanismen. Globale Stripe-OFF-Schaltung kann zugleich Webhook-Reconciliation anhalten: bei Incident kontrolliert Neugeschäft stoppen, bestehende Providerereignisse erhalten und später dedupliziert nachführen.

Recovery-Reihenfolge (nur Plan): Neugeschäft/Worker sicher stoppen → DB-/Providerzustand und letzte konsistente Sicherung bestimmen → compatible Code-Rückfall oder forward repair wählen → bei Restore zuerst Schema/Auth/Daten dann Original-Storage und sichere Providerkonfiguration → FK/RLS/Hash/Bestandsprüfung → ausstehende Stripe-/Outboxereignisse dedupliziert abgleichen → COLLECT/BATTLE/Order-Lesepfade prüfen → Funktionen nur separat freigeben. Keine irreversible wirtschaftliche Aktion durch Restore wiederholen.

## L. Observability

Vercel-Runtime-Clusterabfrage (angefragt 24h) liefert eine DEP0169 url.parse()-Warnungsgruppe, count20, letzte Sichtung 24.09. 07:13:37, Preview-API-Routen. Gelieferte firstSeen reicht bis 11.09.; deshalb keine exakte 24h-Inzidenz oder Production-Zuordnung behauptet. Kein flächendeckender fehlerfreier Betrieb daraus ableitbar.

Supabase-Logzugriff funktioniert, Aggregate für Auth/Postgres/PostgREST/Storage/Edge erfasst. Production im abgefragten level-Feld keine error-Gruppe; mehrere Quellen haben kein level-Feld. Staging eine function_logs-error-Zeile, Function-ID `6cb7e550-a1e0-43ab-85d9-d2af99846ad9`, frisch dem battle-spectator-media-reconciler zugeordnet; Nachricht über abgefragtes Feld leer, Ursache noch nicht geklärt; daneben Auth-Warnungen. Kein globaler grüner Logstatus.

Payment attempts, Refund-/Event-Ledger, Outbox, Seller-Restrictions, Scannerquota und Battle-/Media-Zustände sind grundsätzlich auswertbar. Kein belegter aktiver Ende-zu-Ende-Alarm für Deadletter, hängende Zahlungen, Disputes/Chargebacks, Seller-Capabilityverlust, Scannerbudget oder Battle-Media-Revocationfehler. Alarmempfänger, Schwellen, Laufbuch und Incidentverantwortung vor jeweiligem Featurelaunch festlegen; keine Benachrichtigung gesendet. Stripe-Webhooks/Events providerseitig unbestätigt wegen Reauthentication.

## M. Synthetische Evidenz erhalten

| Objekt | 7A | 7B |
|---|---|---|
| Listing | 19e7bdbe-aea4-481b-9bce-49160e7c3030 | 4f8fa6ad-8c11-4df2-9283-795b252d5236 |
| Offer | e334e1a0-179c-4d68-aeee-7b9e2b5aea7e | a6582e51-8cb0-4eb3-8d62-6e701dafc446 |
| Deal | ae2c4fd7-8c7b-4eb0-9c85-9fcf2b16c53e | ddd5122f-c6ee-4840-80fd-584529436886 |
| Order | 42d7cd8a-1705-4197-9017-ad029288c812 | 90f5a50f-5fb6-4882-9572-2b359257dd9f |
| Nummer | DV-260923-000014 | DV-260924-000015 |
| Snapshot | 801ae92b-9569-4178-a1c2-2ece5165d6a3 | a4642a8f-3167-42c1-953b-eb3e9234b611 |
| Withdrawal | 7b0f82d7-9d3c-40f0-8f7f-851737efab94 | keiner |
| Payment Attempt | keiner | af15faff-b883-4db5-ac56-3da50d902921 |

Gemeinsamer Trader `2fe2dfab-2802-46ac-8c7b-2804eae2be8e`, Buyer `e81841df-2b08-45c1-a2d7-2671f8c58f7d`; TEST Account `acct_1UFU7JDwFcjtFwoY`. 7B Request `722c431d-8e58-4e23-9b62-0de51df0b295`. Exakte TEST-Sessionreferenz in V50/7B-Bericht erhalten; kein vollständiger Checkoutlink übernommen.

Eindeutig synthetisch durch dokumentierte Identitäten, Produktnamen „SYNTHETIC … DO NOT BUY“, Testgrafik und invalid.example-Empfänger. Vor Stagingrefresh diese ID-/Hash-Zusammenhänge separat sichern; Auswertungen für Umsatz, DAC7, Conversion und Zustellbarkeit anhand Testprojekt plus Fixture-Register ausschließen. Kein nachträgliches Überschreiben unveränderbarer Snapshots zur Markierung; kein Löschen und keine Übernahme nach Production. Gleiches gilt für historische TEST-Payments/Refunds.

## N. Kontrollierter späterer Rollout – Entwurf, NICHT ausgeführt

1. Releaseumfang ausdrücklich festlegen: zunächst COLLECT/BATTLE-Beta mit TRADE geschlossen. Öffentlicher Handel, Mail und Stripe Live bleiben eigene Freigaben. Legal/Tax/Providerfreigaben für tatsächlich freigeschaltete Funktionen einholen.
2. P0-02 im Branch/isoliert und anschließend separat autorisiert auf Staging beheben: Least-Privilege, RLS-Soll, AAL2/session guard. Regressionen, Readiness-Soll und Recovery/Enrollment gemeinsam überprüfen.
3. Vollständiges versioniertes Upgrade-Manifest vom **Production-Basisschema** zum getesteten Ziel erstellen. Baseline-Quellen, Migration-Reihenfolge, Backfills, Constraints/ACL und bewusst nicht übernommene Staging-Fixtures ausweisen. Nicht die laufende Production zur Sollquelle machen.
4. Vollständige aktuelle DB/Auth/Storage-Sicherung und isolierten Restore beider Umgebungen nachweisen. Upgrade und compatible Rollback/Forward-Recovery dort proben, bestehende 9 Production-Deals/7 Orders als Migrationsrisiko berücksichtigen, keine Echtdaten ungeschützt in CI.
5. Release-SHA/CI/Manifest einfrieren; Branch-/main-/PR-/Deployment-/Env-Baseline erneut attestieren. Production-Keys/Scopes, Auth-Redirects, Domains, Backupfrische, kill switches und Operatorzugang prüfen.
6. **Separate ausdrückliche Autorisierung** für Production-Schreibsperre/Migration einholen. Vor Ausführung laufende Vorgänge inventarisieren, Neugeschäft serverseitig schließen; Snapshot direkt davor. Zeitfenster/Abbruchbedingungen festhalten.
7. Abgenommene Migrationskette ausführen; Production-spezifischen TRADE-Lock nach Marketplace-Migrationen als letzte Schreibgrenze setzen. Stripe/Mail bleiben OFF; keine Staging-Konten/Secrets/Provider-IDs kopieren.
8. Schema-Readiness, Datenintegrität, private Grenzen, RLS/ACL, Owner-AAL2 und Nachmigration-Zähler bestätigen. Bei Abweichung kein Deploy; sicheren Recoveryplan anwenden.
9. **Separat autorisierten** Merge/Production-Deploy des geprüften SHA vornehmen. Nie main vor kompatiblem Schema automatisch veröffentlichen. Production muss ausschließlich Production-Supabase verwenden.
10. Begrenzter Smoke-Test von Login/COLLECT/BATTLE und lesender Orderverwaltung; Trade für normale Nutzer geschlossen. Keine Zahlung/Mail ohne eigene Freigabe. Monitoring aktiv beobachten.
11. Öffentlichen TRADE-Launch erst nach P1-Nachweisen, Rechtstexten, Seller-Enforcement, Widerruf-/Bestätigungsbetrieb und abgenommenem Unlock. Bestehende Orders nicht durch Notfallsperre unzugänglich machen.
12. Stripe-Live-DB/Onboarding/Webhooks/Payments/Refunds und Compliancezustellung je separat vorbereiten, testen und autorisieren; tatsächliche Händlerdarstellung, Gebühren/Tax und Verantwortlichkeiten vorher bestätigen. Kontrollierte Freigabe statt gemeinsamer Schalteraktion.
13. Rollbackkriterien: Environmentmismatch, fehlende Schemaobjekte/Rechte, unerwartete Hash-/FK-/Bestandsabweichung, fremder Zugriff, doppelte Orders/Events, nicht erklärbare Zahlungszustände, Zustellfehler, Schlüssel-/Scopefehler. Neugeschäft anhalten und Evidenz bewahren; Code-Rollback nur bei bewiesener DB-Kompatibilität.

## O. Blockerregister

P0 bezieht sich auf den nächsten Rollout dieses Entwicklungsstandes; es ist keine Aufforderung, die bestehende Beta heute abzuschalten. P1 gilt spätestens für den genannten öffentlichen Featurelaunch. P2 ausschließlich vor Stripe Live. Keine Scores/Prozentwerte.

| ID / Klasse | Befund und Risiko | Konkret notwendige Maßnahme | Verantwortung / Bereich |
|---|---|---|---|
| P0-01 | Production fehlt großer Schema-/Code-Stack; letzte Legal-Migration allein unzureichend. Inkompatible Funktionen/Rechte gefährden bestehende Orders. | Quellengebundenes Gesamtmanifest, sichere Backfills, isoliertes Production-Baseline-Rehearsal und Rückfallkompatibilität. | Engineering / Code + Supabase |
| P0-02 | Breite Browser-/Default-Rechte, teilweise RLS aus, serverseitige AAL2-Migration fehlt, 0 verifizierte MFA-Faktoren. | Least-Privilege-/RLS-/AAL2-Kandidat im Branch, funktionale Negativtests, Enrollment/Recovery; keine pauschale Live-Repair-SQL. | Security/Engineering + Betreiber / Code + Supabase |
| P0-03 | Nur historisches unvollständiges Backup; heutiger Auth/Storageumfang größer; Restorefähigkeit unbestätigt. | Frische DB/Auth/Storage- und Konfigurationssicherung, vollständiger isolierter Restore, verantworteter Recoveryplan. | Betrieb / Supabase + Storage + Vercel |
| P0-04 | Production-Serverkonfiguration fehlt; Secret-Zielbindung und Auth-Redirects unbestätigt. | Produktionsgetrennte Scopes/Projektbindung attestieren und erforderliche Werte später separat konfigurieren; Authallowlist/Callbacks read-only belegen. | Betrieb/Engineering / Vercel + Supabase |
| P0-05 | UI-TRADE-Lock ersetzt keinen bewiesenen serverseitigen Emergencylock; neuer Fixed-Price-/service_role-Pfad mitprüfen. | Vollständige Schreibpfadabdeckung und bestehende Abwicklung isoliert testen, Production-Lockkandidat in Migrationsmanifest. | Engineering / Code + Supabase |
| P1-01 | Rechtstextbestand/Updateprozess und individuelle Provider-/Datenschutzabdeckung nicht abgenommen. | Kanzlei-Endprüfung, IT-Recht-Integration/Updateverantwortung, vollständige Händler-/Widerrufs-/Vertragstexte; keine Eigenfreigabe. | Betreiber + Kanzlei / Legal + Code |
| P1-02 | Seller-Onboarding-Enforcement aktuell false; reale Händler-/Tax-/Notice-Betriebsprozesse nicht freigegeben. | Händlerprüfung/Publikationsregeln, Notice-/Eskalationsbetrieb, DAC7-Meldeweg und Retention extern bestätigen, anschließend technisch abnehmen. | Betreiber + Legal + Tax / Supabase + Code |
| P1-03 | Compliance-Mail OFF, Provider/Domain/Reply-To/Scheduler/Delivery-Bounce-Betrieb fehlen als Nachweis. | Getrennte Versandkonfiguration, freigegebene Vorlagen, deduplizierter Dispatcher und Fehleralarme, Zustellnachweis vor öffentlichem TRADE. | Betrieb/Engineering + Legal / Vercel + Code |
| P1-04 | Scanner-/Medien-Providerretention, Accounting-Erasure und DPA/Region nicht vollständig belegt. | Datenarten-/Provider-Matrix und rechtlich abgestimmte Lösch-/Exportbehandlung; LiveKit/STUN/OpenAI-Flüsse freigeben. | Datenschutz/Engineering / Legal + Code + Provider |
| P1-05 | .com/www.com, vollständige Canonicals/Header und SPF/DKIM/DMARC unbestätigt. | DNS/TLS-/Maildomainnachweise aus erreichbarer autorisierter Quelle; konsistente .de-Weiterleitung und sichere Header vorbereiten. | Betrieb / DNS + Vercel + Mail |
| P1-06 | Keine nachgewiesenen Ende-zu-Ende-Alarme; Staging-Functionerror ungeklärt. | Fehler zuordnen, Alarmempfänger/Runbook und hängende Outbox/Payment/Seller-/Battle-/Scannerzustände überwachen. | Betrieb/Engineering / Vercel + Supabase |
| P1-07 | Kein frischer umfassender History-/Dependency-/GitGuardian-Nachweis; Rate-Limit-/Session-/CSP-Abdeckung partiell. | Releasegebundener Security-/Supply-Chain-Check, passende Rate-Limits/Headers, Leaked-Password-Protection bewerten. | Security/Engineering / Code + Supabase + Vercel |
| P2-01 | Live-DB-Funktionen nicht angewandt/abgenommen, Live-Providerkonfiguration nicht verifiziert. | Separate Live-Rehearsal-/Freigabe mit Accounts-v2-Ereignissen, Endpoint, Capabilities, Onboarding, Modegrenzen und Idempotenz. | Payment Engineering / Stripe + Supabase + Vercel |
| P2-02 | Generisches/historisches Connected-Account-Branding kann falsche Händlerdarstellung erzeugen. | Account-/Business-Profile-/Statement-Descriptorprüfung und bestätigte Händlernamen-/Rollenwechselstrategie; keine Vermutungsänderung. | Betreiber + Payment Engineering + Legal / Stripe + Code |
| P2-03 | Gebührensteuer review_required; Refund-/Dispute-/Chargebackbetrieb nicht vollständig live-abgenommen. | Gebühren-/Rechnungs-/Taxfreigabe, vollständige Reconciliation und Incident-/Refundverantwortung testen. | Betreiber + Tax + Engineering / Stripe + Code |
| P3-01 | Komfort/Skalierung nach abgesicherter Beta. | Erweiterte Dashboards, Performanceoptimierung, zusätzliche Spiele/App separat priorisieren; keine Sicherheits-/Rechtspflichten hierhin verschieben. | Produkt/Engineering / Code |

## P/Q. Ausführung, Grenzen und Übergabe

Kein HARD STOP zur Durchführung der Bestandsaufnahme nötig: fehlende Zugriffe sind Nachweisblocker, die hier ohne Mutation dokumentiert werden können. Sicherheitsbefunde lassen sich als nächster isolierter Branch-Kandidat bearbeiten; eine sofortige Production-Reparatur war weder erforderlich noch autorisiert. Keine neue Rechts-/Steuerentscheidung getroffen. Keine Readiness-Codeänderung erforderlich.

Nicht ausgeführt: Merge, Branchwechsel, Reset, Force-Push, Productionmigration/-SQL-Mutation/-Deployment, Env-/Domain-/Stripeänderung, Sandboxaktivierung, Zahlung, Refund, Payout, E-Mail, Datenbereinigung, Backuprestore, Änderung eines Schutzmechanismus oder kommerzielle Freigabe. Ausschließlich Dokumentation/Evidenz auf marketplace-ux-v1 veröffentlichen; etwaige Git-integrierte Preview/CI-Läufe sind keine manuelle Production-Bereitstellung.

Evidenz: versionierte JSON-/GZIP-Inventare, klassifiziertes Diffregister, Workspaceinventar, frische Fixture-/Staginggesundheit, Deployment-/Scopeinventar, begrenzter Secret-Scan und fehlgeschlagene DNS-/Domainproben. Kein Vollständigkeitsbeweis über unzugängliche Providerdaten. Historische Backup-/7A-/7B-Nachweise ausdrücklich getrennt.

**V51 legt als nächsten einzigen Block Schritt 9A – Berechtigungs- und MFA-Härtung als getesteten Branch-/Staging-Kandidaten fest. Nach Erstellung und Veröffentlichung von V51 STOP.**
