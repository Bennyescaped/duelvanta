# Transparente synthetische R22-R3-E2E-Daten

`tests/tcg-i3-m6-r22-r3-browser-test.mjs` erzeugt PNG-Bilder im Browser:
eine Karte sowie 2×2-, 3×2-, 3×3- und Neuner-Binderlayouts. Jede Kartenfläche
hat eine getrennte Farbkennung. Die echte V16-Medienübernahme, Dekodierung,
Regionsgeometrie, Footer-Zuschneidung, Oberfläche und Zustandslogik laufen.
Ein ausdrücklich synthetischer Tesseract-Ersatz liest die Farbkennung aus dem
tatsächlichen Footer-Canvas und liefert die zugehörige, getrennte Textbeobachtung.
Leere, unlesbare sowie anders angeordnete Kennungen bleiben ihrer Position zugeordnet.

Die Texte verwenden DSK / 0344 / EN und ECL / 0373 / EN einschließlich R22-R2-Rauschen.
Alle Providerantworten und Datenbankschreibvorgänge im Browsertest sind isolierte
Mocks. Es werden keine echten Scryfall-/OpenAI-Anfragen oder Nutzeruploads ausgeführt.
Der SQL-Kandidat wird zusätzlich isoliert mit echten PostgreSQL-Rollen geprüft.

Die erzeugten PNGs, UI-Screenshots und Ergebnisprotokolle liegen unter
`test-results/tcg-i3-m6-r22-r3/` und werden als CI-Evidence archiviert.
Das sind keine Fotos echter Karten, keine physische Binderabnahme und kein
USER-VERIFIED-Nachweis. Bestehende R22-R1/R2-Parser- und Kamera-Regressionen bleiben separat.
