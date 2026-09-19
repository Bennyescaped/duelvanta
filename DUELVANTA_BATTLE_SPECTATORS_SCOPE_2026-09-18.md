# DUELVANTA – BATTLE Zuschauer / private Einladungsabnahme

Stand: 18.09.2026. Ergänzung zu Masterhandout V27 und `DUELVANTA_BATTLE_ASYNC_STATE_2026-09-18.md`. Keine Produktionsfreigabe.

## Verbindlicher Produktwunsch des Owners

BATTLE soll Zuschauer unterstützen:
- Öffentliche Matches: Zuschauerbeitritt ohne individuelle Einladung.
- Private Matches: Zuschauerbeitritt nur mit gültiger Einladung.

Zuschauer sind eine eigene Rolle, kein zweiter Gast und kein Judge. Zuschauer dürfen weder Spielerplätze belegen noch Ready, Matchstart, Ergebnisse oder Moderation bedienen. Für private Matches ist eine von der Spielereinladung getrennte, serverseitig überprüfte Zuschauerberechtigung vorzusehen; eine private Match-ID allein darf keinen Medienzugriff gewähren.

Planungsgrundlage: Die bestehenden BATTLE-Zugangs-, Alters-, Safety- und Sperrregeln bleiben erhalten. „Freier Beitritt“ öffnet öffentliche Matches ohne Einladung innerhalb dieser Regeln; anonymer Zugang wird dadurch nicht automatisch freigegeben. Zuschauer senden standardmäßig keine Kamera und kein Mikrofon. Sichtbarkeit für Zuschauer muss für beide Spieler vor dem Medienstart klar erkennbar sein.

Dies ist ein eigener späterer Entwicklungsblock. Der aktuelle Zweier-WebRTC-Pfad wird nicht ungeprüft für weitere Empfänger geöffnet. Medienverteilung, Rollen-/Einladungsschutz, Moderation, Kapazität und laufende Kosten müssen dafür gesondert umgesetzt und geprüft werden. Keine Zuschauerzahlen zusichern, keine kostenpflichtigen Dienste buchen und keine öffentlichen Streams aktivieren, bevor Architektur, Budget und Freigabe geklärt sind. Keine dauerhafte Webcam-Aufzeichnung als Teil dieses Wunsches einführen.

Status: **Anforderung dokumentiert; Zuschauerfunktion noch nicht implementiert oder abgenommen.**

## Jetzt: private Spieler-Einladungen praktisch prüfen

Ausgangs-Head bei der read-only GitHub-Prüfung: `dfcb0cd9a6385eebc2730cc416836f22b368a8c7`.
Geprüfter technischer Checkpoint bleibt `4c75af5b14d83f0eea13cd9e8edf40ca71cff97b`.
Festes Test-Preview: `duelvantav5vision-37l4rdiy8-bennyescaped-3783.vercel.app`.
Deployment: `dpl_FMHNsAZ3A5KckWmk4QnEuUDC2eRn`, erneut als READY / target=null / marketplace-ux-v1 verifiziert.

Testrollen wie in der abgeschlossenen Kernabnahme:
- Host: `test-verkaeufer@duelvanta.de`.
- Gast: `test-kaeufer@duelvanta.de`.

Offener Prüfumfang: privates Casual-Match erstellen; nicht in öffentlicher Lobby sichtbar; falschen Code ablehnen; gültigen Code verwenden; Host-/Gast-Zuordnung; bereits besetzte und beendete Matches; mehrfacher Beitrittsklick. Keine Wiederholung der bereits bestandenen Zwei-Geräte-Kamera-/Audio-Kernabnahme. Kamera/Mikrofon für den ersten Einladungstest ausgeschaltet lassen.

Durchführung mit Owner-Screenshots, schrittweise. Zuerst aktuellen BATTLE-Bildschirm des Host-Testkontos prüfen: Ein altes noch offenes Match darf nicht stillschweigend gelöscht oder per SQL als abgeschlossen markiert werden. Neue praktische Prüfpunkte erst nach beobachtetem Ergebnis als bestanden dokumentieren.

Prüfgrenze dieses Dokumentationsschritts: Die read-only Supabase-Abfrage zum aktuellen Matchzustand der Testkonten wurde vom Werkzeug blockiert; deshalb kein neuer Datenbankbefund und keine Aussage, dass die Testkonten aktuell matchfrei sind. Noch keine neue private Zwei-Nutzer-Abnahme durchgeführt und keine neuen Testergebnisse behauptet.

## Unveränderte Grenzen

Nur Dokumentation auf `marketplace-ux-v1`. main bleibt `50f88213571be13255bb52eb489cc28cca660001`; PR #5 bleibt offen und Draft. Keine Änderung an Anwendungs-/Testcode, Supabase-Schema oder Daten, Runtime-Guard, TRADE, Stripe Live, Production-Testdaten, Production-TRADE-Hard-Lock, Logo oder Slogan. Der zurückgestellte RLS-Auditpunkt bleibt unverändert.
