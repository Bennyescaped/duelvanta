# DUELVANTA MASTERHANDOUT V29 — 2026-09-20

## 1. Verbindlicher Zweck
V29 ist der aktuelle Übergabestand nach V28 und dem Entwicklungsblock BATTLE Spectator Media V1 bis zum bewusst pausierten Mehrgeräte-Gate. Bei Widersprüchen ersetzt V29 ältere Statusangaben. Technische Detailentscheidungen aus `DUELVANTA_BATTLE_SPECTATOR_MEDIA_V1_ARCHITECTURE_2026-09-18.md` bleiben ergänzend verbindlich.

Nächster Arbeitsblock im neuen Chat: **IT-Recht Kanzlei / Rechtstexte und Plattform-Compliance**. Der Nutzer hat inzwischen Zugang zu den Rechtstexten/Generatoren der IT-Recht Kanzlei. Spectator Media V1 bleibt bis zum echten Mehrgerätezugang eingefroren.

## 2. Repository / harte Grenzen
- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch ausschließlich: `marketplace-ux-v1`
- aktueller Dokumentations-Head nach V29-Erstellung: wird durch den V29-Commit bestimmt
- letzter vor V29 bestätigter technischer/Code-Head: `6076c0f1fb778d8bb06d87f1431521ebb48d1731`
- letzter Spectator-Media-Architektur-Dokumentationscommit: `8a695483b316bab271398e7abd8c469fa07bab9e`
- Production-main unverändert: `50f88213571be13255bb52eb489cc28cca660001`
- PR #5 bleibt offen, Draft, unmerged.
- main nicht verändern.
- Production nicht verändern.
- Production-Supabase `enifiaqsnqtbzylnfrpi` nicht verändern.
- Stripe Live nicht aktivieren; keine echten Payments, Refunds oder Payouts.
- TRADE bleibt technisch eingefroren; Tausch/Swap nicht reaktivieren.
- `v-logo.svg` nicht verändern.
- Slogan bleibt: **COLLECT. TRADE. BATTLE.**
- geschlossene Foundation-/Ranked-/Private-Invitation-/Camera-Abnahmen nicht ohne neuen reproduzierbaren Befund erneut aufrollen.

## 3. BATTLE Spectator Foundation V1 — abgeschlossen
Foundation V1 bleibt praktisch abgenommen:
- öffentlicher und privater Zuschauerpfad
- read-only Zuschauer
- keine Spielerplatzbelegung
- Presence-Deduplizierung
- normales Verlassen
- private Link-Rotation/Widerruf
- Spieler-Code und Zuschauerlink strikt getrennt
- Inline-Ablehnung eines Spieler-Codes im Zuschauerformular
- bestehender Host↔Gast-P2P-WebRTC-Pfad geschützt

Historische Foundation-Referenzen:
- technischer Head: `7ee367213eb0c92838162d1a5b82dc5757eca93e`
- finaler Foundation-Head: `4a4b5f6ddcd29a7244c22d4d8450be71527c2e59`
- Foundation-Preview: `dpl_2ZgkATJYyWyngTMWFyHGQvvRMUqW` READY

## 4. Spectator Media V1 — Architekturentscheidung
Verbindliche Entscheidung: **SFU über LiveKit**, nicht Zuschauer-P2P/Mesh.

Zielmodell:
- Host↔Gast-P2P bleibt als produktkritischer Spielerpfad bestehen.
- Spieler publizieren zusätzlich maximal einen Media-Uplink zur SFU.
- Zuschauer sind subscribe-only.
- Spielerupload wächst nicht linear mit Zuschauerzahl.
- serverseitiges Schutzlimit initial 50, ohne Codeänderung konfigurierbar.
- 100–500 Zuschauer sollen im selben Grundmodell möglich bleiben.
- langfristig 1.000+ über additive Broadcast/CDN-Schicht hinter den Publishern; kein Neuaufbau des BATTLE-Kerns.
- keine dauerhafte Webcam-Aufzeichnung in Media V1.

LiveKit-Staging:
- separates LiveKit-Cloud-Projekt `Duelvanta`
- Project Data Region: European Union (Frankfurt)
- eigener Service-Account-Key für Spectator Media Staging
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` ausschließlich als Supabase-Staging Edge Function Secrets
- keine Secrets im Repository/Client/Chat
- keine kostenpflichtige Hochstufung als Teil dieses Blocks

## 5. Supabase-Staging / Media-Unterbau
Staging-Projekt: `xhmjxrcskfhbovhitdej` / DUELVANTA-STAGING.

Eingerichtet:
- Spectator-Media private DB-Struktur
- serverseitig konfigurierbares Limit: 50
- separate Match-Zustimmung Host/Gast
- Media-Epochen
- persistente Revocation-Outbox
- Publisher-Admission
- Viewer-Admission an Foundation-Presence/Berechtigung gekoppelt
- LiveKit Media Broker
- Reconciler
- `pg_net`, `pg_cron`, Vault aktiviert
- dediziertes `MEDIA_RECONCILER_SECRET` / Vault-Verknüpfung; keine Secrets dokumentieren oder auslesen

Reconciler:
- Reconcilerfehler behoben, indem private Media-Daten nicht direkt über die Data API gelesen werden.
- zwei ausschließlich für `service_role` ausführbare RPCs; privates Schema bleibt für Browserrollen geschlossen.
- Reconciler ACTIVE Version 5.
- praktischer Teilnachweis: Revocation id=1, reason `player_withdrawal`: `pending -> HTTP 200 -> done`, Ergebnis `processed=1, failed=0`.
- Wiederholungsaufruf idempotent: `processed=0`.
- alte Epoche wird nicht wiederverwendet.
- Dieser Teilnachweis enthielt noch keinen verbundenen LiveKit-Teilnehmer; deshalb B2 nicht als vollständig PASS markieren.

## 6. Spielerzustimmung / B1
Praktisch geprüft:
- Host und Gast müssen separat pro Match zustimmen.
- Zustimmung wird nicht aus Arena Code, Kameraerlaubnis, Ready-State oder öffentlicher Sichtbarkeit abgeleitet.
- Rücknahme eines Spielers beendet Spectator-Media, nicht das Spieler-Match.
- Rücknahme rotiert die Media-Epoche und erzeugt einen Widerrufsauftrag.
- UI: `LIVE-ZUSCHAUERÜBERTRAGUNG ERLAUBEN` / `... STOPPEN`.
- keine dauerhafte Webcam-Aufzeichnung als Media-V1-Funktion.

Rechtliche/Datenschutz-Texte bleiben vor Live anwaltlich/organisatorisch final zu prüfen. Keine technische Dokumentation als anwaltliche Freigabe ausgeben.

## 7. Publisher-/Viewer-Clientschicht
Implementiert, isoliert und additiv:
- `battle-spectator-media-publisher.js`
  - nutzt nur bereits vorhandene Spieler-Kamera-/Mikrofontracks
  - fordert keine zweite Kamera an
  - besitzt/stoppt den P2P-Quelltrack nicht
  - später gestartete Tracks werden nachpubliziert
  - gestoppte/deaktivierte Tracks werden unpublished
- `battle-spectator-media-viewer.js`
  - receive-only / subscribe-only
  - kein `getUserMedia`
  - keine Kamera-/Mikrofontracks des Zuschauers
- LiveKit Browser SDK gepinnt
- bestehendes `battle-webrtc.js` nicht grundlegend umgebaut

Praktischer iPhone/Safari-Spielertest:
- Kamera AN -> stabil -> Kamera AUS funktionierte.
- bestehender Spielerpfad blieb funktionsfähig.
- daraus keine endgültige Safari-Zuschauerabnahme ableiten.

## 8. Privater Zuschauerpfad / Login-Fix
Praktischer Befund: Login-Rücksprung aus privatem Zuschauerpfad führte zunächst auf Vercel 404.

Behoben:
- sichere same-origin Rückkehr inklusive Match-Queryparameter
- Path-Traversal abgewiesen
- externe Origins abgewiesen
- privates `#spectator=...` Fragment wird nicht durch Login persistiert/weitergereicht
- nach Login privaten Zuschauerlink erneut öffnen

Praktisch bestätigt:
- private Spectator Presence
- read-only
- Zuschauerzähler
- Host/Gast-Spielerplätze bleiben getrennt
- kein Spieler-/Judge-Recht für Zuschauer

## 9. CI / letzter bestätigter Stand
Für Code-Head `6076c0f1fb778d8bb06d87f1431521ebb48d1731`:
- Battle WebRTC Check #68: **SUCCESS**
  - `battle_webrtc`: SUCCESS
  - `spectator_database`: SUCCESS
- Scanner V16 Check #592: **SUCCESS**

Der danach erstellte Media-Architektur-Dokumentationscommit `8a695483b316bab271398e7abd8c469fa07bab9e` enthält den praktischen Checkpoint. V29 ist Dokumentation/Übergabe und darf den technischen PASS nicht künstlich erweitern.

## 10. Offenes Media-Gate — bewusst pausiert
Der echte Ende-zu-Ende-Nachweis fehlt noch:
`Spieler-Publisher -> LiveKit -> autorisierter Viewer -> Widerruf -> echter RemoveParticipant/Disconnect -> alter Reconnect abgewiesen -> neue Epoche nur nach erneuter Autorisierung`.

Ein Ein-iPhone-Test ist dafür nicht belastbar, weil iOS/Safari Hintergrundtabs Kamera/Ausführung pausieren kann. Das im Ein-Gerät-Versuch fehlende Zuschauerbild ist **weder PASS noch FAIL**.

Spectator Media V1 ist deshalb bis zum Zugang zu einem zweiten gleichzeitig aktiven Gerät/Browserkontext pausiert. Nutzer gibt Bescheid, sobald ein zweites Gerät verfügbar ist.

Dann exakt fortsetzen:
1. Gerät 1: Spieler/Publisher mit Kamera.
2. Gerät 2: autorisierter Zuschauer.
3. Bild/Ton praktisch nachweisen.
4. Viewer sendet keine Kamera/Mikrofontracks.
5. Zustimmung/Link widerrufen.
6. echter `RemoveParticipant` / Disconnect nachweisen.
7. alter Token/Reconnect muss scheitern.
8. neue Epoche nur nach neuer Autorisierung.
9. Host↔Gast-P2P Regression.
10. danach automatisierter Lasttest 1 -> 10 -> 50 Viewer.
11. echte iPhone/Safari-Zuschauerabnahme niemals durch Cloud-/Chromium-Test ersetzen.

## 11. Skalierungs-/Kostenstrategie
- Beta-Normalfall 0–10 Zuschauer/Match.
- initiales Schutzlimit 50.
- 100–500 ohne Wechsel des SFU-Grundmodells.
- 1.000+ architektonisch über additive Broadcast/CDN-Distribution.
- große Zuschauerzahlen nicht dauerhaft als tausende interaktive WebRTC-Viewer erzwingen, wenn Broadcast/CDN wirtschaftlicher ist.
- Sponsoring/Werbung kann später Produktfinanzierung unterstützen, ist aber kein technisches Acceptance-Kriterium.

## 12. Codex / Work Rollen
- Work: Browser-/Dashboard-Workflows und praktische Web-Abnahmen, wo Cloud-Browser geeignet ist.
- Codex soll erst für die technische Schlussabnahme vor Live gezielt eingesetzt werden: eingefrorenen Release Candidate repository-weit prüfen, Tests/Edge Cases/Race Conditions/Auth/RLS/Migrationen/CI/Lasttests untersuchen.
- Codex nicht als Ersatz für echte iPhone/Safari-Geräteabnahme verwenden.
- Codex darf Production nicht eigenmächtig verändern oder live deployen.

## 13. Nächster Chat — IT-Recht Kanzlei
Priorität im nächsten Chat: **Rechtstexte der IT-Recht Kanzlei in DUELVANTA einarbeiten/abgleichen.**

Der Nutzer hat jetzt Zugang zur IT-Recht Kanzlei. Ziel:
- vorhandene/erzeugte Rechtstexte vollständig erfassen
- klären, welche Texte für DUELVANTA als Plattform/Marktplatz tatsächlich benötigt werden
- Texte nicht frei umformulieren, wenn dadurch Kanzlei-Update-/Haftungsvorteile verloren gehen
- technische Einbindungsorte und Links in DUELVANTA bestimmen
- Trade/Marketplace-Besonderheiten, private/gewerbliche Verkäufer, Notice & Action, Datenschutz/Cookies/Tracking, Plattform-Nutzungsbedingungen und sonstige bereitgestellte Kanzlei-Texte systematisch zuordnen
- bestehende technische Compliance mit den gelieferten Rechtstexten abgleichen
- anwaltliche/steuerliche Schlussprüfung vor Produktivstart bleibt erforderlich
- keine Produktivschaltung nur aufgrund dieses Dokumentenblocks

Wenn Texte nur im IT-Recht-Kanzlei-Kundenportal zugänglich sind, Nutzer/Work kann die Inhalte bereitstellen bzw. im Browser öffnen. Zugangsdaten/Passwörter niemals in Repository, Handout oder Chat dokumentieren.

## 14. Startanweisung für nächsten Chat
Zuerst V29 vollständig lesen und tatsächlichen Branch-/Head-/CI-Stand gegenprüfen. Spectator Media nicht weiterentwickeln, solange kein zweiter gleichzeitig aktiver Geräte-/Browserkontext für das offene praktische Gate verfügbar ist. Stattdessen mit den vom Nutzer nun verfügbaren IT-Recht-Kanzlei-Rechtstexten fortfahren. main/Production/Production-Supabase/Stripe Live unverändert lassen.
