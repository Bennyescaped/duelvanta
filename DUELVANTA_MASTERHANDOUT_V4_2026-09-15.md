# DUELVANTA – Masterhandout V4

Stand: 15.09.2026, nach Abschluss des post-payment Order-Lifecycles, Versandprofil-/Combined-Shipping-Prüfung, Provider-Refund-UX-Abgleich und Mobile/Desktop-Marketplace-Abnahme.

## 1. Verbindlicher Ausgangspunkt

Dieses Dokument ist ab sofort der aktuelle Übergabestand für DUELVANTA. Es ersetzt widersprechende Statusangaben älterer Masterhandouts.

Entwicklung weiterhin ausschließlich auf `marketplace-ux-v1` / Preview / Staging. Produktion, `main` und produktives Supabase unverändert lassen.

Nicht erneut die vollständig abgeschlossene Stripe-Connect-Sandbox-Abnahme durchführen, sofern nicht nach einer späteren Payment-Änderung ausdrücklich eine Regression erforderlich ist.

## 2. Verbindliche Repository-/Deployment-Stände

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- neuer geprüfter technischer Code-Checkpoint: `d1bb533c9ca69a9d33c99bd4378d419abeca897e`
- Commit: `Add desktop TRADE browser acceptance`
- PR: #5, weiterhin **Draft**, offen und nicht gemergt
- Produktion / `main`: unverändert `50f88213571be13255bb52eb489cc28cca660001`
- GitHub Actions: `Scanner V16 Check` Run #216 = `success`
- geprüftes Preview-Deployment: `dpl_3dnWuS1v6ccLLDB4ACr4pWWTf6uh`
- Preview-Status: `READY`
- Preview-Code: exakt `d1bb533c9ca69a9d33c99bd4378d419abeca897e`
- Supabase-Staging-Projekt: `xhmjxrcskfhbovhitdej`
- Stripe-Sandbox bleibt deaktiviert:
  - DB `sandbox_enabled = false`
  - DB `live_mode = false`
  - keine Live-Zahlung, Live-Erstattung oder Live-Auszahlung

Wichtig: Falls das Ablegen dieses Masterhandouts den Branch-Head auf einen reinen Dokumentations-Commit verschiebt, bleibt `d1bb533...` der geprüfte technische Code-Checkpoint.

## 3. Harte Grenzen

- Produktion nicht verändern.
- `main` nicht verändern oder mergen.
- produktives Supabase nicht verändern.
- keine Live-Zahlung, Live-Erstattung oder Live-Auszahlung ausführen.
- Stripe-Live-Schlüssel nicht in Preview/Staging verwenden.
- `v-logo.svg` niemals verändern oder neu interpretieren.
- Slogan unverändert: `COLLECT. TRADE. BATTLE.`
- COLLECT, BATTLE, PROFILE und stabile TRADE-Bereiche nicht unnötig redesignen.
- Payment-, Steuer- und Vertragsbelege nicht nachträglich mutieren.
- Kein zweiter Refundpfad neben dem bestehenden serverseitigen Providerpfad.

## 4. Stripe-Connect-Sandbox-Abnahme – weiterhin vollständig abgeschlossen

Der in V3 dokumentierte Stripe-Abnahmeblock bleibt vollständig gültig und wurde nicht erneut ausgeführt.

Abgeschlossen bleiben insbesondere:

- Stripe-Connect-Onboarding
- erfolgreiche Testzahlung
- Fehlerzahlung
- Webhook-Wiederzustellung / Idempotenz
- vollständiger Refund
- Refund-ID-Reconciliation
- Teilrefund-Schutz
- Payout-Sicherheit
- Datenexport
- Löschblocker
- RLS-/Browsergrenzen

Bekannte Abnahmeorders bleiben ausschließlich Staging-Belege:

- `DV-260913-000004`: erfolgreiche Zahlung, anschließend vollständig erstattet
- `DV-260915-000007`: absichtlich fehlgeschlagene Zahlung

Keine dieser Staging-Daten in Produktion übertragen.

## 5. Block 1 – TRADE-/Order-Lebenszyklus nach Zahlung abgeschlossen

### Gefundene und behobene Lücke

Die Browser-UI hatte Versand bereits nur bei `payment_status in ('not_required','paid')` angeboten. Die serverseitige Funktion `mark_market_order_shipped` blockierte jedoch nur einzelne negative Zustände (`pending`, `balance_due`, `failed`). Dadurch war die RPC-Invariante schwächer als die UI und ein Zustand wie `refunded` nicht als positive Allowlist ausgeschlossen.

Umgesetzt:

- neue additive Datei `database/trade-order-lifecycle-payment-hardening-v1.sql`
- Versand ist jetzt serverseitig positiv freigegeben:
  - `manual_beta`: nur `not_required` oder `paid`
  - integrierter Provider / `stripe_connect`: ausschließlich `paid`
- `refunded`, `failed`, `pending`, `balance_due` können nicht in Versand übergehen
- Erhalt/Abschluss war bereits serverseitig korrekt payment-gebunden und blieb unverändert
- `get_my_trade_actions()` zeigt die Erhalt-/Abschlussaktion ebenfalls nur bei zulässigem Paymentzustand
- direkte/alte RPC-Aufrufe können die Payment-Grenze nicht umgehen

Relevante Commits:

- `3ff926b5e339a252acbd902f4c238058369bcf02` – `Harden order lifecycle payment gates`
- `9c4e7e84cc85e2b45c09d71e63c363e8aae58469` – `Cover lifecycle payment action gates`

Staging-Verifikation:

- `shipment_positive_gate = true`
- `stripe_requires_paid = true`
- `action_payment_gate = true`
- Sandbox blieb währenddessen deaktiviert

Benachrichtigungen bleiben unverändert und korrekt dedupliziert:

- Versandbenachrichtigung bei erstmaligem `shipped_at`
- Erhaltbenachrichtigung bei erstmaligem `received_at`
- keine doppelte Notification durch wiederholte Zustandsverarbeitung

## 6. Block 2 – Verkäufer-Versandprofile / Combined Shipping geprüft und final bestätigt

Bestehende Architektur wurde geprüft und nicht unnötig verändert.

Vorhanden und bestätigt:

- private wiederverwendbare Käufer-Lieferadresse
- Verkäufer-Versandprofile für DE / AT / CH
- Versandarten `standard_letter`, `tracked_letter`, `parcel`, `custom`
- Produktbereiche `all`, `cards`, `sealed`
- Tarifregeln über Maximalmenge, Gewicht, optionale Maße und Versandkosten
- Sealed / `all` benötigen serverseitig Maximalmenge **und** Maximalgewicht
- RLS/RPC-Isolation der Versandprofile bleibt erhalten
- automatische Berechnung wählt nur eine sicher passende Regel
- sichere Treffer werden deterministisch nach Versandkosten, Profilalter, Sortierung und ID ausgewählt
- passt keine sichere Regel, wird **nicht geraten**: `shipping_quote_status = review_required`
- manueller Gesamtversand bleibt der sichere Fallback
- Null-/Missing-Profile-Fallback kann keine ungültigen NULL-Versandwerte schreiben

Staging-Prüfung:

- vor und nach Prüfung: `0` dauerhafte Versandprofile / keine Testreste
- CRUD-/Tarifprobe wurde ausschließlich transaktional durchgeführt und vollständig zurückgerollt
- bestehende Shipping-/Null-Fallback-Regressionen: grün

Damit ist für diesen Block kein Produktcode-Umbau erforderlich.

## 7. Block 3 – Problem-/Storno-/Refund-UX auf Providerpfad abgestimmt

Gefundene Abweichung:

`trade-order-resolution.js` enthielt noch ältere Beta-Texte, die pauschal behaupteten, DUELVANTA verarbeite keine integrierte Zahlung bzw. keine Provider-Erstattung. Das widersprach dem inzwischen abgenommenen Stripe-Providerpfad.

Gezielt geändert:

- `refundText()` beschreibt jetzt den real vorhandenen Providerzustand
- `external_payment_unknown`: externe/manual-beta-Zahlung bleibt außerhalb des Providerpfads
- `provider_required` / `accepted_refund_pending`: Order bleibt gesperrt und wartet auf die bestehende vollständige Provider-Erstattung
- `pending`: Provider verarbeitet die Erstattung
- `refunded`: Provider hat bestätigt
- `failed`: Erstattung muss geprüft werden
- Stornoanfrage selbst löst keine Erstattung aus
- akzeptierte bezahlte Provider-Order wird nicht parallel storniert, sondern wartet auf den bestehenden Server-/Provider-Refundpfad
- Problemfall selbst löst keine automatische Erstattung aus
- keine neue Refund-API und keine zweite Refund-Logik gebaut

Zusätzlich:

- `trade-order-resolution.js` interne Version auf `1.1`
- `trade.html` Cache-Buster auf `trade-order-resolution.js?v=1.1`, damit Browser nicht die alte UX weiterverwenden
- Regressionstest schützt gegen Rückkehr der veralteten Beta-Aussagen

Relevante Commits:

- `62c4960918513345a0034888775a9e668e8bbea9` – `Align cancellation UX with provider refund flow`
- `465c30a197405714fbbd34ebff2b077e089fd14a` – `Guard provider-aware resolution UX`
- `14725ce878a0741fcb2b32e60c7fcad27a9969da` – `Bump resolution module cache version`

## 8. Block 4 – Marketplace-Gesamtabnahme Mobile/Desktop vorbereitet und grün

Gefundene Testlücke:

Der echte Playwright-TRADE-E2E prüfte bislang nur einen mobilen Viewport (`390 × 844`). Desktop war nicht als eigenständiger Browser-Viewport mit Fehler-/Overflow-Prüfung abgedeckt.

Umgesetzt in `tests/trade-browser-e2e.mjs`:

- Mobile: `390 × 844`, Touch/Mobile
- Desktop: `1440 × 1000`
- beide Viewports prüfen:
  - `ALL UI TESTS PASSED`
  - keine Browser-`pageerror`
  - kein horizontaler Overflow
  - eigener Screenshot als Testartefakt
- Testausgabe enthält Mobile und Desktop getrennt

Finale CI-Evidenz aus Run #216:

- `PASS: real SQL action queries, ordering, ownership, anonymous denial and payment-gated lifecycle actions`
- `PASS: order cancellation/problem contract, provider-aware refund UX, inventory restoration and RPC isolation`
- `PASS: private address + seller shipping profile contract, RLS, RPC isolation, sealed safety and auto/manual fallback`
- `PASS: Combined Shipping missing-profile fallback cannot write NULL shipping values`
- `ALL UI TESTS PASSED — mocks only, no live transaction.`
- `PASS: TRADE browser acceptance on mobile and desktop viewports`
- Job `Trade contracts and mobile order flow` = success
- Job `Browser evidence` = success
- gesamter `Scanner V16 Check` Run #216 = success

Relevanter Commit:

- `d1bb533c9ca69a9d33c99bd4378d419abeca897e` – `Add desktop TRADE browser acceptance`

## 9. Aktueller Sicherheits-/Umgebungszustand

Nach allen Änderungen erneut verifiziert:

- `main = 50f88213571be13255bb52eb489cc28cca660001`
- PR #5 = open, Draft, nicht gemergt
- Staging `sandbox_enabled = false`
- Staging `live_mode = false`
- keine dauerhaften Versandprofil-Testdaten (`0` Profile nach Rollback)
- aktuelles technisches Preview ist READY
- keine Produktion verändert
- kein produktives Supabase verändert
- keine Live-Zahlung, Live-Erstattung oder Live-Auszahlung durchgeführt

## 10. Damit abgeschlossene V3-Entwicklungsblöcke

Die im Masterhandout V3 definierten vier Folgeblöcke sind abgeschlossen:

1. TRADE-/Order-Lebenszyklus nach erfolgreicher Zahlung – abgeschlossen und payment-gehärtet
2. Verkäufer-Versandprofile / Combined Shipping – geprüft, sichere Fallbacks bestätigt
3. Problem-/Storno-/Refund-UX – auf bestehenden Providerpfad abgestimmt
4. Marketplace Mobile/Desktop – Browser-Abnahme erweitert und grün

Diese Punkte nicht ohne neue Regression erneut komplett durchtesten.

## 11. Nächster Entwicklungsblock

Der nächste sinnvolle Schritt ist jetzt **Produktionsfreigabe-Vorbereitung**, noch ohne Merge oder Live-Schaltung:

1. Release-/Security-Gesamtaudit des aktuellen Marketplace-Branches gegen die Produktionsfreigabe-Checkliste.
2. Offene rechtliche/steuerliche Go-Live-Punkte und Konfigurationsschalter klar von technisch abgeschlossenen Punkten trennen.
3. Produktionskonfiguration als dokumentierten, weiterhin deaktivierten Rolloutplan vorbereiten.
4. PR #5 erst nach dieser Schlussabnahme aus Draft nehmen; `main` bis dahin unverändert lassen.
5. Stripe-Live-Rollout bleibt eine separate bewusste Entscheidung und darf nicht automatisch aktiviert werden.

Vor tatsächlicher Produktionsfreigabe weiterhin erforderlich:

- rechtliche/steuerliche Schlussprüfung
- finale Produktionskonfiguration
- bewusste Entscheidung zum Stripe-Live-Rollout
- abschließende Security-/Release-Abnahme
- kontrollierter Merge-/Rollback-Plan

## 12. Arbeitsmodus

Compact Development Mode weiterhin beachten:

- gezielte Prüfungen statt Wiederholung bereits grüner Tests
- nur geänderte Funktionen/Dateien anfassen
- keine unnötigen Login-/Browser-Schleifen
- keine Behauptung absoluter Fehlerfreiheit
- Produktion und `main` nie nebenbei verändern
- nach dem nächsten größeren abgeschlossenen Block Masterhandout erneut aktualisieren
