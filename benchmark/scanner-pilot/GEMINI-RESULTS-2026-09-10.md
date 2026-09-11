# Gemini Flash-Lite: echter 16-Foto-Erstlauf

**Nachtrag:** Ximilar wurde inzwischen mit denselben 16 Fotos getestet. Der [abgeschlossene Vergleich](XIMILAR-GEMINI-COMPARISON-2026-09-10.md) ersetzt den unten beschriebenen damaligen nächsten Schritt. Die Gemini-Messdaten bleiben unverändert.

Durchgeführt am 10.09.2026 im Browser über die V16-Preview, Code `5a5269962ec6e635c46d9e7df18c4c6c148c3e4f`. Modell `gemini-3.5-flash-lite`, Prompt `tcg-photo-v1`, vor dem Lauf eingefroren. Die sechzehn unveränderten Originalfotos und freigegebenen TCGs wurden übertragen; Sollnummern, Namen, Sprache, Katalogkandidaten und Varianten nicht. Keine Wiederholungen oder Auswahl des besten Versuchs. Ximilar wurde noch nicht getestet.

## Ergebnis

**16/16 richtige gedruckte Nummern und 16/16 richtige Sprachen.** Das ist ein erfolgreicher Nachweis der Nummern-/Sprachauslese an diesen acht Karten aus zwei Winkeln. Es ist keine 100-%-Quote für vollständige Kartenerkennung, exakte Drucke, beliebige Karten oder gegradete Karten.

| Karte | Nummer | Sprache | Beide Fotos | Einschränkung |
|---|---|---|---|---|
| Retourorden | 074/084 | DE | richtig | Set/Finish offen; eine unbelegte Echtheitsbehauptung |
| Rameidon ex | 045/084 | DE | richtig | Double Rare gelesen; nur allgemeines Holo-Finish |
| Moruda | 091/084 | DE | richtig | Illustration Rare gelesen; eine unbelegte Echtheitsbehauptung |
| Memmeon / メッソン | 021/063 | JP | richtig | `ja` wird erst bei der Auswertung zu JP normalisiert |
| Ganzui | OP17-043 | EN | richtig | Set/Variante offen |
| Event | OP17-019 | EN | richtig | Falsches Set und widersprüchliche Variantenbehauptungen |
| Sabo | OP04-083 | EN | richtig | „Alternate Art“ genannt; genauer Druck/Reprint weiterhin ungeprüft |
| Nico Robin | ST29-009 | EN | richtig | Parallel-Version in beiden Antworten nicht identifiziert |

Der Event-Fall ist entscheidend: Die gespeicherten unabhängigen Katalogdaten ordnen OP17-019 „The World's Strongest Warriors“ zu. Gemini nennt in beiden Antworten „The Four Emperors“. Bei demselben physischen Exemplar wechselt die Variantenausgabe von „parallel“ zu „manga alternate art“, jeweils mit 95–98 % eigener Sicherheit und `needs_review:false`. Mindestens diese konkrete Variantenunterscheidung ist nicht belastbar. Die genaue Finish-/Printing-Ground-Truth aller Fotos bleibt teilweise offen; es wird daher keine erfundene Varianten-Trefferquote berechnet.

Bei Retourorden A und Moruda B wertet Gemini die gedruckte Jahreszahl 2026 als Hinweis auf eine Fälschung/eine selbstgemachte Karte. Das ist eine unbelegte Modellbehauptung, kein Echtheitsbefund. Sie wird nicht in Collection-Daten übernommen. Die reine Nummern-/Sprachmetrik erfasst diese zusätzlichen Inhaltsfehler ausdrücklich nicht.

Alle Antworten wurden deshalb serverseitig als Vorschläge mit `catalogVerified:false` und `importable:false` behandelt. Es gab keinen automatischen Import und keinen Aufruf eines Vision-Fallbacks im normalen Scanner.

## Zeit und Verbrauch

- 16 abgeschlossene Provideranfragen, kein Fehler, keine Wiederholung, kein Cachetreffer.
- Median der serverseitigen Provider-Anfragezeit: **13,704 Sekunden**; Minimum 2,119, Maximum 44,968 Sekunden. Upload und die absichtlichen 15 Sekunden Abstand zwischen Fotos sind darin nicht enthalten. Diese Streuung reicht noch nicht als Nachweis einer schnellen Live-Scanner-Erfahrung.
- Gemessene API-Nutzung: **20.224 Eingabetokens**, **1.670 Ausgabetokens**, **21.894 Gesamttokens**. Das separate Thinking-Feld wurde nicht geliefert; die ausgewiesenen Gesamttokens entsprechen Eingabe plus Ausgabe. Es wurden keine Such-/Grounding-Werkzeuge verwendet.
- Bei den offiziellen Standard-Listenpreisen von $0,30 pro Million Eingabe- und $2,50 pro Million Ausgabetokens entspricht dies **$0,0102422 für alle 16 Fotos**, also ungefähr **1,02 US-Cent insgesamt** bzw. **0,064 US-Cent pro Foto**. Das ist eine Listenpreisrechnung, keine ausgelesene Abrechnung. Verfügbares Free-Tier-Kontingent kann die API-Gebühr auf null reduzieren; Hosting/Steuern sind nicht enthalten. [Google-Preise](https://ai.google.dev/gemini-api/docs/pricing)

## Technischer Nachweis

- Vercel war für den getesteten Commit erfolgreich; die Browserseite meldete serverseitig einen konfigurierten Schlüssel, und alle sechzehn echten Providerantworten wurden sichtbar angezeigt.
- GitHub PR-CI Run 98 (`34501229980`) war erfolgreich, einschließlich vorhandener Mobile-Upload-E2E und neuer Tests für den privaten Gemini-Piloten. Der API-Erstlauf ist separat von diesen Tests dokumentiert.
- Ungültige Testdatei: Start gesperrt, kein Provideraufruf. Zweiter Klick nach Abschluss: unveränderte sechzehn Beobachtungen, keine erneute Ausführung der Fotos.
- Die private Pilotdatei enthält Rohantworten, Tokenwerte, Bild-Hashes, Modellversion, Fehler-/Statusfelder und Auswertung. Originalfotos, Testfreigaben und der Google-Schlüssel wurden nicht in Git veröffentlicht.
- Der temporäre Pilot wird nach diesem Lauf in der öffentlichen Konfiguration wieder geschlossen (`enabled:false`). Der Google-Schlüssel bleibt serverseitig für spätere autorisierte Arbeiten erhalten. Das normale V16-Vision-Modul bleibt ebenfalls deaktiviert.

## Entscheidung für den nächsten Schritt

Gemini Flash-Lite ist mit diesen Ergebnissen ein plausibler günstiger Ersatz/Partner für die schwierige OCR-Auslese. Es ist hier **keine ausreichend verlässliche alleinige Quelle für Set, Parallel/Manga, Reprint oder Echtheit**. Vor einem normalen Import müssen Identität und Sprache mit dem Katalog und der konkrete Druck mit belastbarer Bildevidenz abgeglichen werden.

Als nächstes bekommt Ximilar nach Freischaltung genau dieselben Originalfotos. Verglichen werden auch offene/falsche Varianten, notwendige Eingriffe und gemessene Antwortzeiten. Erst dann wird ein Anbieter ausgewählt. Dieser Test des günstigen Flash-Lite ist kein abschließendes Urteil über leistungsstärkere Gemini-Modelle. Kein weiterer UI-/Binder-Neubau und keine neue OCR-Tuning-Schleife aus diesem Ergebnis.
