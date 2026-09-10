# V16.12.1 – verifizierte Referenzbilder im Teststand

Dieser Block macht vorhandene Artwork-Referenzen unabhängig vom erneuten Bildabruf beim externen Anbieter. Er ergänzt einen kleinen, versionierten Transportcache auf `scanner-v16`. Der bestehende V16-Core und seine OCR-/Qualitätsentscheidungen bleiben unverändert. Die unabhängige ORB-Kandidatensuche ist weiterhin eine separate, noch nicht integrierte Probe.

## Neuer Browsernachweis vor der Änderung

Nach sicherer Vercel-Anmeldung wurde die geschützte direkte Route im Browser geöffnet. Drei Originalfotos wurden über den echten Mediathek-Datei-Input analysiert, ohne Mock-OCR, ohne Eingriff in `core.analyze()` und ohne Collection-Import:

| Foto | Automatisches Resultat auf 328e4da |
|---|---|
| Retourorden A | Retourorden, 074/084, DE; zweimal gelesen; 79 %, Referenzbild nicht prüfbar |
| Ganzui B | Ganzui, OP17-043, EN; einmal gelesen; 74 %, Nummer noch nicht bestätigt und Referenzbild nicht prüfbar |
| Event OP17-019 B | keine Nummer, kein Treffer; `tcg=one_piece`, gelesene Sprache EN |

Bei der Event-Karte führte die anschließend manuell eingegebene Nummer `OP17-019` ohne neues Foto zum richtigen Katalogkandidaten. Auch dort fehlte der Artwork-Beleg. Diese Recovery wird getrennt vom automatischen Erstversuch dokumentiert. Die verfügbaren Katalogeinträge beseitigen also nicht die fehlende OCR-Nummer. Fehlende Referenzbilder sind ein zweiter, eigenständiger Engpass.

Die früher blockierte Preview-Anmeldung ist damit gelöst. Die drei Browserläufe ersetzen nicht den vollständigen Vergleich aller sechzehn Fotos. Dies ist Chromium im Testbrowser, keine erneute iPhone-Abnahme.

## Umsetzung

- `scanner-v16-assets/references.json` enthält 14 bereits zugeordnete öffentliche Referenzen und deren Original-URL, TCG, Code, Sprache und SHA-256. Es handelt sich um die vorherige Methodenprobe plus die inzwischen erfolgreich geladene Ganzui-Referenz. Die Bildbytes bleiben unverändert. Keine privaten Nutzerfotos, keine aktuellen Preiswerte und keine Zugangsdaten.
- `scanner-v16-references.js` lädt die kleine Zuordnung einmal mit einem Zeitlimit. Erst **nach einer normalen Katalogsuche** ersetzt sie bekannte Bild-URLs durch die mitgelieferte Datei. TCG und vollständige Original-URL müssen übereinstimmen. Unbekannte Bilder nutzen weiterhin den bisherigen Anbieterpfad.
- Original und Reprint mit gleicher Kartennummer haben getrennte Bild-URLs und getrennte Dateien. Der Cache wählt keine Karte und verändert weder Nummer, Confidence noch `catalogVerified`.
- Core, Evidence-Gates, Importregeln, OCR, Live-Kamera und Benchmark-Speicher werden nicht geändert. Die UI erhält ausschließlich die neue Versionsanzeige. COLLECT/V15.8, Auth/RLS, `main` und das Original-Logo bleiben unverändert.

Der Cache ist **kein vollständiger Katalog und kein Offline-Scanner**. Die vier Pokémon-Karten des privaten Piloten haben weiterhin keine passende Bildreferenz in diesem Paket. Ein abgebrochener Netzwerkabruf wurde nicht als Erfolg verbucht: Drei neue Pokémon-Bildversuche liefen in Timeouts; Ganzui wurde tatsächlich gespeichert. Die versuchte Set-Abfrage `OP17` war zusätzlich falsch adressiert: Der gespeicherte Anbieter-Datensatz nennt `set_id: OP-17`. Das betrifft das vorbereitende Archivskript, nicht die bestehende Einzelkartenabfrage `sets/card/OP17-043/`.

## Prüfung

Alle zwölf Scanner-Testdateien einschließlich des neuen Referenztests sowie die strikte Pilotauswertung bestehen lokal (13 Testdateien). Geprüft werden Original-Hashes, getrennte Reprints, expliziter TCG, unbekannte URLs, unveränderte Confidence und die echte Katalogbrücke. Die drei vorhandenen Vertragstests mit festgeschriebener Loader-Version wurden auf 16.12.1 aktualisiert. Der neue Test ist im CI eingebunden.

Nach Deployment werden Referenzanzeige und Artwork-Auswertung mit denselben Originalfotos im geschützten Browser erneut geprüft. Ein dadurch korrekter manueller Treffer darf nicht als automatischer OCR-Erfolg gewertet werden. Der nachfolgende Erkennungsblock bleibt die unabhängige Bildkandidatensuche mit ausreichendem Referenzbestand; dafür ist noch kein größerer UI-/Binder-Umbau erforderlich.
