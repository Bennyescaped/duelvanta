# DUELVANTA – begrenzter Scanner-Entscheidungspilot

Stand: 10.09.2026. Ausgangscode: `666e2ac6efb19a40d3e91538d51fb6ccd833e98f` (V16.12). Dieser Ordner bereitet die Technologieentscheidung vor. Er wird von keiner Scanner-Route geladen, enthält keine neuen Nutzerdaten und aktiviert keinen Dienst.

Aktueller Zwischenstand: [16 Originalfotos, native Baseline und eine begrenzte Bildvergleichsprobe](RESULTS-2026-09-10.md). Die Fotos sind vollständig vorhanden; Browsernachweis und Referenzabdeckung bleiben offen. Keine Scanneränderung aus der verworfenen Crop-Probe übernommen.

## Ziel und Reihenfolge

Zuerst die Erkennungsstrategie entscheiden, dann den normalen Scannerablauf gestalten, danach die Binder erweitern. COLLECT, V15.8, bestehende Sammlungen, Auth/RLS und Original-Logo bleiben erhalten. Die neue Methode wird separat erprobt, bevor sie in V16 eingebaut wird.

| Block | Konkrete Arbeit | Abschluss / Entscheidung |
|---|---|---|
| 0 – Vorbereitung | vorhandene Nachweise übernehmen; Fotovorlage, Auswertung und Grenzen festlegen | Dieser Ordner, lokal geprüfte Auswertung |
| 1 – Eingänge | Originalfotos einmal zuordnen, Hashes speichern, gedruckte Nummer/Sprache und exakten Katalogdruck kontrollieren | eingefrorene Testliste; unbekannte Angaben bleiben unbekannt |
| 2 – Baseline | V15.8 und V16 auf identischen Fotos messen; Rohresultate vor jeder Korrektur speichern | Fehlerliste mit Zeiten, Varianten und nötigen Eingriffen |
| 3 – Ein neuer Ansatz | visuelle Kandidatensuche unabhängig vom OCR-Code separat erproben | genau ein Vergleich mit Baseline; keine zusätzliche Cloud-KI parallel |
| 4 – Entscheidung | nur nach festgelegtem Entwicklungsstand reservierte Karten prüfen | übernehmen, ablehnen oder gezielt mehr Daten verlangen |
| 5 – Oberfläche | gewöhnliche Scanneransicht vereinfachen: TCG/Binder einmal wählen, speichern/weiter, Details bei Bedarf | ein zusammenhängender Browserablauf, danach ein kurzer iPhone-Test |
| 6 – Binder | Kartenansicht, feste Plätze, Umordnen, freie Slots, Fortschritt auf vorhandenen Daten | eigener abgeschlossener Entwicklungsblock |

Der erste Pilot ist klein. Er liefert keine belastbare allgemeine Trefferquote und keinen Beweis, SleeveNode insgesamt zu übertreffen. Mehr Karten werden erst angefordert, wenn eine konkrete offene Entscheidung davon abhängt.

## Einmalige Fotoanleitung für Benjamin

Acht vorhandene Karten, jeweils zwei Aufnahmen, insgesamt sechzehn Originalfotos. Die vorhandene Retourorden-Karte eignet sich als bekannter Standardfall. Bei fehlenden Kategorien die ähnlichste vorhandene Karte nehmen; eine Manga-Karte ist keine Voraussetzung.

| Reihenfolge | Karte |
|---|---|
| 1 / P01 | Pokémon Standard, bevorzugt Retourorden |
| 2 / P02 | Pokémon Full-Art, ex oder VMAX |
| 3 / P03 | Pokémon Secret Rare oder weitere schwierige Full-Art |
| 4 / P04 | Pokémon in anderer Sprache oder Holo/Reverse |
| 5 / O01 | One Piece Standard, bevorzugt die bisher erfolglose Karte |
| 6 / O02 | One Piece Parallel/Alt-Art |
| 7 / O03 | One Piece Manga, weitere Alt-Art oder Reprint |
| 8 / O04 | One Piece Promo P- oder Karte mit ST/EB/PRB-Code |

**Serie A:** alle acht Karten nacheinander mit der normalen iPhone-Kamera fotografieren. 1×, ganze Karte inklusive vier Ecken und kleinem Rand, möglichst gerade, Tageslicht ohne Blitz. Die Kamera darf den sichtbaren Code nicht durch den Bildrand abschneiden.

**Serie B:** dieselben acht Karten in derselben Reihenfolge unter typischen Alltagsbedingungen: leicht schräg oder in einer vorhandenen Hülle, soweit ohne Umstecken möglich. Keine absichtlich vollständig verdeckten Codes. Das ist eine Robustheitsprobe und noch kein standardisierter Foil-Test.

Die Originalfotos hier als „Serie A“ und „Serie B“ senden. Keine Screenshots aus Scanner-Ergebnissen. Umbenennen ist nicht erforderlich. Dazu eine Liste der acht Karten, zum Beispiel:

`1 | Retourorden | 074/084 | DE | normal`

Name, gedruckte Nummer, Sprache und Variante genügen. Ist die Variante unklar, „unklar“ schreiben. Ich ordne Dateien und Katalogdruck zu; nur tatsächlich unlesbare oder widersprüchliche Angaben müssen danach geklärt werden. Kein Import in die echte Sammlung für diesen Test.

## Trennung der Testdaten

`cases.template.json` enthält acht physische Karten und sechzehn Foto-IDs. P01/P02/O01/O02 dienen der Entwicklung. P03/P04/O03/O04 bleiben reserviert. Beide Bilder derselben physischen Karte bleiben immer in derselben Gruppe. Vor dem abschließenden Lauf werden Methode, Parameter und Referenzbestand festgehalten. Anschließendes Nachjustieren an den reservierten Fehlern wäre ein neuer Entwicklungsdurchgang, keine unabhängige Bestätigung.

Vor einem Lauf: echte Dateinamen und SHA-256 ergänzen; `expected` prüfen und erst dann `confirmed: true` setzen. `printingKey` bezeichnet den exakten Katalogdruck; Sprache und Finish/Variante werden zusätzlich geprüft. Ein bloßes „Parallel“ reicht bei mehreren Reprints nicht. Referenzbilder gehören in einen überprüften, vor dem Lauf eingefrorenen Bestand mit plausiblen Verwechslungskandidaten. Eine Suche ausschließlich unter den acht Sollkarten wäre kein ausreichender Nachweis.

Fehlende Referenzen oder ein ausgefallener Provider werden separat ausgewiesen. Sie dürfen keinen Erfolg erzeugen. Wiederholte Abrufe eines bekannten ausgefallenen Providers werden beendet; Bildtests können mit bereits rechtmäßig gespeicherten, verifizierten Referenzdaten getrennt weiterlaufen, wobei der Live-Test blockiert bleibt.

## Eine Methode prüfen

Der heutige V16-Pfad benötigt meist eine brauchbare Nummer, um überhaupt Kandidaten zu finden. Die zusätzliche Probe soll Kandidaten aus Bildmerkmalen suchen können, auch wenn OCR fehlt oder widerspricht. OCR, Sprache und Variantenmerkmale bleiben zusätzliche Belege. Die Probe bekommt dieselben vorbereiteten Fotos wie V16 und darf nicht die Sollnummer als Suchhilfe erhalten. Keine vollständige OCR auf Videoframes, kein Auto-Import durch eine Bildähnlichkeit allein.

Der konkrete lokale Ansatz wird anhand der Entwicklungsbilder gewählt. Keine mehreren Modelle oder Dienste gleichzeitig, keine kostenpflichtige API, keine Aktivierung des vorbereiteten Vision-Fallbacks. Sollte erst ein externer Dienst einen begründeten Versuch ermöglichen, werden zuerst konkrete Kosten, Datenübertragung und ein gedeckelter Testumfang vorgelegt.

## Messung und Abbruch

- Erster Versuch, manuelle Korrektur und Wiederholung bleiben getrennt. Nie den besten von mehreren Versuchen als Ersttreffer verwenden.
- Richtige Karte, richtige Sprache und exakter Druck/Finish werden getrennt geprüft. Fehlende Angaben sind nicht automatisch richtig.
- Falscher sicherer Treffer oder automatische Freigabe ohne ausreichende Belege: Integration stoppen.
- Die neue Methode muss auf denselben Fällen Fehler oder Nacharbeit reduzieren, ohne zusätzliche falsche Freigaben. Medianzeit, fehlende Zeitmessungen und Eingriffe offen ausweisen. Bei Gleichstand oder unklarem Gewinn keinen Umbau rechtfertigen.
- Reservierte Bilder nur nach festgelegter Methode prüfen. Ein Fehlschlag wird berichtet und löst keinen endlosen Anpassungszyklus aus.
- Foto-Upload und Liveaufnahme nicht in einen Zeitwert mischen. Für Live separat Zeit bis Capture, Fehl-/Doppelaufnahme und Eingriffe erfassen.
- SleeveNode später einmal an denselben vier Pokémon-Karten unter vergleichbaren Bedingungen vergleichen; One Piece nicht mit nicht belegter Konkurrenz-Unterstützung verrechnen. Keine Aussagen über dessen interne Technik aus der Oberfläche ableiten.
- Der kostenlose Pilot hat ein Ende: Baseline, eine Probe, eine Vergleichsauswertung. Ein größerer Umbau braucht einen belegten Vorteil.

## Automatische Offline-Auswertung

Keine Installation, kein Netzwerk, keine Änderungen an lokalen Benchmark-Sessions:

```sh
node benchmark/scanner-pilot/score.test.mjs
node benchmark/scanner-pilot/score.mjs manifest.json observations.json report.json
```

`observations.json` ist eine Liste mit jeweils:

```json
{
  "caseId": "P01-A",
  "engine": "V16",
  "version": "tatsaechlicher-commit",
  "inputMode": "photo",
  "environment": "geraet-browser-verbindung",
  "phase": "initial",
  "actual": {
    "catalogMatched": true,
    "tcg": "pokemon",
    "number": "074/084",
    "language": "DE",
    "variant": "standard",
    "printingKey": "verifizierter-katalogdruck",
    "ready": false,
    "elapsedMs": null,
    "additionalActions": null,
    "errorType": null
  }
}
```

Dies ist nur das Format, kein Testergebnis. Rohresultate bleiben separat erhalten. Der Adapter muss die tatsächlich beobachteten Felder übernehmen. Alte Benchmark-Exporte ohne exakten Drucknachweis werden als unvollständig behandelt; daraus darf keine nachträgliche Variantenbestätigung entstehen. Der Bericht gruppiert nach Engine, Version, Gerät/Browser/Verbindung, Eingangsart, TCG und Entwicklungs-/Prüfgruppe. Eine noch nicht ausgeführte Prüfgruppe bleibt als fehlend sichtbar.

## Arbeitslimit schonen

Vorhandene Analysen wiederverwenden. Eine gebündelte Fotoserie, automatisierte Wiederverwendung derselben Dateien, ein Commit pro abgeschlossenem Block. Lokal gezielt prüfen; umfassende CI-/Browserläufe erst nach einem fertigen Funktionsblock oder zur Klärung eines konkreten Fehlers. Kein wiederholtes Redesign, keine Modellserie, kein Katalog-Polling, keine parallele Binder-Implementierung vor der Erkennungsentscheidung. Das tatsächliche ChatGPT-Kontolimit ist hier nicht verlässlich in Prozent budgetierbar.

Vorhandene Belege: [V16.12-Protokoll](../../SCANNER_V16_12_COMPLEX_CARDS.md). Der dort dokumentierte Providerfehler ist der letzte verifizierte Zustand, keine Behauptung über die aktuelle Verfügbarkeit.
