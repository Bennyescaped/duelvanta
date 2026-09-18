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

Unverändert: `battle.js`, `battle.html`, `site-nav.js` und dessen parser-blockierender Preview-Guard, Safety, Moderation, Profilverknüpfungen, Historie, Ranked/Ergebnisbestätigung, Datenbankschema und Markenassets. Die historische Production-Konstante in battle.js bleibt durch den unveränderten site-nav-Guard auf Preview nach Staging umgebogen.

## Regression und Prüfgrenzen

- `node tests/battle-webrtc-restart-test.mjs`: isolierte Ausführung des echten Moduls mit DOM-/Medien-/RTC-/Signalisierungs-Testdoubles. Vorher rot, nachher grün; initiale Verbindung, wiederholter Gast-Neustart, Host-Neustart, Kamera-Stop/Bereitschaftssperre und Mikrofon geprüft.
- `node tests/battle-webrtc-browser-test.mjs`: echte Chromium-RTCPeerConnections und synthetische Kamera-/Audiogeräte; Signalisierung ausschließlich im Speicher. Prüft empfangene Audio-Bytes, dekodierte Videoframes, sichtbare Videodimensionen und genau einen aktiven Peer pro Seite.
- Neuer Workflow `Battle WebRTC Check` ergänzt die bestehende vollständige CI, ersetzt sie nicht. Verwendet vorhandene gepinnte CI-Abhängigkeiten.
- Lokaler Browserstart ist in dieser Chat-Ausführungsumgebung durch Administratorrichtlinien blockiert. Ein lokaler echter Browser-Pass wird nicht behauptet; dafür ist der GitHub-Actions-Lauf maßgeblich.
- Reale iPhone/Safari-Zwei-Geräte-Abnahme und reale Netz-/NAT-Bedingungen bleiben gesondert zu bestätigen. Die isolierten Tests sind keine vollständige BATTLE-Produktabnahme.
- Keine Supabase- oder Zahlungszugriffe und keine Medienaufzeichnungen in den neuen Tests.

## Verifizierter technischer Checkpoint

Stand der Prüfung: 18.09.2026. Technischer Checkpoint: `ca102da9ed990dd481c96aac81e8f71be8d3ad20`.

- Produktfix: `9e589e17702e09e75f44b7b830e90c4faceb5a8e`.
- Testkorrektur: `ca102da9ed990dd481c96aac81e8f71be8d3ad20`; nur der neue Browser-Test wurde geändert. Der erste Browser-Lauf #1 scheiterte an einer verfrühten Test-Warteprüfung. Die korrigierte Variante wartet in Node auf tatsächlich aufgelöste RTP-Statistiken und prüft die Medienkriterien ausdrücklich.
- Bestehende vollständige PR-CI **Scanner V16 Check #526**, Run `35319511191`: `validate` SUCCESS (Job `105518637776`), `quota_database` SUCCESS (Job `105518638012`). Auth-/Boundary-, Runtime-Isolations-, TRADE-, COLLECT- und Browser-Regressionen wurden ausgeführt. Die beiden ausschließlich für Push konfigurierten Live-Katalog-Schritte sind im PR-Lauf bestimmungsgemäß ausgelassen; keine zusätzlichen externen Live-Tests werden behauptet.
- **Battle WebRTC Check #2**, Run `35319511148`, Job `105518637821`: SUCCESS. Logs bestätigen empfangene Audio-/Videodaten für beide Seiten initial, nach zwei Gast-Neustarts und nach Host-Neustart; Kamera-Stop, Bereitschaftssperre und Mikrofon erfolgreich.
- Browser-Evidenz: Artifact `10537000058`, `battle-webrtc-evidence`, ausschließlich Statistiken. Kein Video-/Audio-Mitschnitt.
- Browser-CI-Checkout: synthetischer PR-Merge `78bf08f667764eaa89155ad71a4a89ccf13a2e6c` aus technischem Checkpoint und unverändertem main. Kein tatsächlicher Merge.
- PR #5 bei Nachprüfung: open, Draft, unmerged, mergeable; main weiterhin `50f88213571be13255bb52eb489cc28cca660001`.

Dieser Dokumentationsnachtrag folgt auf den geprüften technischen Checkpoint. Er ändert weder Anwendungs- noch Testcode. Einen späteren Dokumentations-Head und dessen eigene CI nicht mit dem oben vollständig geprüften technischen Checkpoint verwechseln.

## Preview-Auslieferung: geprüft und offen

- Deployment `dpl_GkCvJUUHisUkP9yFeMuPkvkcN7hf` ist READY, Preview (`target=null`), Branch `marketplace-ux-v1`, Commit `ca102da9ed990dd481c96aac81e8f71be8d3ad20`.
- Fester Host: `duelvantav5vision-5rsb082mr-bennyescaped-3783.vercel.app`.
- `/battle-webrtc.js` wurde dort mit HTTP 200 und enthaltenem Fix abgerufen; Cache-Control `public, max-age=0, must-revalidate`.
- Weitere Abrufe von `/site-nav.js`, Runtime-Config-Endpunkt und BATTLE-Seite über den verfügbaren Vercel-Fetch landeten in HTTP-302-SSO-Weiterleitungen. Daher KEINE vollständige angemeldete Preview-/Staging-Laufzeitabnahme behauptet. Der unveränderte Routing-Guard ist durch die vollständige PR-CI geprüft; das ersetzt keine angemeldete Browser-Abnahme auf diesem Deployment.
- Keine Production-Deployments, Datenbankänderungen, Zahlungen, Meldungen, Testdatenlöschungen oder Änderungen an TRADE/Swap/Production-Hard-Lock durchgeführt.

## Nächster kontrollierter Schritt

Mit den bestehenden Staging-Testkonten auf dem festen Preview eine echte Zwei-Geräte-Abnahme durchführen: initial Bild/Ton in beide Richtungen, Gastkamera stoppen, Host-Neuverbindung abwarten, Gastkamera wieder starten, wiederholen, anschließend Hostkamera neu starten sowie Mikrofon und Bereitschaftssperre prüfen. Falls das Preview zunächst Vercel-Authentifizierung verlangt, den regulären Owner-Zugang verwenden. Erst nach dieser Bestätigung gilt auch der reale iPhone/Safari-Pfad als abgenommen. V26 bleibt zusammen mit diesem Delta die Arbeitsgrundlage; TRADE bleibt eingefroren.


## Reale Zwei-Geräte-Abnahme und Post-V26-Fixes – 18.09.2026

Die zuvor offene reale Preview-Abnahme wurde auf Staging durchgeführt und ist für den geprüften BATTLE-Kernpfad **PASS**.

### Während der Abnahme gefundener Account-Status-Befund

Reproduziert:
- `test-verkaeufer@duelvanta.de` konnte zunächst kein Match erstellen: `Account ist nicht aktiv`.
- Derselbe Fehler wurde vom Owner auch auf der bestehenden Beta-Seite mit seinem regulären Account beobachtet; Production wurde daraufhin ausdrücklich nicht verändert.

Ursache auf Staging:
- `profiles.account_status` kennt `beta`, `active`, `suspended`.
- normale Beta-Profile stehen korrekt auf `beta`.
- BATTLE-RPCs akzeptierten jedoch nur `active`.
- `activate_my_beta_account()` setzt den Profilstatus selbst nicht auf `active`; der BATTLE-Guard widersprach damit dem Beta-Statusmodell.

Minimaler Fix:
- Migration `supabase/migrations/20260918123500_battle_beta_account_status_v1.sql`.
- BATTLE akzeptiert `beta` und `active`.
- `suspended`, `safety_restricted`, anonyme/null Auth bleiben gesperrt.
- keine Nutzer wurden künstlich von `beta` auf `active` umgestellt.
- Migration wurde nach grüner CI kontrolliert nur auf DUELVANTA-STAGING `xhmjxrcskfhbovhitdej` angewandt.
- Production-Supabase blieb unverändert.

Technischer Zwischenstand: `0a2b0ae095be70e28f319e9889ff745e2274839e`.
CI:
- Scanner V16 Check #529 / Run `35335547219`: SUCCESS.
- Battle WebRTC Check #5 / Run `35335547504`: SUCCESS.

### Reale Zwei-Geräte-WebRTC-Abnahme

Preview für die Kernabnahme: `duelvantav5vision-5rsb082mr-bennyescaped-3783.vercel.app`.
Rollen:
- Host: `test-verkaeufer@duelvanta.de`, Desktop-Browser.
- Gast: `test-kaeufer@duelvanta.de`, iPhone/Safari.

Praktisch bestätigt:
- Safety-Gate und Arena Code;
- öffentliche Pokémon-Casual-Lobby;
- Match erstellen nach Account-Status-Fix;
- Gast sieht Match in Live-Lobby und kann beitreten;
- Host-/Gast-Zuordnung korrekt;
- lokales Kamerabild auf beiden Geräten;
- Video bidirektional;
- Audio bidirektional;
- Mikrofon stumm/an auf beiden Geräten;
- Status `LIVE VERBUNDEN`;
- Gastkamera mehrfach stoppen/starten: Gegenbild verschwindet und kehrt jeweils nach ca. 1–2 Sekunden zurück;
- Hostkamera mehrfach stoppen/starten: Verbindung wird erwartungsgemäß neu aufgebaut und beide Richtungen kehren automatisch zurück;
- Kamera-aus-Ready-Gate blockiert Bereitschaft mit dem Hinweis, zuerst die Kamera zu aktivieren;
- beide Ready-Zustände synchronisieren;
- `MATCH STARTEN` nur im Hostpfad nach beiden Ready;
- Matchstatus `MATCH LÄUFT`;
- übereinstimmende Ergebnisabgabe: `MATCH ABGESCHLOSSEN`;
- absichtlich widersprüchliche Ergebnisabgabe: `ERGEBNIS UNKLAR · PRÜFUNG NÖTIG`, kein automatisch bestimmter Sieger;
- Webcam-Bild, das auf einzelnen Fotos schwarz erscheint, wurde vom Owner als Foto-/Aufnahmeartefakt bestätigt und nicht als BATTLE-Befund gewertet.

### Während der Abnahme gefundener Kamera-UI-Lifecycle-Befund

Reproduziert:
Nach einem vorherigen Match und Erstellung eines neuen Matches ohne erneuten Kamerastart konnte der Button noch `KAMERA STOPPEN` anzeigen, während der Status bereits korrekt `KAMERA NICHT AKTIV` meldete.

Minimaler Fix:
- `battle-webrtc.js` synchronisiert den Kamera-UI-Zustand mit tatsächlich vorhandenen live MediaTracks.
- ohne aktiven Stream werden Video-Fallback, `KAMERA TESTEN`, versteckter Mikrofonbutton und `KAMERA NICHT AKTIV` konsistent hergestellt.
- Regression in `tests/battle-webrtc-restart-test.mjs`.

Finaler technischer Checkpoint dieser Abnahme:
`5ff782c86a3a55650a62f7d91860b0628e7137a8`

CI:
- Scanner V16 Check #531 / Run `35337780911`: SUCCESS.
  - `validate`: SUCCESS.
  - `quota_database`: SUCCESS.
- Battle WebRTC Check #7 / Run `35337780919`: SUCCESS.

Finales Preview:
- Deployment `dpl_8qKuCrQhvvmSDRmGEaU76kAjzMhZ`.
- Host `duelvantav5vision-55flywomc-bennyescaped-3783.vercel.app`.
- Zustand READY, Preview / kein Production-Target.
- Commit exakt `5ff782c86a3a55650a62f7d91860b0628e7137a8`.

Praktischer Retest auf diesem finalen Preview:
Neues Casual-Match ohne Kamerastart zeigt konsistent `KAMERA TESTEN`, `KAMERA NICHT AKTIV` und den Fallback `Kamera noch nicht aktiv`. Owner bestätigt den Ablauf als einwandfrei.

### Grenzen

- main unverändert: `50f88213571be13255bb52eb489cc28cca660001`.
- PR #5 bleibt open, Draft, unmerged.
- Production und Production-Supabase wurden nicht verändert.
- TRADE bleibt eingefroren.
- Production-TRADE-Hard-Lock wurde nicht ausgerollt.
- Stripe Live, echte Payments/Refunds/Payouts und produktive PStTG/DAC7-Meldungen bleiben unangetastet.
- Der separate Staging-Security-Advisory zu `public.market_notification_sync_state` ohne RLS wurde während der Analyse sichtbar, aber wegen TRADE-Freeze nicht verändert; er bleibt für den späteren Security-/Pre-Merge-Audit zu berücksichtigen.
