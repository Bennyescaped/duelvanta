# V16.12 – Folgescan und schwierige Karten

Nur `scanner-v16`, PR #1 bleibt Draft. Main, V15.8, collect.html, Logo und Auth/RLS bleiben unberührt. Kein Vision-/KI-Dienst aktiviert, keine echten Sammlungsdaten für Tests geschrieben.

## Importabschluss

Nach dem Speichern bleibt der Scanner offen. Die Bestätigung zeigt **NÄCHSTE KARTE SCANNEN** als Hauptaktion und **SAMMLUNG ÖFFNEN** als zweite Option. Das vorhandene X beendet den Scanner. Keine automatische Weiterleitung, kein zusätzlicher Dialog. Folgescan startet die Kamera direkt und behält TCG/Binder. Bei fehlender Kameraberechtigung bleiben Foto und Mediathek bedienbar. Ein laufender Import sperrt weitere Aufnahme/Importaktionen. Noch offene Batch-Ergebnisse werden nach einem Teilimport weiterhin angezeigt.

Der Browsertest verwendet ausschließlich eine isolierte In-Memory-Sammlung: eine Karte speichern, Bestätigung sehen, nächste Aufnahme starten, keine zweite Speicherung. Der reale Retourorden-Import auf dem iPhone wurde bereits vom Nutzer bestätigt.

## Gefundene Ursachen

- Pokémon-Parser akzeptierte nur `Zähler <= Nenner`. Dadurch wurden echte Secret Rares wie 223/197 und 215/203 verworfen. Zähler und Nenner werden jetzt einzeln auf gültige Zahlen geprüft; der Katalog muss weiterhin beide bestätigen.
- Bereits eng zugeschnittene Karten verloren durch einen erneuten 2,5%-Randbeschnitt Teile des kleinen Fußzeilencodes. Bilder im Karten-Seitenverhältnis behalten ihren Rand. Fotos mit Hintergrund verwenden weiterhin die bestehende Konturerkennung.
- Breite Text-OCR-Ausschnitte unterdrücken kleine helle/goldene Codes auf Full-Art-Hintergründen. Bei fehlendem oder widersprüchlichem Konsens kommen höchstens zwei zusätzliche Zeilen-Ausschnitte mit unterschiedlicher Geometrie/Kontrast hinzu. Der bestehende sichere Retourorden-Pfad bleibt bei drei Durchläufen. Kein OCR in der Live-Vorstufe.
- One-Piece-Promos fehlten im Katalogweg. P-Codes verwenden nun den offiziellen `/api/promos/card/{code}/`-Endpunkt. Varianten mehrerer Katalogwege werden zusammengeführt und anhand ihrer tatsächlichen Druck-ID unterschieden. OP/ST/EB/PRB bleiben erhalten. `S` wird ausschließlich innerhalb des numerischen OP-Codes als OCR-Verwechslung für `5` normalisiert.

## Aussagekraft der Tests

`tests/scanner-v16-real-card-matrix.mjs` lädt echte öffentliche Referenzbilder und unveränderte Katalogantworten von TCGdex und OPTCG API. Der Browser durchläuft Datei-Input, Bildvorbereitung, echtes Tesseract, produktiven Katalogadapter, Artwork-Vergleich, Evidence-Gates, Ergebnis und Benchmark. Die Testzustellung korrigiert ausschließlich Transport/CORS; OCR und Kandidaten werden nicht vorgegeben. Damit werden Referenzbild-Erkennung und Katalogzuordnung geprüft, **keine physische Folien-/Hüllen-/iPhone-Trefferquote**.

Die Matrix prüft Glurak-ex 223/197 DE, Umbreon VMAX 215/203 EN, OP05-119 Standard/Parallel/Manga und die separate P-001-Winner-Druckvariante. Ein korrekter One-Piece-Code allein genügt nicht: `catalogId` und Artwork müssen zur erwarteten Druckvariante passen. Richtiger Kandidat mit Prüfstatus wird gesondert ausgewiesen. Ein falscher Kandidat oder No-Hit zählt nicht als automatische Erkennung.

Bekannte harte Probe: Der weiße Umrissdruck von Umbreon kann `215/203` als `15/203` oder ohne Schrägstrich liefern. Die Matrix prüft hier ausdrücklich die Sperre gegen automatische Bestätigung und anschließende manuelle Nummernkorrektur mit richtiger Artwork-Auswahl ohne neues Foto. Ein bestandener Recovery-Test wird nicht als bestandene automatische Erkennung gezählt.

Konservativ bleiben sehr ähnliche Reprints, fehlende Referenzbilder und unbestätigte Nummern prüfpflichtig. Ohne stark passenden Referenzvergleich können große weiße Druckflächen weiterhin den Reflexionsschutz auslösen. Eine breite Zusage für schwierige echte Karten oder einen fertigen Scanner lässt sich daraus noch nicht ableiten. Ergebnisse und Screenshots jeder Matrix liegen im CI-Artefakt `v16-mobile-recognition/real-cards`.

## Weitere Erkenntnis aus dem ersten Matrixlauf

Die echte P-001-Winner-Karte wurde zunächst als Finalist vorgeschlagen: Beim Artwork-Hash wurden die Aufnahme (bereits auf 820 Pixel skaliert) und die native Referenz mit unterschiedlichen Resampling-Schritten verkleinert. Selbst identische Bilddateien lagen nur bei 80–91 Punkten; kleine Druckunterschiede gingen dabei unter. Referenzen erhalten jetzt dieselbe Zwischenauflösung wie die Aufnahme. Der Test verlangt nahezu vollständige Übereinstimmung bei identischen Pixelquellen und weiterhin die richtige Druck-ID.

Zusätzlich werden helle Druckflächen nur dann vom Reflexionswert ausgenommen, wenn ein stark passendes Referenzbild die weißen Stellen auch räumlich erklärt. Neue weiße Flächen behalten den Reflexionsschutz. Ein extra Browserfall mit großem weißem Hindernis prüft die Importsperre. Diese Prüfung ersetzt keine physische Foil-Erkennung; eine sehr ähnliche Druckvariante bleibt weiter prüfpflichtig.

Artwork-Werte behalten intern zwei Nachkommastellen. Frühes Runden hatte auch nach gemeinsamer Skalierung zwei verschiedene Winner-Drucke zu „100“ zusammengefasst. Der passende Druck darf mit 100 vor einem sehr ähnlichen Druck mit 99,63 stehen; der winzige Abstand reicht **weiterhin nicht** für automatische Variantenbestätigung.

Ein Live-Kataloglauf scheiterte zudem trotz gelesener Nummer an der Abfrage. Transport-/Serverfehler erhalten jetzt genau einen weiteren Versuch; 404 wird nicht wiederholt. Bleibt die Abfrage erfolglos, zeigt V16 `catalog_unavailable` mit erneutem Katalogaufruf ohne neues Foto statt einen vermeintlichen OCR-Fehler. Die kontrollierte Kartenmatrix läuft unabhängig von einem Fehler des separaten Live-Katalogtests weiter, ohne dessen Fehlschlag zu überspringen oder als Erfolg zu zählen.
