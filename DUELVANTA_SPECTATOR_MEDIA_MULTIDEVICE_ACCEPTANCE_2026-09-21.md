# DUELVANTA – Spectator Media V1 Mehrgeräte-Abschlussabnahme
Stand: 2026-09-21. Ergebnis: PASS für den unten beschriebenen funktionalen Staging-Testumfang.

## Geltungsbereich und Freigabe

- Repository Bennyescaped/duelvanta, ausschließlich marketplace-ux-v1.
- Erwarteter Ausgangsstand: ce28d883a9dfb353ba0a087e8b82fa607f838a79; vorheriger praktischer Anwendungscode bda7617a18eea1897f9add7d9440c1c3b3d49793.
- Abschließend grün geprüfter Code-/Test-Head: 73f6baeb08116be4753799155b787f7ea937cd8a.
- Ausschließlich Supabase-Staging xhmjxrcskfhbovhitdej und zugehörige Preview/LiveKit-Testkonfiguration.
- media_enabled=true: nach erfolgreichen praktischen Nachweisen und grünen Regressionen für Staging freigegeben. Vorherige true-Phasen waren kontrollierte, ausdrücklich abgestimmte Testfenster; bei Fehlern wieder false.
- Beta-Konfiguration weiterhin max_viewers_per_match=50. Kein Lastnachweis für 50 gleichzeitige Zuschauer.
- Production/main/Production-Supabase/Stripe Live nicht verändert. main abschließend read-only geprüft: 50f88213571be13255bb52eb489cc28cca660001. Keine manuellen Production-Deployments.
- STOP nach diesem Abschluss; keine weitere BATTLE-Entwicklung autorisiert.

## Tatsächlicher Aufbau

A: Host verkaeufer, Desktop Chrome. B: Gast testKaeufer, iPhone Safari.
C: Zuschauer test-judge, Safari auf demselben Mac wie A, mit getrennter Browser-Sitzung.
Damit zwei physische Geräte/Kameras und drei getrennte Browser-Clients, nicht drei physische Geräte.
Privates Casual-Pokémon-Match ce04c4af-5afb-4495-9569-d5c89e4c2e87.
Kein Zuschauer-Link, JWT, API-Key oder sonstiges Secret wird hier dokumentiert.

## Praktische Nachweise

| Nachweis | Ergebnis und Evidenz |
| --- | --- |
| Host/Gast im selben Match, beide Kameras | PASS, Screenshots und Nutzerbestätigung |
| Spieler-P2P in beide Richtungen | PASS, mehrfach bestätigt, auch nach echtem SFU-Widerruf |
| Separater Zuschauerpfad | PASS; C zeigt beide Spieler, keinen dritten Spielerplatz |
| Bild und Ton beider Spieler auf C | PASS; auch nach Widerruf und erneuter Zustimmung nochmals bestätigt |
| Viewer read-only | PASS; UI ohne Spiel-/Moderationsrechte, LiveKit-Viewer mit tracks=[]; Broker-Grant-Regression schützt Publish/Data-Grenzen |
| Presence | Bestehende praktische Foundation-/Mehrtab-Abnahme übernommen; Zähler im aktuellen Aufbau 1; parallele Rollen-/Presence-Regressionsfälle zusätzlich grün. Kein Lasttest behauptet |
| Consent | Host widerruft über bestehende UI; Gast-Zustimmung bleibt bestehen. Ohne Host-Zustimmung media_open=false, Broker 403 |
| Neue gültige Epoche | Erst nach erneuter Host-Zustimmung media_open=true; Host/Gast/Viewer gemeinsam in neuer, nicht widerrufener Epoche |
| Echter RemoveParticipant | Vorher echte Publisher/Viewer vorhanden; danach C ohne Streams, P2P bleibt erhalten; Reconciler HTTP 200 und Outbox done |
| Alter, noch gültiger Host-Token | Reconnect nach Serverentfernung HTTP 401 bei 24 Sekunden Restlaufzeit vor UND nach Versuch; nicht bloßer Tokenablauf |

Der öffentliche Foundation-Pfad sowie Linkrotation, Spieler-Code-Trennung und Presence-Deduplizierung waren bereits abgenommen und wurden nicht unnötig neu entwickelt. Die automatisierten Foundation-Tests wurden erneut ausgeführt.

## B2-Evidenz

Erster realer Widerruf: id=13, epoch=ff0354a3-6f83-48f3-8536-e3309f94cd15, reason=player_withdrawal, done. Reconciler-Response 857: HTTP 200, processed=2, failed=0 (einschließlich zusätzlicher generation_changed-Outboxzeile). Dabei wurde der P2P-Track-Eigentumsfehler entdeckt; kein PASS für diesen Versuch.

Wiederholung nach Fix: id=15, epoch=2cb081cb-cb2f-4724-b14c-fd0cb8beb92f, player_withdrawal, done. Response 972: HTTP 200, processed=2, failed=0. C verliert Streams; A/B bleiben verbunden, Nutzer bestätigt.

Gültiger Alte-Token-Versuch: id=19, epoch=f433ceea-fab9-4632-820d-7797c4e11c3e, player_withdrawal, done. Response 1109: HTTP 200, processed=2, failed=0. Browserdiagnose:
- Verbindung mit demselben Token zuvor erfolgreich.
- Disconnect reason=4.
- restVorher=24, status=401, restNachher=24.
- A/B bleiben live, C ohne Streams, Nutzer bestätigt.
- Token nur im Browser-Arbeitsspeicher, nicht in Testdateien oder Logs absichtlich ausgegeben; Diagnosevariable danach verworfen. Keine Netzwerk-URLs mit Token als Evidenz übernehmen.
- Replay konkret für Host-Publisher geprüft; kein separater individueller Viewer-/Gast-JWT-Replay behauptet.

Nach erneuter Host-Zustimmung: epoch=eab391a7-a58b-42ab-949b-0f165439f230, beide Consents true. Inspector-Responses 1134 und 1190: HTTP 200, genau Host/Gast/Viewer in neuer Epoche, Viewer ohne eigene Tracks. Alte Revocation id=19 bleibt done. Bild/Ton erneut vom Nutzer bestätigt.

Cron blieb während der Widerrufe aktiv (5 Sekunden); der flüchtige pending-Zustand wurde bei diesen Versuchen nicht manuell angehalten/gesondert fotografiert. Outbox-Erzeugung pending und Reconciler-Übergang done sind durch implementierten Pfad, Datenbankregression und korrelierte echte Verarbeitung belegt. Keine Outbox-/Consent-/Epoch-Manipulation zur Erzeugung eines PASS.

## Minimal behobene Fehler

1. Viewer nutzte einen nicht global verfügbaren DB-Bezeichner; vorhandenen zentralen Client window.__dvAppDb angebunden.
2. Nicht existierende LiveKit-.umd.min.js-URL durch veröffentlichte .umd.js der gepinnten Version 2.15.6 ersetzt.
3. Broker-CORS: OPTIONS 204 und exakt freigegebener Preview-Origin; keine Auth-/Environment-Umgehung.
4. Broker-503 bei Token-Signierung: TrackSource-Enums statt Strings, LiveKit Server SDK 2.19.0 und Supabase 2.116.0 gepinnt. Mit echtem SDK reproduziert und Sign/Verify grün getestet.
5. Viewer-Layout: Videos auf zwei begrenzte Spalten, mobil eine Spalte; Audio kein sichtbares Grid-Element. Safari-Screenshot und Chromium-Layoutregression grün.
6. Publisher stoppte beim SFU-Widerruf die Originaltracks des P2P. Gepinntes SDK bestätigt Default-Stop-Verhalten. Fix: stopLocalTrackOnUnpublish=false, unpublishTrack(track,false), disconnect(false), Disconnected-Referenzbereinigung und Cleanup partieller Setup-Fehler. Keine Änderung an battle-webrtc.js.
7. Veralteter HTML-Hash im Foundation-Test: Nachweis, dass ausschließlich .umd.min.js → .umd.js den alten Hash erklärt. Erwartungswert gezielt aktualisiert, Schutzprüfung nicht entfernt.

Anwendungsfix für Track-Eigentum: 1975f83e78240c6eb84b1f6182a055ac729d77c9.
Publisher-Regression: 59085746e4002f1d869442058a88cd392e5562c5.
Finale Testintegration: 73f6baeb08116be4753799155b787f7ea937cd8a.

## Regression

- Battle WebRTC Check #87 SUCCESS: https://github.com/Bennyescaped/duelvanta/actions/runs/35578134937
  - spectator_database SUCCESS (echtes PostgreSQL, Foundation und Media).
  - battle_webrtc SUCCESS (Publisher/Broker/Reconciler, Routing, Foundation-Browser, Media-Layout, echter Browser-WebRTC-Test mit isoliertem Signaling).
- Scanner V16 Check #611 SUCCESS: https://github.com/Bennyescaped/duelvanta/actions/runs/35578134873
- Lokale Publisher-Regression zunächst mit altem Adapter FAIL (Originaltracks beendet), mit Fix PASS.
- Lokale Kamera-Neustart-, Routing-, Reconciler-, Scanner-Contract- und Acceptance-Regression PASS.
- Broker mit realem gepinntem SDK Sign/Verify PASS (synthetische Testschlüssel, keine Provider-Secrets).
- Lokal fehlendes Chromium verhinderte lokale Browserausführung; erfolgreicher CI-Browserlauf ersetzt keine behauptete lokale Ausführung.

## Diagnosehinweise und Grenzen

Die zusätzliche Staging-Inspector-Funktion lieferte nach Raumabbau zeitweise HTTP 500. Ursache nicht abschließend reproduziert; nicht als reparierter Providerfehler behauptet. Version 2 ergänzt ausschließlich gefilterte Fehlercodes und Operationsphase bei unverändertem Secret-Header-Auth. Danach HTTP 200 mit leerer Raumliste sowie mehrfach mit korrekter neuer Belegung. Reconciler selbst meldete bei den maßgeblichen Widerrufen keine Fehler. Leere Liste allein war nie der Alte-Token-Nachweis.

Ein erster temporärer Browser-Replay-Hook war unwirksam, weil connect in SDK 2.15.6 eine Instanzfunktion ist. Dieser Test wurde ausdrücklich NOT RUN gewertet; nach Reload korrigiert und durch den oben dokumentierten echten 401-Nachweis ersetzt.

Keine Aussage über 50-Zuschauer-Last, dritte physische Hardware, alle Netzwerkwechsel/Browserkombinationen oder Production-/Legal-Release. Bereits bestehende Legal-Gates bleiben unverändert.
