# DUELVANTA – mobile COLLECT-Nachträge M1–M3

Stand: 21.09.2026. Ausschließlich `Bennyescaped/duelvanta`, Branch `marketplace-ux-v1`.

## Ausgangspunkt und Evidenzarten

Remote-Head vor Beginn unverändert `0d502c496d0bbe0af61a65d9d2f7d535b7a0cfae`. V30 einschließlich Nachtrag vom 21.09.2026 und `DUELVANTA_COLLECT_UX_F1_F2_2026-09-21.md` vollständig gelesen. Die vorherige lokale Kopie enthält den inhaltsgleichen lokalen Commit `ebe700e…`; gearbeitet wurde in einer frischen Kopie desselben Branches am Remote-Head. Kein Reset, kein Branchwechsel.

Der vom Nutzer im Auftrag übermittelte iPhone-/Safari-Teiltest bestätigt Suche/Zurücksetzen, vier Listeneinträge, unbekannte Preise, Öffnen des Kartendialogs und Abbrechen. Das sind **Nutzernachweise aus einem separaten Chat**, keine hier selbst ausgeführte Hardwareprüfung. Die dortigen Screenshots wurden für diesen Auftrag nicht erneut ausgewertet. Speichern, gemischte Preise, Scanner und BATTLE sind damit nicht abgenommen.

M1–M3 sind neue mobile Darstellungsnachträge. F1/F2-Preisberechnung und Leerzustände bleiben unverändert; F3/Binder-Löschung bleibt offen und unberührt.

## Befunde, Korrekturen und Grenzen

### M1 – Dialog / Fokus / Kaufdatum

Reproduktion mit lokaler synthetischer Fixture: COLLECT → Liste → Bearbeiten → Kartenname fokussieren → Kaufdatum befüllen → vertikal zum Dialogende scrollen → Abbrechen.

Vorher berechnete Schrift für Kartenname und Kaufdatum: **13,3333 px** bei 390 und 430 CSS-Pixeln. Diese zu kleine Eingabeschrift ist die hier nachgewiesene Voraussetzung für den gemeldeten unerwünschten Safari-Fokus-Zoom; der Safari-Zoom selbst ist in Chromium nicht reproduzierbar.

Korrektur: ausschließlich im Kartendialog bei maximal 850 px Eingabeschrift **16 px**; Feldcontainer `min-width:0`, Eingaben maximal 100 % breit. Vorhandene Dialogbreite und vertikales Scrollmodell bleiben erhalten. Kein `user-scalable=no`, keine Maximum-Scale-Sperre, kein Zoom-Reset, kein erzwungener Fokusentzug und keine feste Aktionsleiste.

| Chromium-Messung | 390 × 844 | 430 × 844 |
| --- | --- | --- |
| Dialogbreite vor/nach Fokus | 352 px | 392 px |
| Kartenname / Kaufdatum – äußere Feldbreite | jeweils 306 px | jeweils 346 px |
| Mobile Eingabeschrift nach Korrektur | 16 px | 16 px |
| Abbrechen und Speichern nach vertikalem Scrollen | vollständig im Viewport | vollständig im Viewport |

**Kaufdatum gesondert:** Eine gegenüber anderen Feldern größere äußere Breite wurde in Chromium weder vor noch nach der Korrektur reproduziert. Die Breitenbegrenzung ist eine lokale Schutzregel; eine eigenständige Safari-Ursache oder Behebung des iPhone-Datumsproblems wird nicht behauptet.

**Hardware-Nachprüfung offen:** Safari-Fokus-Zoom, Tastatur ein/aus, anschließend Dialogränder/Kaufdatum und Erreichbarkeit beider Aktionen auf dem Nutzer-iPhone prüfen.

### M2 – Preisstatus-Texte

Vorher: „Preisangaben“ brach bei 390 und 430 px innerhalb des Wortes um (28 px Schrift bei 141 bzw. 161 px verfügbarer Textbreite). Nachher: nur die Statuswerte „Keine Preisangaben“ und „Nicht bewertet“ erhalten 18 px Systemschrift und normalen Wortumbruch. Beide Wörter bleiben ungeteilt; keine Überlagerung oder Textkürzung.

Numerische Werte, gespeicherte Nullpreise, fehlende Preise, bekannte Teilsummen, Mengenmultiplikation und Gewinn/Verlust-Berechnung sind nicht verändert. `collect-ux.js` bleibt bytegleich.

### M3 – Binder-Ersatzdarstellung und Listenlabels

Vorher: Die vorhandenen `.slotMeta`-Kartennamen wurden bis 620 px generell ausgeblendet. Außerdem existierte die responsive `data-label`-Darstellung, aber die betreffenden Tabellenzellen hatten keine Labels.

Nachher: Bis ein vorhandenes Bild erfolgreich geladen ist, zeigt der Platz den vorhandenen Kartennamen in 12 px lesbarer Schrift. Fehlender Bildpfad oder Bildfehler behalten diese Ersatzdarstellung. Lange Namen bleiben im unveränderten festen Platz scrollbar; Kartenpreis und Verschieben-Schaltfläche erhalten eigenen freien Platz. Kartennummern werden bei größeren Ansichten zusätzlich angezeigt; auf schmalen Ansichten zugunsten des Namens ausgeblendet.

Erfolgreich geladene Bilder behalten ihre vorhandene Darstellung. Ein delegierter Load-/Error-Handler setzt nur eine Präsentationsklasse. Keine neuen Bildabfragen, kein Retry, keine Änderung an gespeicherten Bildpfaden oder Storage. Der eigene Binder-Adapter erhält ausschließlich einen Span um die bereits ausgegebene Kartennummer. Slotmodell, Positionen, Seitennavigation, Drag-and-drop, Verschieben und Persistenzcode bleiben unverändert.

Mobile Listenlabels: TCG, Zustand / Grading, Menge, Kaufpreis, Referenzwert, Gewinn / Verlust. Die vorhandene responsive Struktur wird verwendet; auf Desktop bleiben ausschließlich die vorhandenen Spaltenüberschriften sichtbar.

## Lokale Tests

Engine: **Chromium 140.0.7339.186**, Playwright 1.55.1, Linux/headless. Viewports tatsächlich gesetzt und im Browser gemessen: **1363 × 844**, **390 × 844**, **430 × 844 CSS-Pixel**. Kein Browserzoom. Originale COLLECT-Seite einschließlich Binder-Adapter; isolierte lokale Auth-/Daten-/Bildfixtures. Die erfolgreiche Bildfixture ist ein lokales Ein-Pixel-Testbild, kein neues Produkt-/Kartenbild. Externe Anfragen blockiert, keine Staging-Daten verändert, keine Provideraufrufe.

| Prüfung | Ergebnis |
| --- | --- |
| Schriftgrößen, Feldgrenzen einschließlich Datum, vor/nach Fokus und normalem Fokuswechsel | PASS |
| Dialog vertikal scrollen, beide Aktionen erreichbar, Abbrechen verwirft lokalen Entwurf | PASS; null Schreibaufrufe |
| Statuswörter bleiben bei 390/430 px ungeteilt | PASS |
| Master, Graded und eigener Binder: ohne Bild, erfolgreiches Bild, Bild-404, langer Name | PASS |
| Eigener Binder: feste Slotpositionen und Seite 1 → 2 → 1 | PASS |
| Mobile Labels vorhanden, auf Desktop keine doppelten Labels | PASS |
| `tests/collect-mobile-ui-test.mjs` | PASS |
| `tests/collect-ux-test.mjs`, `tests/collect-ux-browser-test.mjs` | PASS |
| `tests/scanner-v16-binder-layout-test.mjs` | PASS |
| `tests/scanner-v16-collect-e2e.mjs` – vorhandene lokale Integration mit Mocks | PASS |
| `tests/scanner-v16-contract-test.mjs`, `tests/scanner-v16-acceptance-regression-test.mjs` | PASS |
| `tests/runtime-routing-contract-test.mjs`, Syntax und `git diff --check` | PASS |

Desktop-WebKit 26.0 wurde als zusätzliche Engine geprüft: Browserdownload erfolgreich, notwendige Linux-Systembibliotheken fehlen; deren Installation scheitert an Container-Berechtigungen. **BLOCKIERT**, kein WebKit-Testresultat. Chromium und Desktop-WebKit sind keine echte iPhone-Abnahme.

Messdateien und Screenshots liegen nach Testlauf unter `test-results/collect-mobile-*` (nicht versionierte Artefakte). Die neue Testdatei ist in den bestehenden Scanner-CI-Workflow eingebunden.

## Veröffentlichung und übrige Grenzen

Geänderte Produktdateien: `collect.html`, `scanner-v16-binder.js` (nur Markup). Zusätzlich gezielte Tests, bestehender CI-Workflow und dieses Dokument. Commit, beide CI-Ergebnisse und ein gegebenenfalls angemeldeter Preview-Sichtcheck werden nach Veröffentlichung im separaten Abschlussnachweis angegeben. Vor angemeldetem Preview-Test sind Deployment-Commit und Staging-Runtime erneut nachzuweisen.

Kein Test gegen Production. Keine Änderungen an Datenbank, Daten, Auth, Routing, Gates, Legal, TRADE, Zahlungen, Scannerfreigabe oder BATTLE. Bestehende synthetische Karten und leerer Testbinder bleiben unangetastet. Keine neuen Staging-Testdaten. Keine Gesamt-, Rechts- oder Produktionsfreigabe.
