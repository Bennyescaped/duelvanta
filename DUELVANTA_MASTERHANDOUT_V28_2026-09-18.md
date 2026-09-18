# DUELVANTA – Masterhandout V28

Stand: 18.09.2026  
Status: **VERBINDLICHER GESAMT-CHECKPOINT / SPECTATOR FOUNDATION V1 PRAKTISCH PASS / SPECTATOR MEDIA V1 NÄCHSTER BLOCK**

V28 baut auf `DUELVANTA_MASTERHANDOUT_V27_2026-09-18.md` auf. V27 bleibt für alle dort dokumentierten COLLECT-, TRADE-, Legal-, Tax-, Release- und BATTLE-Kernstände verbindlich, soweit dieses Dokument nichts ausdrücklich aktualisiert.

Zusätzlich zwingende Detailgrundlage:
- `DUELVANTA_BATTLE_SPECTATOR_FOUNDATION_V1_2026-09-18.md`

## 1. Aktueller Repository- und Release-Stand

Repository: `Bennyescaped/duelvanta`  
Entwicklungsbranch: `marketplace-ux-v1`

Abgeschlossene Spectator-Foundation:
- technischer Head: `7ee367213eb0c92838162d1a5b82dc5757eca93e`
- finaler Spectator-Foundation-Branch-/Dokumentations-Head: `4a4b5f6ddcd29a7244c22d4d8450be71527c2e59`
- Battle WebRTC Check #39: SUCCESS
- Scanner V16 Check #563: SUCCESS
- finales Preview: `dpl_2ZgkATJYyWyngTMWFyHGQvvRMUqW` – READY

Production-`main` bleibt:
`50f88213571be13255bb52eb489cc28cca660001`

PR #5 bleibt offen, Draft und unmerged. Produktion und Production-Supabase `enifiaqsnqtbzylnfrpi` bleiben unverändert. TRADE bleibt eingefroren. Tausch bleibt deaktiviert. Stripe Live, echte Payments, Refunds und Payouts bleiben unberührt. `v-logo.svg` bleibt unverändert. Slogan: **COLLECT. TRADE. BATTLE.**

## 2. BATTLE Spectator Foundation V1 – abgeschlossen

Praktisch vollständig bestätigt:
- öffentlicher und privater Zuschauerpfad funktionieren;
- Zuschauer bleiben read-only und belegen weder `host_id` noch `guest_id`;
- Presence-Deduplizierung und normales Verlassen funktionieren;
- private Spectator-Link-Rotation und Widerruf funktionieren;
- Spieler-Einladungscode und separater Zuschauerlink bleiben strikt getrennt;
- Zuschauer erhalten keine Ready-, Start-, Ergebnis- oder Moderationsrechte;
- Zuschauer senden in Foundation V1 weder Kamera noch Mikrofon;
- bestehender Zwei-Spieler-P2P-WebRTC-Pfad bleibt geschützt.

Einziger UX-Befund der praktischen Abschlussabnahme: Ein Spieler-Code im Zuschauerformular benötigte eine sichtbare Inline-Ablehnung. Minimal behoben und geprüft.

Der Zwei-Spieler-WebRTC-Pfad wurde mangels zweiter Kamera nicht unnötig nochmals praktisch wiederholt. Die vorherige reale Zwei-Geräte-Abnahme und die vollständigen Regressionen bleiben grün.

Foundation V1 nicht ohne neuen reproduzierbaren Befund erneut öffnen.

## 3. Nächster Entwicklungsblock: Spectator Media V1

Spectator Media V1 beziehungsweise eine SFU-Entscheidung wurde noch nicht begonnen.

Ziel: Zuschauer erhalten künftig freigegebene Matchmedien, bleiben aber vollständig read-only. Sie senden niemals Kamera oder Mikrofon und erhalten keine Spieler-/Moderationsrechte.

Vor Implementierung muss der tatsächliche aktuelle WebRTC-/Repository-/Staging-Stand analysiert und eine belastbare Medienarchitekturentscheidung getroffen werden. Der bestehende Zwei-Spieler-P2P-Pfad ist produktkritisch und darf nicht vorschnell ersetzt oder groß refaktoriert werden.

## 4. Verbindlicher Zuschauerumfang und Skalierungsziel

Die Architektur darf **nicht** auf die heutige kleine Beta begrenzt werden.

Planungswerte:
- typischer früher Beta-Betrieb: etwa 0–10 gleichzeitige Zuschauer pro Match;
- Spectator Media V1 soll mindestens **50 gleichzeitige Zuschauer pro Match** als erste relevante Laststufe technisch sinnvoll unterstützen;
- ein anfängliches Schutzlimit darf bei **50 Zuschauern pro Match** liegen, muss aber **serverseitig konfigurierbar und ohne Codeänderung erhöhbar** sein;
- nächste Wachstumsstufe: **100–500 gleichzeitige Zuschauer pro Match**, ohne Änderung des grundlegenden Medienmodells;
- langfristiges Zielbild: **1.000+ gleichzeitige Zuschauer eines einzelnen Matches** müssen architektonisch möglich sein; zusätzliche Infrastruktur/Distribution darf dafür später ergänzt werden.

Das 50-Zuschauer-Limit ist ausschließlich ein mögliches Beta-Schutzlimit, **kein dauerhaftes Produktlimit und keine Architekturgrenze**.

Zentrale technische Vorgabe:
**Die Uploadlast eines Spielers darf nicht linear mit der Zuschauerzahl wachsen.**

Insbesondere dürfen mobile Spieler und iPhone/Safari nicht für jeden Zuschauer einen zusätzlichen vollständigen Videoupload aufbauen müssen.

Damit ist ein klassisches Zuschauer-P2P-/Mesh-Modell, bei dem Host und Gast separat zu jedem Zuschauer streamen, **nicht als langfristige Zielarchitektur akzeptabel**.

Die erste Spectator-Media-Implementierung darf kostenbewusst und klein starten. Das gewählte Medienmodell muss jedoch Wachstum auf 100–500 und grundsätzlich 1.000+ Zuschauer ermöglichen, ohne später den Spieler-/Spectator-Medienpfad vollständig neu entwerfen zu müssen.

## 5. Architekturentscheidung vor Media-Code

Vor jeder Spectator-Media-Implementierung prüfen:
- Schutz des bestehenden Host↔Gast-P2P-Pfads;
- separate skalierbare Zuschauer-Medienschicht;
- SFU-Notwendigkeit und konkreter Integrationsweg;
- Bandbreite/CPU auf Spielergeräten;
- iPhone/Safari;
- TURN/STUN, NAT und Firewall;
- Reconnect und Session-Lifecycle;
- Autorisierung auf Basis der bestehenden Spectator Foundation;
- private Zuschauerlinks dürfen niemals ungeschützte Media-Endpunkte freigeben;
- Kosten für frühe Beta sowie 50, 100–500 und 1.000+ Zuschauer;
- Datenschutz, Safety und Moderation;
- Skalierung ohne späteren Komplettumbau.

Nicht bloß Anbieter auflisten. Eine konkrete, begründete DUELVANTA-Architekturentscheidung treffen.

## 6. Weiterhin verbindliche Grenzen

- ausschließlich `marketplace-ux-v1`;
- `main` nicht verändern;
- PR #5 nicht mergen;
- Production und Production-Supabase nicht verändern;
- bestehende Spectator-Migration nicht blind erneut anwenden;
- TRADE bleibt eingefroren;
- Tausch nicht reaktivieren;
- Stripe Live nicht aktivieren;
- keine echten Payments/Refunds/Payouts;
- `v-logo.svg` nicht verändern;
- Slogan bleibt `COLLECT. TRADE. BATTLE.`;
- geschlossene Foundation-/Ranked-/Invitation-/Camera-Abnahmen nur bei neuem reproduzierbarem Befund wieder öffnen;
- bei Befund: reproduzieren → minimal beheben → Regression → relevante vollständige CI → Preview/Staging-Retest.

## 7. Nächster Arbeitsauftrag

Zuerst V27 und das Spectator-Foundation-Abschlussdokument vollständig lesen und tatsächlichen Branch-/CI-/Preview-/Staging-Stand gegenprüfen.

Danach einen kompakten Architekturentscheid für Spectator Media V1 erstellen, der die oben festgelegten Skalierungswerte berücksichtigt. Erst anschließend minimal implementieren.

Kein unnötiger Umbau bereits funktionierender BATTLE-Komponenten.
