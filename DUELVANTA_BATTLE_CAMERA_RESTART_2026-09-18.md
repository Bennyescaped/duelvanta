# BATTLE: Kamera-Neustart – Delta zu Masterhandout V26

Basis: `3d2c4dd861b3bf07507f2e9e9f8569a2b5898d24`, Branch `marketplace-ux-v1`.
Alle Grenzen aus V26 bleiben verbindlich. Keine Freigabe für main, Produktion oder TRADE.

## Reproduzierter Befund

1. Host und Gast aktivieren Kamera und Mikrofon.
2. Gast stoppt die Kamera; der vorhandene Hangup-Pfad schließt beide Peers.
3. Der bestehende Host-Sync bietet erneut an, während die Gastkamera aus ist.
4. Der Gast beantwortet das Angebot mit einem nur empfangenden Peer.
5. Bei erneuter Kameraaktivierung blieb dieser Peer bestehen. Der neue lokale Stream wurde nicht als Sender angehängt: lokal sichtbare Kamera, aber keine ausgehenden Audio-/Video-Tracks.

Der isolierte Regressionstest schlägt am unveränderten V26-Modul genau bei Schritt 5 fehl (erwartet audio/video, tatsächlich keine Sender).

## Minimale Änderung

Nur `startMedia` in `battle-webrtc.js`: Nach erfolgreichem getUserMedia wird ein bereits vorhandener Peer über den bestehenden `shutdownPeer(true)`-Pfad geschlossen. Das bestehende Host-Angebot/Antwort-Verfahren baut danach einen Peer mit den neuen Tracks auf. Keine neuen Signaltypen, RPCs, Rollen oder Berechtigungen.

Unverändert: `battle.js`, `site-nav.js` und dessen parser-blockierender Preview-Guard, Safety, Moderation, Profilverknüpfungen, Historie, Ranked/Ergebnisbestätigung, Datenbankschema und Markenassets.

## Regression und Prüfgrenzen

- `node tests/battle-webrtc-restart-test.mjs`: isolierte Ausführung des echten Moduls mit DOM-/Medien-/RTC-/Signalisierungs-Testdoubles. Vorher rot, nachher grün; initiale Verbindung, wiederholter Gast-Neustart, Host-Neustart, Kamera-Stop/Bereitschaftssperre und Mikrofon geprüft.
- `node tests/battle-webrtc-browser-test.mjs`: echte Chromium-RTCPeerConnections und synthetische Kamera-/Audiogeräte; Signalisierung ausschließlich im Speicher. Prüft empfangene Audio-Bytes, dekodierte Videoframes und genau einen aktiven Peer pro Seite.
- Neuer Workflow `Battle WebRTC Check` ergänzt die bestehende vollständige CI, ersetzt sie nicht. Verwendet vorhandene gepinnte CI-Abhängigkeiten.
- Lokaler Browserstart ist in dieser Chat-Ausführungsumgebung durch Administratorrichtlinien blockiert. Ein lokaler echter Browser-Pass wird nicht behauptet; dafür ist der GitHub-Actions-Lauf maßgeblich.
- Reale iPhone/Safari-Zwei-Geräte-Abnahme und reale Netz-/NAT-Bedingungen bleiben gesondert zu bestätigen. Die isolierten Tests sind keine vollständige BATTLE-Produktabnahme.
- Keine Supabase- oder Zahlungszugriffe und keine Medienaufzeichnungen in den neuen Tests.

CI- und Preview-Ergebnisse sind am zugehörigen Commit zu prüfen; diese initiale Befundnotiz behauptet noch keinen erfolgreichen Remote-Lauf.
