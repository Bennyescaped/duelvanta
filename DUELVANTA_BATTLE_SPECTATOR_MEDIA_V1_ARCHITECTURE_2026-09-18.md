# DUELVANTA – BATTLE Spectator Media V1 – Architekturentscheidung

Stand: 18.09.2026. Ausschließlich `Bennyescaped/duelvanta`, Branch `marketplace-ux-v1`.

**Architekturentscheidung: bestehendes Spieler-P2P beibehalten; separate LiveKit-Cloud-SFU für Zuschauer.**

**Implementierungs-Gate: BLOCKED / OPEN. Keine Spectator-Media-Codeänderung, keine Provider-Aktivierung und keine Media-Migration in diesem Arbeitsschritt.**

Die Entscheidung benennt einen konkreten Zielweg, ist aber keine Implementierungs-, Datenschutz-, Kosten- oder Produktionsfreigabe. Die offenen Voraussetzungen in Abschnitt 12 müssen vor Media-Codeänderungen geschlossen werden. Fehlende Abnahmen werden nicht als PASS gewertet. Dieses Dokument ergänzt V28; die abgeschlossene Spectator Foundation V1 bleibt abgeschlossen.

## 1. Verbindliche Grundlagen und tatsächlich geprüfter Stand

Vollständig gelesen: `DUELVANTA_MASTERHANDOUT_V28_2026-09-18.md`, `DUELVANTA_BATTLE_SPECTATOR_FOUNDATION_V1_2026-09-18.md` und die von V28 weitergeltend einbezogene V27-Grundlage. Zusätzlich wurden die nachfolgend benannten relevanten Browser-, WebRTC-, Runtime- und SQL-Pfade untersucht. Angaben aus älteren Dokumenten werden nicht mit aktuellen Remote-Nachweisen verwechselt.

### Remote-Preflight vor diesem Dokumentationscommit

| Gegenstand | Tatsächlicher Befund |
| --- | --- |
| Entwicklungsbranch | `marketplace-ux-v1` |
| Geprüfter Ausgangshead | `62d655c55878946e012758e67a19c025382e7b6f` |
| Ausgangs-Tree | `f360258691ee5b28819579ff9ded24d5ea3b2afe` |
| Production-main / PR-Base | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, draft=true, merged=false; Head entspricht dem Ausgangshead |
| Battle WebRTC Check | **#41**, Run **35384785323**, SUCCESS; `spectator_database` und `battle_webrtc` SUCCESS |
| Scanner V16 Check | **#565**, Run **35384784528**, SUCCESS |
| Aktuelles V28-Preview | **`dpl_4JpEEJsRYZrGqfyh6G9HJuBeoye1`**, READY, `target=null`, exakter Branch-/SHA-Bezug |
| Preview-Host | `duelvantav5vision-j0k1s58o0-bennyescaped-3783.vercel.app` |
| Vercel-Projekt | `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd`, Team `team_VHCwSwfBWANJvmS3qdkpJ0dK`; 12 Node-Funktionen im Deployment |
| Supabase-Staging | `xhmjxrcskfhbovhitdej`, ausschließlich lesende SQL-Transaktion |
| Foundation-Migration | `20260918150007_battle_spectator_foundation_v1` bereits installiert; nicht erneut angewandt |
| Staging-Schutz | Alle drei privaten Foundation-Tabellen mit RLS, kein SELECT für anon/authenticated; sechs öffentliche Spectator-RPCs nur für authenticated ausführbar; interne Helfer für Browserrollen geschlossen |
| Staging-Aggregate | 12 Matches, 1 Linkzeile, 0 Grants, 0 Presence-Zeilen; keine Testdaten angelegt oder gelöscht |
| Scheduler-Voraussetzungen | `pg_cron` vorhanden; `pg_net` in der geprüften Extension-Liste nicht vorhanden |
| Media-Bestand | Keine geprüften `spectator_media`-/`livekit`-RPCs und kein Media-Schema; Ziel-Architekturdatei zuvor nicht vorhanden |

CI-Nachweise: https://github.com/Bennyescaped/duelvanta/actions/runs/35384785323 und https://github.com/Bennyescaped/duelvanta/actions/runs/35384784528 . Diese Checks betreffen den Ausgangshead, nicht einen nachträglich unbekannten Dokumentations-SHA.

V28 dokumentiert als abgeschlossene Foundation-Basis den technischen Head `7ee367213eb0c92838162d1a5b82dc5757eca93e`, den finalen Foundation-Head `4a4b5f6ddcd29a7244c22d4d8450be71527c2e59`, Checks #39/#563 und Preview `dpl_2ZgkATJYyWyngTMWFyHGQvvRMUqW`. Die aktuellen Remote-Checks #41/#565 sind neuer. Die unterschiedliche Zahl historischer Testmatches ist kein neu nachgewiesener Foundation-Defekt.

Es fand in diesem Architekturblock keine erneute angemeldete Foundation-Abnahme, kein neuer physischer Zwei-Geräte-Test und kein Media-Lasttest statt. Production-Supabase wurde nicht aufgerufen. Der tatsächliche neue Dokumentations-Head ist nach dem Commit über GitHub zu bestimmen.

## 2. Technischer Ist-Zustand

### Spielerpfad

`battle.js` hält unter anderem `db`, `user`, `currentMatch` und `stream`. `battle-webrtc.js` verwaltet innerhalb einer IIFE eine einzelne Spieler-`RTCPeerConnection`. Signalisierung erfolgt über `battle_signals` und Supabase Realtime; der Host erstellt das Offer. Kamera und Mikrofon werden gemeinsam einmal geöffnet, mit rückwärtiger Kamera und ideal 1280×720. Die Originaltracks werden an den P2P-Peer angehängt und im lokalen Video angezeigt. Mikrofonsteuerung ändert `MediaStreamTrack.enabled`; Kamera-Stopp beendet die Originaltracks.

Der vorhandene P2P-ICE-Pfad nennt Google-STUN, aber keinen TURN-Relay. Das ist ein abgegrenzter Bestandsbefund, kein in diesem Block reproduzierter Kamera-/Verbindungsdefekt und kein Auftrag zum Umbau des geschlossenen Spielerpfads.

Der parser-blockierende Guard am Anfang von `site-nav.js` routet den historischen Production-Clientaufruf in `battle.js` auf Preview sicher zu Staging. Dieser Guard darf nicht umgangen oder asynchron nach hinten verschoben werden.

### Foundation

`battle-spectator.html` / `.js` sind vom Spieler-Runtime getrennt. Die Foundation verfügt bewusst noch über keine Medien. `battle-spectator-host.js` ergänzt nur Einstieg, Zähler und Linkverwaltung.

Serverseitige Autorität liegt in `battle_spectator_private` und den sechs Foundation-RPCs. Maßgeblich sind echter Nutzer und gültige `auth.sessions`-Sitzung, BATTLE-Eignung einschließlich Status/Safety/Alter/Arena-Code/Verarbeitungssperre, Rollenabgrenzung und bei privaten Matches aktueller Grant zur aktiven Linkgeneration. Ein Spieler-Code ist kein Zuschauerzugang. Private `SP-`-Links verwenden ein URL-Fragment; gespeichert wird nur ein Fingerprint.

Presence ist an Match, Nutzer, Auth-Sitzung und Tab gebunden: Heartbeat 20 Sekunden, Lease 75 Sekunden, bis zu acht Foundation-Ansichten pro Nutzer, Zählung unterschiedlicher Nutzer. Rotation/Widerruf entfernt Grants und Presence transaktional. Das stoppt bislang nur Statuszugriff; eine externe laufende Mediensitzung gibt es noch nicht.

**Neuer, Media-spezifischer Datenschutzumfang:** Die aktuelle Safety-Erklärung in `battle.html` erwähnt sichtbare Moderatoren, Safety-Funktionen und keine dauerhafte Aufzeichnung. Sie erklärt nicht die Übertragung beider Spieler an ein Zuschauerpublikum über einen neuen SFU-Dienstleister. Bestehende Arena-Code-Bestätigungen dürfen nicht rückwirkend als Freigabe dieses neuen Umfangs behandelt werden. Das stellt die abgeschlossene Foundation nicht infrage.

## 3. Konkrete Entscheidung und Datenfluss

**Gewählt: LiveKit Cloud als verwaltete SFU ausschließlich für den Zuschauer-Medienpfad. Der bestehende Host↔Gast-P2P-Pfad bleibt unverändert.**

Begründung: Ein einmaliger zusätzlicher Publish-Pfad je Spieler entkoppelt Spielerupload und Zuschauerzahl. LiveKit bietet Browser-SDK, serverseitige Raum-/Teilnehmerberechtigungen, Cloud-Tokenwiderruf, verwaltete NAT-/TURN-Unterstützung und eine verteilte Cloud-Medienarchitektur. Die öffentlichen Tarif-/Quoteninformationen erlauben konkrete Last- und Kostenplanung. [1–7]

Keine P2P-/Mesh-Erweiterung für Zuschauer, kein Host als Verteiler für alle Teilnehmer, kein selbst gehosteter Ersatzdienst und kein offener HLS-/Recording-Pfad. Diese Auswahl wird bei einem Blocker nicht heimlich ausgetauscht.

```text
Bestehende Originalkamera + Originalmikrofon Host <── P2P ──> Gast
                  │                                        │
                  └── ein zusätzlicher SFU-Publish ──┐      │
                                                    │      │
                  Gast: ein zusätzlicher SFU-Publish ┘──────┘
                                                    │
                                 LiveKit-Cloud-Medienraum
                             (Match + nicht wiederverwendete Epoche)
                                                    │
                           autorisierte receive-only Zuschauer

Browser ── Supabase-Auth + Foundation ── serverseitiger Media-Broker
                                          │
                     private DB-Admission, Lease, Outbox, Widerruf
                                          │
                         signierte eingeschränkte Provider-Tokens
```

Jeder Spieler veröffentlicht ausschließlich seine eigenen vorhandenen Kamera-/Mikrofontracks. Der Gegnerstream wird nicht weitergeleitet. Zuschauer erhalten getrennte Host-/Gast-Videos mit eindeutig zugeordnetem Audio. Spieler abonnieren die SFU nicht zusätzlich: kein doppelter Gegner-Ton und kein zusätzliches SFU-Playback.

Sendebeginn erst nach ausdrücklicher, widerrufbarer Freigabe **beider Spieler für dieses Match** und autorisierter Mediennachfrage. Ohne Zuschauerbedarf keine dauerhaft laufenden SFU-Publisher. Ohne zwei Freigaben bleibt die vorhandene reine Statusansicht nutzbar. Eine Kameraberechtigung des Browsers oder ein öffentlicher Matchstatus allein genügt nicht als Medienfreigabe.

V1 sendet nur im freigegebenen Zustand `waiting`, `ready` oder `live`. Moderationspause, `dispute`, terminaler Status, Rollen-/Spielerwechsel oder Rücknahme einer Freigabe stoppen den Zuschauer-Medienpfad. Die Foundation darf weiterhin den passenden Status anzeigen; bestehende Spiel-/Judge-Abläufe werden nicht umgedeutet.

## 4. Technischer Integrationsweg nach Öffnung des Gates

**Steuerung über eine getrennte Supabase Edge Function auf Staging**, nicht über eine 13. Vercel-Funktion und nicht durch Erweiterung des eingefrorenen TRADE-/Compliance-Dispatchers.

Vorgesehen sind ein eng begrenzter Media-Broker mit Join/Leave/Publisher-Freigabe, ein signaturprüfender LiveKit-Webhook-Eingang sowie ein serverseitiger Reconciler. Zusätzliche private Tabellen enthalten Konfiguration, Raumepoche, Publisher-Freigaben, reservierte/aktive Media-Sitzungen und eine idempotente Widerrufs-Outbox. Browser erhalten keine direkten Tabellenrechte. Neue RPCs verwenden vollständige Objekt-/Sessionprüfungen und festes `search_path`; vorhandene Foundation-RPC-Definitionen und Spieler-RPCs werden nicht ersetzt.

Der Reconciler soll über Staging-`pg_cron` und `pg_net` die Edge Function aufrufen. Secrets gehören in den Server-Secret-Store beziehungsweise Vault. Die dafür fehlende `pg_net`-Voraussetzung ist nur festgestellt, nicht installiert. Supabase dokumentiert diese Scheduler-Kombination; eine zuverlässige konkrete Taktung und Fehlerbehandlung ist zusätzlich nachzuweisen. [13]

Clientseitig werden getrennte Publisher- und Viewer-Module ergänzt. Die Zuschauer-Foundation benötigt höchstens einen kleinen expliziten Lifecycle-Übergabepunkt für Match/Tab/Lease/Beenden. Ein Browserereignis ist niemals eine Berechtigungsquelle. Der Publisher beobachtet nur den existierenden Match-/Streamzustand; kein Überschreiben von `startMedia`, `stopMedia`, `shutdownPeer`, Ready oder Ergebnisfunktionen.

SDK-Versionen werden vor Implementierung anhand der dann verwendeten offiziellen Pakete exakt festgeschrieben und mit reproduzierbarem Dependency-Nachweis eingebunden. Keine ungepinnte `latest`-Abhängigkeit. In diesem Schritt wurde kein SDK installiert.

## 5. Authentifizierung, Rechte und Admission

### Serverseitige Zutrittsprüfung

Der Broker prüft den Bearer-Nutzer serverseitig und führt die reservierende Datenbankoperation mit dem ursprünglichen verifizierten Nutzer-JWT aus. Ein Service-Role-Aufruf mit frei vom Browser behaupteter Nutzer-ID ersetzt diese Prüfung nicht. Wiederverwendet werden `actor_session`, `eligible` und `authorized` innerhalb des privilegierten, geschlossenen SQL-Pfads.

Für Zuschauer zusätzlich erforderlich: exakte unexpired Foundation-Presence für dieselbe echte Auth-Sitzung und denselben Tab; aktueller Matchstatus; aktive Medienfreigaben; aktuelle Raum-/private Linkgeneration. Für Publisher: tatsächlicher aktueller `host_id` oder `guest_id`, eigene Freigabe und gültiger eigener BATTLE-Zugang. Moderator-/Owner-/Judge-Status allein verleiht keine Medien-Publisherrolle.

Provider-Raum, Epoche, Teilnehmeridentität und Grants werden ausschließlich serverseitig festgelegt. Fremde Raumnamen, Teilnehmer-IDs und Rollen aus Clientparametern werden nicht übernommen. Rate-Limits pro Nutzer/Sitzung und serverseitige Match-/Projektlimits gehören vor die Tokenausgabe. Antworten sind `no-store`; Token-, Schlüssel-, SP-Code- und Authorization-Header dürfen nicht protokolliert werden.

### Providerrechte

Zuschauer: `roomJoin` nur für genau einen opaken Raum, `canSubscribe=true`, `canPublish=false`, `canPublishData=false`, `canUpdateOwnMetadata=false`; keine Raumverwaltung, Aufnahme-, Create-/List-/Adminrechte. Zuschauerclient ruft weder Kamera-, Mikrofon- noch Bildschirmaufnahme auf. Eine manipulierte UI darf daran nichts ändern. Auch Audio-, Chat-/Daten- oder RPC-Publikation ist nicht erlaubt. [4]

Publisher: nur eigene Camera-/Microphone-Publikation in genau diesem Raum, keine Screen-Share-Publikation, kein Subscribe und kein Daten-Publish; keine administrativen Providerrechte im Browser. Host-/Gastzuordnung kommt aus dem Broker, nicht aus frei editierbaren Anzeigenamen. Der Viewer darf höchstens die zwei freigegebenen Publisher mit deren Audio/Video abonnieren.

Provider-API-Secret und administrative Tokens bleiben ausschließlich serverseitig. Der kurzlebige, eingeschränkte Teilnehmer-JWT ist ein notwendiges Browser-Bearer-Credential, kein Provider-Geheimnis; nur im Speicher, niemals im Zuschauerlink oder dauerhaftem Browserstorage. Ein bekanntes WSS-Endpunktziel gewährt ohne gültigen Token keinen Zugang. Keine Übertragung von SP-Schlüsseln, E-Mail-Adressen, Spieler-Codes, Supabase-JWTs oder Moderationsnotizen an LiveKit.

### Konfigurierbares Schutzlimit

Neue private Serverkonfiguration: `media_enabled=false` als Ausgangszustand; `max_viewers_per_match=50` als anfänglicher Wert; separate Projekt-Concurrency-/Budgetgrenze. Änderung ohne Codeänderung nur über autorisierte Administration, später mit Audit. Keine konstante dauerhafte 50er-Grenze im Browser oder Provider-Raumschlüssel.

V1 reserviert **höchstens eine Medienverbindung je Nutzer und Match**. Foundation-Mehrfachansichten und deren Zählung bleiben unverändert. Weitere Tabs zeigen nur Status oder bieten eine ausdrückliche Übernahme an, die den alten Medienzugang zuerst widerruft. Das verhindert achtfachen Media-Verbrauch trotz einmaliger Presence-Zählung.

Atomare Match-/Nutzer-Reservierung zählt pending, connected und noch nicht bestätigte revoking-Sitzungen. Verbindungsabbrüche und parallele Beitritte dürfen Limits nicht überbuchen. Provider-Concurrency zählt auch beide Publisher sowie andere Matches und temporären Reconnect-Spielraum; 50 Zuschauer sind 52 Verbindungen, nicht 50. Veraltete Webhooks dürfen keinen Slot wiederbeleben.

## 6. Widerruf, Reconnect und Session-Lifecycle

### Wesentliche Sicherheitsgrenze

**Ein kurzer JWT-Ablauf beendet eine bestehende LiveKit-Verbindung nicht.** Tokenlaufzeit betrifft insbesondere Erstbeitritt; SDK-Reconnect und erneuerte Tokens sind separat zu berücksichtigen. LiveKit Cloud bietet expliziten Teilnehmer-/Tokenwiderruf. Der dokumentierte Standard-Cutoff enthält einen Ein-Minuten-Puffer und ist deshalb nicht ungeprüft für DUELVANTA zu übernehmen. [4,5]

Vorgabe ist `RemoveParticipant` mit explizitem `revoke_token_ts` und persistierter Session-/Raumepoche. Der Cutoff muss alle bis zur Sperre ausgegebenen Tokens einschließlich Same-Second-/Clock-Skew-Fällen abdecken und im dokumentierten zulässigen Zeitfenster liegen. Auch noch nicht verbundene, bereits reservierte Identitäten müssen widerrufbar sein. Nur `DeleteRoom`, eine abgelaufene Browseranzeige oder ein pauschal behaupteter 60-Sekunden-Token reicht nicht.

### Geplanter Ablauf

1. Vor Tokenausgabe atomare Admission mit unveränderlicher Identität/Epoche und erfasstem Ausgabestand; nach asynchronen Schritten erneute Generation-/Lease-Prüfung. Ein nach Widerruf fertig werdender Join darf keine unregistrierte Restverbindung erzeugen.
2. Foundation-Rotation/Widerruf, Presence-/Session-Löschung, Eligibility-Verlust, Freigaberücknahme und Matchende erzeugen serverseitig eine dauerhafte Sperr-/Outbox-Information. Neue additive Trigger dürfen dafür die vorhandenen Foundation-RPC-Definitionen unverändert lassen. Keine Netzwerkanfragen innerhalb kritischer Matchtransaktionen.
3. Reconciler prüft aktive Sitzungen gebündelt gegen die aktuellen DB-Rechte. Zielintervall fünf Sekunden bei aktiven Medien. Provider-Aufrufe nur für tatsächliche Änderungen, nicht für jeden Zuschauer bei jedem Heartbeat.
4. LiveKit-Webhook-Signaturen, doppelte Events, verspätete Events und fehlende Events werden behandelt; periodische Reconciliation bleibt die Rückfallebene. Die Foundation-Presence bleibt maßgeblich, nicht der Provider-Status allein.
5. Normaler Leave schließt Playback/Verbindung sofort lokal und löst serverseitigen Widerruf aus. Abrupter Tabverlust wird spätestens nach Foundation-Lease plus überprüfter Worker-Verzögerung bereinigt. Ein neuer Vollbeitritt erfordert erneut den Broker und aktuelle Foundation-Rechte; alte widerrufene Identitäten/Epochen werden nicht wiederverwendet.

Bei privater Linkrotation wird zuerst die Medienzufuhr der **zwei alten SFU-Publisher** unterbunden und deren alte Publish-Tokens widerrufen. Dann werden Zuschauer bereinigt. Die neue Generation verwendet einen neuen opaken Raum; nur neu autorisierte Grants dürfen dorthin. Dadurch müssen nicht 1.000 einzelne API-Antworten eintreffen, bevor keine neuen Matchbilder mehr im alten Raum entstehen. Das bestehende P2P ist davon unabhängig.

### Last und Ausfallverhalten

LiveKit dokumentiert 1.000 Server-API-Requests pro Minute; Join-/SDK-Verbindungen sind davon zu unterscheiden. Pro-Viewer-Polling des Providers wäre bei 1.000 Zuschauern und 20 Sekunden Takt bereits unpassend. Bulk-Widerruf braucht priorisierten Publisher-Stopp, Batching/Backoff und kontrollierte Outbox-Drainage. [2]

Zielwerte bei gesunder Steuerung: kein neues Matchmedium für widerrufene Nutzer innerhalb von zehn Sekunden; verwaiste Sitzungen nach spätestens 75 Sekunden Foundation-Lease plus zehn Sekunden Reconciliation. Dies sind **zu prüfende Acceptance-Ziele, keine gemessenen Garantien**. Bereits ausgelieferte oder gepufferte Frames lassen sich nicht zurückholen.

Bei Steuerungsfehlern werden neue Media-Beitritte geschlossen abgewiesen. Publisher benötigen zusätzlich eine kurze Health-/Freigabeleistung des Brokers und beenden bei deren Verlust ausschließlich den SFU-Pfad. Ein normaler Zuschauerclient beendet Playback ebenfalls bei fehlender Foundation-Bestätigung. Gegen manipulierte Zuschauer reicht dieser Clientstopp allein nicht aus.

**OPEN:** Ein harter Entzugsnachweis bei gleichzeitigem Worker-Ausfall oder Provider-Control-Plane-Ausfall liegt nicht vor. Die tatsächlichen Cutoff-/Reconnect-Semantiken, Parallel-Join-Races und das sichere Verhalten bei API-429/Timeout müssen für den konkret gewählten Cloud-Projekt-/SDK-Stand bestätigt werden. Die bloße Existenz eines Cronjobs ist dafür kein Nachweis. Dieser sicherheitskritische Punkt darf nicht durch behauptete Token-Expiry-Garantien geschlossen werden.

## 7. Spielerbandbreite, CPU und Track-Eigentum

Für S Zuschauer gilt im gewählten Modell:

`Upload je Spieler ≈ vorhandener P2P-Upload + ein SFU-Publish`, unabhängig von S.

SFU-Downstream und Providerkosten steigen mit S; nicht die Zahl vollständiger Uploads vom Spieler. Der Cloud-Verteiler ersetzt keine vorhandene P2P-Verbindung.

Planung für den SFU-Zusatz: eine H.264-Videolage, Ziel bis 720p/15 fps mit etwa 1,0 Mbit/s Video plus 0,032 Mbit/s Opus-Audio je Spieler. Mit 20 Prozent rechnerischem Transport-/Schwankungspuffer etwa **1,2384 Mbit/s zusätzlicher Upload pro Spieler**, nicht pro Zuschauer. Das sind Test-/Budgetannahmen; Kartenlesbarkeit, reale Bitrate und Netzschwankungen müssen gemessen werden. Anfangs kein verpflichtendes Mehrlagen-Simulcast, AV1, Transcoding oder Kompositvideo.

Eine gemeinsam verwendete Capture-Quelle bedeutet nicht kostenlose zusätzliche Kodierung. Der Browser kann für die zweite WebRTC-Verbindung einen zusätzlichen Encoder betreiben. CPU, thermische Drosselung und Akkuverbrauch müssen auf iPhone geprüft werden. Bei Ressourcenmangel wird der SFU-Zusatz reduziert/gestoppt, nicht die Qualität oder Zustandsmaschine des laufenden Spieler-P2P verändert.

**Eigentum an Originaltracks bleibt beim vorhandenen BATTLE-Code.** Kein zweites `getUserMedia`, kein `captureStream`-/Canvas-Umweg, kein `applyConstraints` auf der gemeinsamen Quelle und kein SDK-getriebener Kameraneustart. Die zusätzliche Veröffentlichung verwendet explizit nutzerbereitgestellte Originaltracks. Dadurch folgt Audio-Mute derselben `enabled`-Einstellung; Kamera-Stopp beendet auch die Zuschauerquelle.

LiveKit bietet hierfür `stopLocalTrackOnUnpublish=false`, `unpublishTrack(track,false)` und `room.disconnect(false)`. Die jeweils standardmäßig stoppenden Pfade müssen vermieden werden. Auch unerwarteter SDK-Disconnect, Track-Unpublish und automatische Recovery sind gegen das konkret gepinnte SDK zu prüfen; diese Optionen allein sind kein Regressionstest. Der SFU-Adapter darf Originaltracks nie selbst stoppen oder deren Mute-Zustand verändern. [8–11]

## 8. NAT, Firewall, Reconnect und iPhone/Safari

Die SFU-Verbindung verwendet ihre eigene LiveKit-ICE-/TURN-Konfiguration. WSS/HTTPS läuft über TCP 443; Cloud dokumentiert UDP-Medienpfade sowie ICE/TCP und TURN/TLS auf 443 als Ausweichwege. TURN/UDP ist ebenfalls dokumentiert. Die genauen Domain-/Port-Allowlisten kommen aus der aktuellen Providerdokumentation; ein privater statischer TURN-Schlüssel gehört nicht in den Client. Eine Firewall-Kompatibilitätsgarantie für jedes Netz wird nicht gegeben. [7]

Der bestehende Spieler-STUN-Pfad wird nicht mit SFU-Konfiguration überschrieben. Ein funktionierender Zuschauer-TURN-Test beweist auch nicht nachträglich TURN-Unterstützung des alten P2P.

Safari/iOS wird vom LiveKit-Web-SDK unterstützt; die konkrete Kombination mit zwei gleichzeitigen Publish-Verbindungen muss trotzdem praktisch geprüft werden. [8] Vorgesehen: H.264/Opus, `playsinline`, lokales Preview stumm, Nutzeraktion zum Entsperren von Zuschauer-Audio, zwei klar zugeordnete Videoflächen, kein Kamera-/Mikrofonprompt beim Zuschauer. Browser-Autoplay-Sperren erhalten einen sichtbaren Ton-Startknopf, keinen automatischen Capture-Workaround.

Abnahme benötigt echtes iPhone/Safari als Host und Gast, Kamera mehrfach aus/an, Mute/Unmute, Wechsel WLAN/Mobilfunk, kurzzeitige Unterbrechung, Hintergrund-/Vordergrundwechsel, normale Beendigung und sauberes erneutes Autorisieren. Bei Netzwechsel darf SFU-Reconnect keine Widerrufssperre umgehen. Ein pausiertes Hintergrundvideo ist ehrlich als unterbrochen darzustellen. Chromium-, WebKit-Emulations- und Mocktests ersetzen diese Geräteabnahme nicht. **Heute NOT RUN.**

## 9. Datenschutz und Safety

Neue Datenflüsse sind Livevideo/-audio, Verbindungsmetadaten/IP-Adressen und pseudonyme Raum-/Teilnehmerkennungen zu einem zusätzlichen Auftragsverarbeiter. Transportverschlüsselung ist nicht gleich Ende-zu-Ende-Verschlüsselung. Dieser V1-Entwurf führt keine E2EE-Schlüsselverteilung ein und darf daher nicht als gegen den SFU-Betreiber vollständig abgeschirmte Kommunikation beworben werden.

Gewähltes Konfigurationsziel: getrenntes LiveKit-Stagingprojekt, EU-Projektdatenregion soweit für das konkrete Projekt bestätigt, keine Inference-/Agent-/Recording-/Egress-Funktionen und minimierte pseudonyme Metadaten. Vertrag/DPA, Unterauftragsverarbeiter, tatsächliche Datenregion, verbleibende internationale Datenflüsse und Retention sind vor Übertragung echter Nutzermedien zu dokumentieren. Ein angebotener Standard-DPA beweist nicht, dass er für dieses konkrete Projekt abgeschlossen/geprüft wurde. [12]

EU-Projektdatenregion und EU-Pinning der Medienpfade sind unterschiedliche Eigenschaften. LiveKit nennt Region-Pinning für Scale und höher; dies wird nicht ungefragt bestellt. Aus diesem Dokument folgt weder die Behauptung, ein günstigerer Plan sei automatisch datenschutzwidrig, noch eine pauschale Pflicht zum 500-Dollar-Tarif. Welche Beschränkung für DUELVANTA verbindlich benötigt wird, ist Teil des offenen Provider-/Datenschutz-Gates. [1,12]

Beide Spieler müssen den neuen Zuschauerumfang vor dem ersten SFU-Senden erkennen und für das Match freigeben können; die Ablehnung darf den bisherigen P2P-Pfad nicht deaktivieren. Sichtbarer Übertragungsstatus und einfache Rücknahme sind erforderlich. Bei Minderjährigen, Hintergrundpersonen und privaten Räumen ist keine stillschweigende Veröffentlichung aus der alten Arena-Code-Zustimmung abzuleiten.

Keine dauerhafte Webcam-Aufzeichnung, keine Audioaufzeichnung, keine Transkription, keine Egress-/Replay-Speicherung und keine KI-Medienanalyse in Media V1. Das bedeutet nicht, dass der Provider keinerlei Betriebsmetadaten aufbewahrt; diese sind separat zu prüfen. Autorisierte Zuschauer können technisch externe Aufnahmen erstellen – ein vollständiger Kopierschutz wird nicht behauptet.

Moderations-/Safety-Sperren müssen auch die Media-Leases erfassen. Zuschauer erhalten keine Moderationsrechte und keinen verdeckten Judge-Beitritt. Eine spätere Zuschauer-Meldefunktion darf nicht durch Freigabe privilegierter Spieler-RPCs realisiert werden. Für V1 bleiben vorhandene Safety-Regeln und die Möglichkeit der Spieler, die Zuschauerübertragung abzuschalten, erhalten; ungeklärte zusätzliche Safety-Anforderungen sind vor Freigabe zu entscheiden.

## 10. Kostenmodell und Providergrenzen

Öffentliche Tarifwerte wurden am 18.09.2026 geprüft; USD, ohne Steuern/Wechselkurs, keine Bestellung. Projektspezifische Restkontingente sind nicht verifiziert. [1,2]

| Tarif | Monatlicher Sockel | Teilnehmerminuten inklusive / Mehrverbrauch | Downstream inklusive / Mehrverbrauch | Gleichzeitige Verbindungen |
| --- | ---: | --- | --- | ---: |
| Build | 0 USD | 5.000 / kein regulärer Mehrverbrauch | 50 GB / hartes Freikontingent | 100 |
| Ship | ab 50 USD | 150.000 / 0,0005 USD pro Minute | 250 GB / 0,12 USD pro GB | 1.000 |
| Scale | ab 500 USD | 1.500.000 / 0,0004 USD pro Minute | 3 TB / 0,10 USD pro GB | 5.000 |

Für die Planung werden GB dezimal und 3 TB als 3.000 GB gerechnet. Rechnungsrundung und tatsächliche Messung können abweichen. Annahme: S Zuschauer empfangen beide Streams während einer vollständigen Stunde; zwei Publisher verbunden; 1,032 Mbit/s je Stream plus 20 Prozent Puffer. Kein Simulcast, kein Aufzeichnen/Exportieren.

`Teilnehmerminuten je Stunde = 60 × (S + 2)`

`Downstream-GB je Stunde = S × 2 × 1,032 × 1,20 × 3.600 / 8.000 = S × 1,11456`

| Zuschauer S | Cloud-Verbindungen | Teilnehmerminuten/Stunde | Geplanter Downstream/Stunde |
| ---: | ---: | ---: | ---: |
| 0 | 0 bei bedarfsgesteuertem Abschalten | 0 | 0 GB |
| 10 | 12 | 720 | 11,15 GB |
| 50 | 52 | 3.120 | 55,73 GB |
| 100 | 102 | 6.120 | 111,46 GB |
| 500 | 502 | 30.120 | 557,28 GB |
| 1.000 | 1.002 | 60.120 | 1.114,56 GB |

Rechenbeispiel: insgesamt **zehn Matchstunden pro Monat** mit jeweils konstanter Zuschauerzahl; ansonsten kein Verbrauch. Keine Monatsprognose für tatsächliche DUELVANTA-Nutzung:

| Zuschauer während dieser zehn Stunden | Ship, berechnete Monatskosten | Scale, berechnete Monatskosten |
| ---: | ---: | ---: |
| 10 | 50,00 USD | 500,00 USD |
| 50 | 86,87 USD | 500,00 USD |
| 100 | 153,75 USD | 500,00 USD |
| 500 | 764,34 USD | 757,28 USD |
| 1.000 | Standard-Concurrency reicht nicht | 1.314,56 USD |

Rechenformeln: Ship = 50 + max(0,Minuten−150.000)×0,0005 + max(0,GB−250)×0,12. Scale = 500 + max(0,Minuten−1.500.000)×0,0004 + max(0,GB−3.000)×0,10. Andere Matches und Tests verbrauchen dasselbe Kontingent. Paid-Sockel fallen auch bei geringer Nutzung an. Bei doppelter Bitrate verdoppelt sich ungefähr der Downstreamanteil, nicht automatisch die gesamte Rechnung.

**50er-Nachweis:** Ein echter 30-Minuten-Test mit 50 Zuschauern plus zwei Publishern benötigt nach diesem Modell etwa **1.560 Teilnehmerminuten und 27,864 GB**. Das liegt innerhalb vollständig verfügbarer Build-Kontingente und der 100er-Concurrency. Kosten allein rechtfertigen deshalb hier noch nicht den Verzicht auf einen echten 50er-Test. Schon eine ganze Stunde dieser Last überschreitet dagegen das angenommene 50-GB-Freikontingent. Restquota und Vor-/Nachlauf müssen vor Testbeginn reserviert werden.

Supabase-/Steuerungsaufwand kommt hinzu. Ein fünfsekündlicher, nur bei aktiven Medien laufender Reconciler erzeugt 720 Aufrufe pro aktiver Stunde, also 7.200 bei zehn Stunden. Die vorhandenen Foundation-Heartbeats werden wiederverwendet; kein zusätzlicher Provider-API-Aufruf je Zuschauer und Heartbeat. Broker-, Publisher-Health-, Webhook- und Wiederholungsaufrufe sowie DB-Last sind zusätzlich zu zählen. Öffentliche Edge-Function-Kontingente: Free 500.000, Pro 2 Millionen; darüber nennt Supabase 2 USD je Million mit Abrechnung in Paketen. Tatsächlicher Projekttarif, verbleibendes Kontingent und DB-Leistung sind noch offen. [14]

Kein Kostenansatz für ungenutzte KI-, SIP-, Agent-, Ingress-/Egress- oder Aufzeichnungsfunktionen. Vercel-Bestand, Testgeräte, Personal, eventuelle zusätzliche Hosting-Grundkosten und spätere Änderungen sind nicht als kostenlos behauptet. Keine bezahlte Integration ohne bestätigte Projektquoten, Budgetfreigabe und erneuten Tarifabgleich.

## 11. Skalierungsweg ohne neues Medienmodell

0–10 Zuschauer: derselbe Zwei-Publisher-/Receive-only-Pfad, bedarfsgesteuert; Build nur innerhalb seiner freien Grenzen.

50 Zuschauer: 52 Verbindungen, atomarer DB-Schutzwert 50, zunächst kleiner Realtest, dann reproduzierbarer 50er-Test. Das ist keine Architekturgrenze.

100–500 Zuschauer: mindestens Ship beziehungsweise ausreichende genehmigte Quoten. 100 Zuschauer benötigen bereits 102 Verbindungen und passen nicht in Build. Gleiche Publisher, gleiche Raum-/Token-/Lease-Logik, kein zusätzlicher vollständiger Spielerupload. Kontrollpfad und Foundation-Abfragen sind mitzubeobachten: 500 Zuschauer erzeugen bei 20 Sekunden Heartbeat etwa 25 Statusanfragen pro Sekunde; DB-Abfragekosten und Zählerberechnung sind nicht durch einen SFU-Tarif automatisch gelöst.

1.000+ Zuschauer: 1.000 Zuschauer plus zwei Publisher überschreiten die normale Ship-Concurrency. Scale beziehungsweise explizit erhöhte Quoten und gebündelte Steuerungsoperationen sind erforderlich. LiveKit Cloud beschreibt eine verteilte SFU und keinen festen Ein-Raum-Deckel wie beim einzelnen Self-hosted-Knoten; das ersetzt keine Prüfung der konkreten Projektgrenzen oder einen Lastnachweis. [1–3] Identitäten, Autorisierung und Spielerpublish bleiben gleich. Weitere Infrastruktur/Distribution kann später ergänzt werden, ohne die Spieler in Zuschauer-Mesh zu verwandeln.

Bei 1.000 Zuschauern sind allein Foundation-Heartbeats ungefähr 50 Requests pro Sekunde. Vor Erhöhung des serverseitigen Schutzwerts müssen DB-Latenz, Quoten, Reconnect-Bursts, Widerrufsschlange und Kosten kontrolliert werden. Ein späterer konkreter Performancebefund erlaubt gezielte Optimierung, nicht vorsorgliche Großrefaktorierung der abgeschlossenen Foundation.

## 12. Stop-Kriterien und konkrete Gate-Blocker

| V28-Kriterium | Bewertung dieses Entwurfs |
| --- | --- |
| Grundlegender Ersatz/Refaktor des Spieler-P2P nötig | NEIN im gewählten Zielweg; geschützte Originalpfade bleiben unverändert |
| Zuschauer-/Spieler-/Judge-Autorisierung nicht trennbar | Trennbarer Serverentwurf anhand vorhandener Helfer; neue Media-Durchsetzung noch nicht implementiert/abgenommen |
| Privater Link öffnet ungeschützte Medien oder Geheimnisse | Nicht vorgesehen; SP-Link und Media-Broker strikt getrennt |
| Vollständiger Spielerupload pro Zuschauer | NEIN; ein zusätzlicher SFU-Publish je Spieler |
| 100–500 benötigen ein anderes Medienmodell | NEIN; höhere Quoten/Steuerungsleistung, gleicher Datenpfad |
| 1.000+ benötigen kompletten Neuaufbau | NEIN laut ausgewähltem Cloud-Modell; konkrete Last-/Kontingentabnahme offen |
| iPhone/Safari technisch ausgeschlossen | NEIN; passende SDK-/Codec-Richtung vorhanden, echte Abnahme NOT RUN |
| Providerkosten/-grenzen nicht belastbar vor Paid-Integration | Öffentliche Preise und Modell vorhanden; reale Projektquote/Region-/Tarifbedarf noch OPEN; keine Paid-Integration |
| main/Production/gesperrte Bereiche müssten geändert werden | NEIN |
| Provider verlangt Geheimnisse im Client/Repo | NEIN im Entwurf; Server-Secret-Store erforderlich |
| Sicherheitskritischer oder datenschutzrelevanter Punkt ungeklärt | **JA – BLOCKED**, siehe B1/B2 |

### B1 – konkreter Provider-/Datenschutzumfang: BLOCKED / OPEN

Es liegt in den geprüften Nachweisen kein bestätigtes LiveKit-Stagingprojekt mit dokumentierten Projektquoten, Datenregion, einschlägigem Vertrags-/DPA-Stand und deaktivierter Aufnahme vor. Die Abwesenheit solcher Nachweise beweist nicht, dass kein Konto existiert; sie erlaubt aber keine Freigabe. Zusätzlich deckt die aktuell tatsächlich gelesene Spielererklärung die neue Zuschauer-/SFU-Verarbeitung nicht ausdrücklich ab.

Zum Schließen erforderlich: das konkrete getrennte Providerprojekt und seine kostenlosen beziehungsweise ausdrücklich freigegebenen Grenzen verifizieren; Auftragsverarbeitung/Unterauftragsverarbeiter/Region/Retention für diesen Datenfluss klären; die neue sichtbare per-Match-Medienfreigabe beider Spieler und den dazu passenden Datenschutzhinweis verbindlich festlegen. Keine Vertragsunterzeichnung, Zahlung, Kontoanlage oder Übertragung echter Medien aus diesem Dokument ableiten. Kein pauschales neues Rechtsgutachten oder Scale-Abo wird als automatisch notwendig behauptet.

### B2 – kontrollierter Media-Entzug über Systemgrenzen: BLOCKED / OPEN

Die Foundation löscht Rechte zuverlässig in der DB; ein neu hinzukommender Cloud-Medienpfad hat jedoch eigene laufende Sitzungen und erneuerte Tokens. Ein unabhängig vom Zuschauerclient wirksamer Entzug bei verspätetem Join, Linkrotation, API-Limit und Worker-/Control-Plane-Ausfall ist für DUELVANTA noch nicht belegt. Default-Token-Expiry oder ungeprüfter Standard-Remove reichen nach Providerdokumentation nicht.

Vor Gateöffnung sind insbesondere expliziter Cutoff einschließlich Zeitgrenzen, Sperre noch nicht verbundener Tokens, Publisher-Stopp bei Generationswechsel und das Verhalten bei fehlender Provider-Antwort verbindlich zu spezifizieren beziehungsweise mit Provider-Nachweis zu bestätigen. Ein isolierter synthetischer Vertrags-/Fehlertest darf nicht als reale Media-Abnahme bezeichnet werden. Bleibt eine sicherheitsrelevante Entzugslücke offen, bleibt auch das Gate geschlossen; keine alternative Architektur implementieren.

Diese Blocker sind **neue Integrationsvoraussetzungen**, keine Wiedereröffnung oder Abwertung der bereits abgenommenen Foundation. Fehlende spätere Last-/Gerätetests allein werden nicht als Beweis technischer Unmöglichkeit ausgegeben. Aktuell greift aber ausdrücklich V28s Stop-Regel für ungeklärte Datenschutz-/Sicherheitsfragen.

## 13. Geschützte Dateien, Funktionen und Umgebungen

Ausgangs-Blob-Fingerprints:

| Datei | Unveränderter Git-Blob am Ausgangshead |
| --- | --- |
| `battle.js` | `4f465a801dd5561fa4adae2cc860823bc27ffa3d` |
| `battle-webrtc.js` | `5d97ae8e195264c6c14c18a33c4cbc5545533c14` |
| `site-nav.js` | `5981600bd10d8efdd633b2f5e5b2cb9573292ece` |
| `battle-safety.js` | `1bfb8323614d732196d65a330465b0d9f3f70bc1` |
| `battle.html` | `2ea0f74d9bb2f643d43e56e46d56e0a705d78e45` |
| `battle-spectator.js` | `ce8e448dcc5f080540ca67202c289ed132c294a7` |
| `battle-spectator-host.js` | `f152385d054178f0a3ff398d456330d89597d305` |

In diesem Arbeitsschritt bleiben **alle** diese Dateien unverändert. Nach Gateöffnung sind nur ausdrücklich additive Media-Einstiege in den HTML-/Spectator-Dateien zulässig; Änderungen müssen separat diff-/testbelegt werden. Die Kernblobs `battle.js`, `battle-webrtc.js` und `site-nav.js` bleiben Schutzinvarianten.

Insbesondere geschützt: P2P `makePeer`, `handleSignal`, `subscribeSignals`, `maybeOffer`, `startMedia`, `stopMedia`, `toggleMic`, `shutdownPeer`, `resetMediaUi`; Spieler-Ready/Start/Leave/Result; Ranked-, Private-Invitation- und Judge-/Moderationsfunktionen; bestehende `battle_signals`-Policies. Keine neue Zuschauer-SELECT-Policy auf Match-/Signaltabellen.

Die vorhandene Foundation-Migration wird nicht umgeschrieben oder blind erneut angewandt. Zukünftige additive SQL-Änderungen erhalten eigene Migration, PostgreSQL-/Auth-/Concurrency-Regressionsnachweise und ausdrücklichen Staging-Zielcheck.

`api/compliance-message-dispatch.js`, TRADE-/Swap-/Paymentpfade, `v-logo.svg` und Slogan **COLLECT. TRADE. BATTLE.** bleiben unberührt. Ausschließlich Entwicklungsbranch; kein Merge von PR #5, kein Production-Deployment, keine Production-Supabase-Abfrage/-Änderung, kein Stripe Live und keine echten Payments/Refunds/Payouts.

## 14. Media-V1-Acceptance – noch nicht abgenommen

**Alle nachstehenden Media-Prüfungen sind NOT RUN / OPEN. Die grüne Ausgangs-CI ist kein Ersatz für sie.**

| ID | Erforderlicher Nachweis |
| --- | --- |
| M01 | Autorisierter Zuschauer empfängt die freigegebenen Video-/Audiotracks beider Spieler, richtige Zuordnung, keine doppelten Audiospuren |
| M02 | Zuschauer fordert nie Kamera/Mikrofon/Screen an und kann auch manipuliert keine Tracks, Daten oder Medien-RPCs veröffentlichen |
| M03 | Keine Ready-/Start-/Ergebnis-/Spieler-/Moderationsrechte; `host_id` und `guest_id` bleiben unverändert; Judge-Rolle kein Media-Bypass |
| M04 | Öffentlich: echter BATTLE-/Foundation-Zugang, gültige Auth-Sitzung und exakte Presence zwingend; direkte Broker-/SDK-Aufrufe ohne diese werden abgewiesen |
| M05 | Privat: aktuelle eigene Grant-/Linkgeneration; Spieler-Code/SP-Link getrennt; kein Token/Provider-Secret im Link oder öffentlichen Artefakt |
| M06 | Rotation/Widerruf beendet neue Media-Zufuhr kontrolliert, verwirft alte Tokens und verhindert verspäteten Join/Reconnect; normaler und fehlerhafter Control-Plane-Pfad geprüft |
| M07 | Leave, Logout, Sessionentzug, Sperre, Verarbeitungssperre, Matchende, Pause und Freigaberücknahme schließen Media-Rechte; keine verwaisten Publish-/Viewer-Sitzungen |
| M08 | Reconnect bei kurzer Unterbrechung funktioniert nur mit weiterhin gültigen Rechten; Match-/Tab-/Generationswechsel erzeugen keine alten Restansichten |
| M09 | 1, 10 und 50 Zuschauer: Spieler-Peer-/Senderzahl und `getStats` zeigen keinen linearen Vollstream-Upload; P2P bleibt funktional |
| M10 | Serverlimit 50 atomar unter parallelem Join; Änderung des Werts ohne Code; Projektquote inklusive Publisher/anderen Matches; Mehrfach-Tab-/Takeover-Test |
| M11 | Reproduzierbarer echter 50er-Lasttest; alternativ nur nach belegter unverhältnismäßiger Providerkostensituation kleine reale Last plus belastbare Protokoll-/Providergrenzen – nicht bloß Architekturbehauptung |
| M12 | 100–500 behalten dasselbe Medienmodell; DB-, API-, Egress- und Concurrencygrenzen mitgeprüft; dokumentierter 1.000+-Pfad bleibt erhalten |
| M13 | Echtes iPhone/Safari als Spieler und Zuschauer geeignet praktisch geprüft; CPU/Hitze/Bitrate, Kamera-Neustart, Mute, Autoplay und Netzwechsel dokumentiert |
| M14 | Track-Eigentum: normaler/unerwarteter SFU-Disconnect und Widerruf stoppen oder verändern niemals die P2P-Originaltracks |
| M15 | Relevante PostgreSQL-/Auth-/Foundation-/Browser-/WebRTC-Regressionssuites und vollständige relevante CI grün; keine Mocks als angemeldete E2E-Abnahme ausgeben |
| M16 | Exaktes Preview-Deployment und ausschließlich Staging nach Änderung retesten; tatsächliche Geräte-/Provider-Nachweise getrennt von CI dokumentieren |
| M17 | Keine Aufzeichnung/Transkription/Egress; Projekt-/Datenschutzkonfiguration und minimale Metadaten überprüft; keine Secrets in Client, Logs, Repo oder Screenshots |
| M18 | main, Production, Production-Supabase, PR-Draft/Unmerged, TRADE-Freeze, Logo und Slogan unverändert |

## 15. Nächste zulässige Schritte und Abschluss dieses Blocks

Zuerst B1 und B2 anhand konkreter Nachweise schließen und dieses Dokument explizit auf ein freigegebenes Implementierungs-Gate aktualisieren. Bis dahin keine Media-Runtime, Migration, SDK-Einbindung oder Provider-Aktivierung vorziehen.

Erst danach: minimaler serverseitiger Admission-/Lease-/Widerrufspfad mit isolierten Tests; Publisher-/Viewer-Adapter hinter serverseitig standardmäßig deaktiviertem Feature-Schalter; relevante Regressionen; vollständige CI; kontrollierte Staging-Migration; kleiner echter Provider-/Gerätetest; 50er-Abnahme und Preview-Retest. Bei Befund: reproduzieren → Ursache isolieren → minimal beheben → Regression → vollständige relevante CI → Preview/Staging-Retest. Keine Großrefaktorierung.

**Ergebnis dieses Arbeitsschritts: konkrete Architektur und Kosten-/Skalierungsplanung dokumentiert; Gate BLOCKED / OPEN; nur diese Architekturdatei wird neu hinzugefügt. Spectator Media V1 ist nicht implementiert und nicht abgenommen.** Der Nachher-Check muss bestätigen, dass der Commit gegenüber `62d655c…` ausschließlich diese Dokumentation ändert. Nachfolgende automatische CI-/Preview-Ergebnisse gehören zum tatsächlichen neuen Dokumentations-Head, nicht rückwirkend zu einem erfundenen Media-Checkpoint.

## 16. Primärquellen

Öffentliche technische Quellen am 18.09.2026 geprüft. Tarif-/API-Angaben vor Aktivierung erneut prüfen. Zahlenbeispiele und Architekturvorgaben in diesem Dokument sind eigene Planungen, keine Leistungszusage des Providers.

[1] LiveKit Preise: https://livekit.com/pricing

[2] LiveKit Quoten und Limits: https://docs.livekit.io/deploy/admin/quotas-and-limits/

[3] LiveKit Cloud / verteiltes Medienmodell: https://docs.livekit.io/intro/cloud/

[4] LiveKit Tokens und Grants, Ablauf/Refresh/Widerruf: https://docs.livekit.io/frontends/reference/tokens-grants/

[5] LiveKit Room-Service-API, insbesondere RemoveParticipant und revoke_token_ts: https://docs.livekit.io/reference/other/roomservice-api/ ; Teilnehmerverwaltung: https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/

[6] LiveKit Regionen/Pinning: https://docs.livekit.io/deploy/admin/regions/region-pinning/

[7] LiveKit Firewall: https://docs.livekit.io/deploy/admin/firewall/

[8] LiveKit Browser-SDK: https://docs.livekit.io/reference/client-sdk-js/ ; nutzerbereitgestellte Videotracks: https://docs.livekit.io/reference/client-sdk-js/classes/LocalVideoTrack.html

[9] LiveKit Unpublish-Optionen: https://docs.livekit.io/reference/client-sdk-js/classes/LocalParticipant.html

[10] LiveKit Room.disconnect: https://docs.livekit.io/reference/client-sdk-js/classes/Room.html

[11] LiveKit Track-Eigentum/RoomOptions: https://docs.livekit.io/reference/client-sdk-js/interfaces/RoomOptions.html

[12] LiveKit DPA: https://livekit.com/legal/data-processing-addendum ; Datenresidenz: https://docs.livekit.io/deploy/admin/regions/data-residency/

[13] Supabase Scheduler/Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions ; https://supabase.com/docs/guides/cron/quickstart

[14] Supabase Edge-Function-Abrechnung: https://supabase.com/docs/guides/functions/pricing ; https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations
