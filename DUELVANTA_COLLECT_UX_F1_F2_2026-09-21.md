# DUELVANTA – COLLECT F1/F2, 21.09.2026

## Ausgangspunkt und Umfang

- Repository `Bennyescaped/duelvanta`, ausschließlich `marketplace-ux-v1`.
- Ausgangs-Head unverändert: `31e20cdad63e0ba93650a0aa2e6f71035978e3b2`.
- Grundlage: Erstnutzer-/Mobile-UX-Bericht vom 21.09.2026 sowie V30 einschließlich Nachtrag vom 21.09.2026.
- Ausschließlich F1/F2. Keine Änderung von Daten, Datenbank, Routing, Gates, Rechtstexten, Zahlungsabläufen, Scannerfreigabe oder BATTLE. Der globale Zahlenhelfer bleibt unverändert.

## Änderungen

- `collect.html`: gemeinsame Statusanzeige für Liste und Binder; echte Leerbestände werden von fehlenden Such-/Filtertreffern getrennt. Master, Graded und eigene Binder haben passende Leertexte. Lade- und Fehlerzustände werden ausdrücklich angezeigt, ohne leere Bestände oder Nullwerte vorzutäuschen.
- `collect-ux.js`: lokale, ausschließlich darstellende Preisaggregation. Fehlende Preise bleiben unbekannt; explizite Nullpreise zählen als bekannte Werte. Unvollständige Kauf-/Referenzsummen zeigen die bekannte Teilsumme mit Hinweis. Ohne Referenzwerte: „Nicht bewertet“. Gesamt-P/L bleibt bei unvollständiger Preisbasis neutral „—“ mit Erklärung. Echter Leerbestand zeigt „— / Keine Karten“. Mengenmultiplikation bleibt erhalten.
- Portfolio, Binderkacheln und Liste nutzen dieselbe Preislogik. Kleine Umbruch-/Hinweisregeln verhindern überlappende längere Preisangaben. Logo, Slogan und Schwarz-Gold-Gestaltung bleiben erhalten.
- Der bestehende Binder-Renderer-Adapter, feste Plätze, Seitensteuerung, Drag-and-drop und sämtliche Schreibpfade bleiben unverändert.
- `tests/collect-ux-test.mjs` und `tests/collect-ux-browser-test.mjs`: isolierte Fixtures; in vorhandene CI aufgenommen (`.github/workflows/scanner-v16-check.yml`).

## Lokale Prüfung

Browser: Playwright mit Chromium 140.0.7339.186, headless. Tatsächlich gesetzte und über `innerWidth/innerHeight` gemessene Viewports: **1363 × 844** und **390 × 844 CSS-Pixel**. Kein Browserzoom. Originale COLLECT-Seite einschließlich Binder-Adapter, ausschließlich lokale synthetische Daten; externe Anfragen blockiert. Keine Staging-Schreibvorgänge und keine kostenpflichtigen Aufrufe.

| Prüfung | Ergebnis |
| --- | --- |
| Echte Leerbestände: Master, Graded, eigener leerer Binder; Liste/Binder | PASS |
| Suche und TCG-/Gradingfilter; keine Treffer; Zurücksetzen zeigt vorhandene Karten wieder | PASS |
| Fehlende, gemischte und vollständige Preise, explizite Nullpreise, Mengen > 1, unvollständiges P/L | PASS |
| Initiale Lade-/Fehlerzustände werden nicht als Leerbestand dargestellt | PASS |
| Eigener Binder: feste Kartenplätze auf Seite 1/2 und Seitennavigation | PASS |
| Desktop und 390 CSS-Pixel: keine horizontale Dokumentüberbreite; Preisangaben sichtbar | PASS |
| `collect-ux-test.mjs`, `collect-ux-browser-test.mjs` | PASS |
| `scanner-v16-binder-layout-test.mjs` | PASS |
| `runtime-routing-contract-test.mjs`, `supabase-runtime-config-test.mjs` | PASS |
| `scanner-v16-contract-test.mjs`, `scanner-v16-acceptance-regression-test.mjs` | PASS |
| `scanner-v16-collect-e2e.mjs` – lokaler bestehender Integrationstest mit Provider-Mocks | PASS |

Screenshots des lokalen Browserlaufs: `test-results/collect-ux-{1363,390}-{mixed,missing}.png` (generierte, nicht versionierte Testartefakte).

## Getrennte Prüfgrenzen

Angemeldete Preview-Prüfung und CI des neuen Commits erfolgen nach Push und werden im Abschluss separat angegeben. Lokale Fixture-Ergebnisse ersetzen keine angemeldete Preview-Abnahme. Vor einer solchen Prüfung ist die neue Preview erneut `DUELVANTA-STAGING / xhmjxrcskfhbovhitdej` zuzuordnen.

Echte iPhone-/Android-Hardware, Kamera, Medienübertragung, Erkennung und kostenpflichtige Scans: **NICHT GETESTET**. Keine neuen Matches oder Provideraufrufe.

Keine bestehenden Staging-Testbestände verändert; keine neuen Staging-Testdaten angelegt. Der bereits dokumentierte leere Testbinder `UXCHECK SYNTHETISCH 20260921` bleibt unangetastet. F3 und die ungeprüften Teile des ursprünglichen UX-Checks bleiben offen. Keine Gesamt-, Rechts- oder Produktionsfreigabe.
