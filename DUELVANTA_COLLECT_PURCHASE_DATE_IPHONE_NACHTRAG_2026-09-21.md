# DUELVANTA – Kaufdatum-Fix-Kandidat und iPhone-Nachtrag

## Ausgangspunkt

Repository `Bennyescaped/duelvanta`, ausschließlich `marketplace-ux-v1`. Remote-Head vor Beginn unverändert **`14f9a16ae7f213fedf54d43e8dd3ff9e4c1c252e`**. V30 einschließlich Nachtrag vom 21.09.2026, M1–M3-Dokumentation und aktueller COLLECT-Code gelesen.

Die alte lokale Kopie enthält den inhaltsgleichen Commit `cba449b…` mit anderen Metadaten. Dieser Auftrag nutzt eine frische Kopie desselben Branches am Remote-Head. Kein Reset und kein Branchwechsel.

## iPhone-Nachtrag zu M1–M3

Laut Nutzer wurde die Preview `duelvantav5vision-pzac43918-bennyescaped-3783.vercel.app` auf echtem iPhone in Safari nachgetestet. Deployment-Commit des damaligen Stands: `14f9a16ae7f213fedf54d43e8dd3ff9e4c1c252e`.

**Nutzer-/Screenshot-Nachweise aus dem begleitenden Chat, im aktuellen Auftrag vom Nutzer übermittelt; keine selbst durchgeführten Hardwaretests und keine erneute eigenständige Auswertung der dortigen Screenshots:**

- PASS (Nutzernachweis): Kartenname fokussieren verursacht keinen automatischen Zoom mehr.
- PASS (Nutzernachweis): Nach Ausblenden der Tastatur sind Abbrechen und Speichern durch vertikales Scrollen erreichbar, ohne manuelles Verkleinern.
- PASS (Nutzernachweis): Preisstatus-Texte bei fehlenden Preisen sind lesbar.
- PASS (Nutzernachweis): Vier bildlose Karten zeigen in der Master-Collection-Binderansicht lesbare Namen; leere Plätze sind unterscheidbar.
- PASS (Nutzernachweis): Mobile Liste zeigt passende Feldbezeichnungen.

**Offener Restbefund:** Kaufdatum reicht trotz ausbleibendem Fokus-Zoom bis an rechten Dialogrand/Scrollleiste; Nachbarfelder halten Innenabstand ein.

Diese Teilnachweise sind keine vollständige mobile, rechtliche oder produktive Freigabe. F1/F2 bleiben getrennte frühere Befunde, M2/M3 werden nicht erneut umgebaut, F3/Binder-Löschung bleibt offen.

## Minimaler Fix-Kandidat

Geändert werden ausschließlich die Größenregeln von `#purchaseDate` und dessen direktem `.field`-Container in `collect.html`:

```css
#cardDialog .field:has(> #purchaseDate) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
#cardDialog #purchaseDate {
  display: block;
  box-sizing: border-box;
  width: 0;
  min-width: 100%;
  max-width: 100%;
}
```

Der schrumpfbare Track bezieht seine Breite vom vorhandenen äußeren Formularraster. Die bevorzugte Eingabebreite null verhindert, dass intrinsischer Inhalt die gewünschte Breite vorgibt; die minimale und maximale Border-Box-Breite entsprechen anschließend dem Feldcontainer. Die Regeln entfernen keine Datumsinhalte und verstecken Überbreite nicht durch `overflow:hidden`, Clipping oder negative Abstände.

`type=date`, nativer Picker, Wertformat, Validierung, gespeicherte Werte, Speicherlogik und die bestehende mobile 16-px-Schrift bleiben unverändert. Kein Zoom-Verbot, kein Fokusentzug, kein Zoom-Reset, keine Änderung am vertikalen Scrollmodell. Andere Dialogfelder und M2/M3 bleiben unverändert.

**Keine bestätigte Safari-Ursache:** Der berichtete Überlauf wurde in Chromium vor der Änderung nicht reproduziert. Dies ist eine gezielte Absicherung der Größenberechnung und bleibt bis zum erneuten Nutzer-iPhone-Test ausdrücklich ein **Fix-Kandidat**, keine behauptete erfolgreiche Safari-Behebung.

## Lokale Tests und Messungen

Playwright 1.55.1, Chromium **140.0.7339.186**, Linux/headless. Tatsächlich gesetzte und gemessene Viewports: **1363 × 844**, **390 × 844**, **430 × 844 CSS-Pixel**. Isolierte synthetische Daten; externe Netzwerkaufrufe blockiert, keine Staging-Schreibvorgänge oder Provideraufrufe.

`tests/collect-mobile-ui-test.mjs` wurde um getrennte Messungen für leeres Datum und `2026-09-21` ergänzt. Geprüft werden:

- äußerer rechter Feldrand gegenüber direktem Container, Formular-Inhaltsbereich und Nachbarfeld derselben Spalte;
- gleiche Feldbreiten, kein horizontaler Dialogüberlauf;
- erhaltener Datentyp `date`, unveränderter Eingabewert und gültiger Wertzustand;
- vor/nach Fokus, 16-px-Schrift mobil, erreichbare Aktionen nach vertikalem Scrollen;
- Abbrechen ohne Schreibaufruf und ohne Übernahme der lokalen Änderungen;
- bestehende M1–M3-Tests einschließlich Binder, Bildern und Listenbeschriftung.

| Chromium: leer und befüllt | Desktop 1363 | Smartphone 390 | Smartphone 430 |
| --- | --- | --- | --- |
| Kaufdatum-Breite = Nachbarfeld-Breite | 351 px | 306 px | 346 px |
| Rechter Feldrand = Container-/Nachbarfeldrand | PASS | PASS | PASS |
| Horizontaler Dialogüberlauf | keiner | keiner | keiner |
| Abbrechen / Speichern nach vertikalem Scrollen sichtbar | PASS | PASS | PASS |
| Abbrechen ohne Schreibaufruf | PASS | PASS | PASS |

Die äußeren Breiten stimmen bereits vor der Änderung in Chromium überein. Messungen vorher/nachher werden als Artefakte erhalten; sie sind ausdrücklich kein Nachweis des gemeldeten Safari-Fehlers oder seiner Behebung.

Alle ausgeführten lokalen Regressionen **PASS**: `collect-mobile-ui-test.mjs`, `collect-ux-test.mjs`, `collect-ux-browser-test.mjs`, `scanner-v16-binder-layout-test.mjs`, `scanner-v16-collect-e2e.mjs` (ausschließlich lokale Mocks) sowie `git diff --check`.

WebKit 26.0 erneut zu starten versucht: **BLOCKIERT**, fehlende Linux-Systembibliotheken, unter anderem GTK4/GStreamer. Die im vorherigen Block dokumentierte Installation scheiterte an Container-Berechtigungen. Kein WebKit-Ergebnis und keine Hardware-Abnahme. Chromium und Desktop-WebKit ersetzen kein echtes iPhone.

## Abschlussgrenzen und Nachtest

Commit, CI-Ergebnisse und neue Preview samt Deployment-Commit/Staging-Nachweis werden nach Veröffentlichung im separaten Abschlussbericht ergänzt. Kein Merge, kein manueller Deploy; ausschließlich bestehende Git-Automatik.

Erforderlicher Nutzer-Nachtest am neuen Deployment: Kaufdatum leer und befüllt prüfen, rechten Innenabstand mit Nachbarfeldern vergleichen; Dialog vertikal scrollen und Abbrechen verwenden. Nativen Datumswähler und weiterhin ausbleibenden Fokus-Zoom prüfen. Keine vorhandenen Testkarten speichern oder ändern.

Keine Änderungen an Production/main, Daten, Schema, Berechtigungen, Auth, Routing, Gates, Legal, TRADE, BATTLE, Scannerfreigabe oder Zahlungen. Testkarten und leerer Testbinder bleiben unangetastet. Keine vollständige mobile, rechtliche oder produktive Freigabe. Nach Bereitstellung der Preview STOP.
