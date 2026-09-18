# DUELVANTA – BATTLE Private Invitations Acceptance

Stand: 18.09.2026
Basis: Masterhandout V27 plus Post-V27 Async-State und Zuschauer-Scope.
Status: **Privater Spieler-Einladungspfad abgenommen; ein während der Abnahme gefundener Host-Abbruch-Lifecycle-Befund behoben und retestet.**

## Praktische Staging-Abnahme

Preview-Ausgangspunkt: `duelvantav5vision-37l4rdiy8-bennyescaped-3783.vercel.app`.
Testnutzer: `test-verkaeufer@duelvanta.de` (Host) und `test-kaeufer@duelvanta.de` (Gast).
Testmatch: privates Pokémon Casual Match, Einladungscode `B49F27`.

Praktisch bestätigt:
- Host startet aus normaler BATTLE-Lobby ohne altes Resume-Match.
- Privates Casual-Match kann erstellt werden; Einladungscode wird erzeugt.
- Private Arena startet ohne automatischen Kamera-/Mikrofonstart.
- Falscher Code wird mit `Match nicht gefunden` abgewiesen.
- Gültiger Code führt den Gast korrekt in die Arena; Host/Gast-Zuordnung stimmt.
- Private Matches erscheinen nicht in der öffentlichen Lobby.
- Gast kann vor Matchstart verlassen; Host bleibt im Waiting-Match, Gastplatz und Ready-Zustand werden zurückgesetzt.
- Derselbe gültige Code kann danach erneut benutzt werden; Gast wird erneut korrekt zugeordnet.
- Kamera blieb in diesem Einladungsblock absichtlich aus; die bereits bestandene Zwei-Geräte-WebRTC-Kernabnahme wurde nicht wiederholt.

## Automatisierte Join-Grenzen

Commit `98c544ae032907f21803b9d59960db276b5e7c08` ergänzt `tests/battle-private-join-contract-test.mjs` und bindet die Regression in Battle WebRTC Check ein.

Abgedeckt:
- bereits besetztes privates Match weist einen dritten Spieler ab;
- nur der erste konkurrierende Join erhält den Gastplatz;
- beendetes privates Match ist nicht beitretbar;
- falscher Einladungscode bleibt abgewiesen.

Für diesen Checkpoint: Battle WebRTC Check #14 SUCCESS und Scanner V16 Check #538 SUCCESS. Keine echte dritte Auth-Testperson wurde für diesen Teil erzeugt.

## Gefundener und geschlossener Befund: Host beendet Waiting-Match

Reproduktion:
Nach Wiedereintritt des Gasts verließ der Host das noch nicht gestartete private Match. Serverseitig wurde das Match korrekt `cancelled`, der Gast-Client blieb jedoch in der alten Arena und zeigte den ehemaligen Host weiter als Gegner.

Rot-Nachweis:
Die neue Async-State-Regression reproduzierte den unveränderten Clientzustand mit 14/15 PASS; ausschließlich `Cancelled match returns the remaining guest to lobby` schlug fehl.

Minimaler Fix:
`refreshMatch()` behandelt einen weiterhin zum aktiven Match gehörenden `cancelled`-Status jetzt als Arena-Ende. Die Ansicht wird invalidiert, der Gast erhält `Der Host hat das Match beendet.`, anschließend wird die Lobby geladen. Keine Änderung an RPC/SQL, WebRTC, Safety, Moderation oder TRADE.

Finaler technischer Commit: `87dfdfeab76eca77b0e7d7524648481d964fddce`.
CI:
- Battle WebRTC Check #18: SUCCESS.
- Scanner V16 Check #542: SUCCESS.

Finales Preview:
- Deployment `dpl_GZxjq9Hbk9xcwGYovcv2BcQj5YH1`.
- Host `duelvantav5vision-lbl7fv8en-bennyescaped-3783.vercel.app`.
- READY, target=null, Branch `marketplace-ux-v1`.

Praktischer Retest durch Owner:
Der Gast landet nach dem bereits erfolgten Host-Abbruch auf dem finalen Preview in der normalen BATTLE-Lobby. Das beendete private Match wird nicht wieder aufgenommen und nicht als öffentliches Match angezeigt. PASS.

Read-only Staging-Nachprüfung bestätigt für `B49F27`: `visibility=private`, `status=cancelled`. Keine Daten wurden für diese Nachprüfung verändert.

## Separater Testaccount-Befund

`test-owner@duelvanta.de` konnte den Safety-Gate nicht speichern. Read-only Analyse zeigte: Das Testprofil besitzt `role=owner`, während der bestehende Owner-Schutztrigger Owner-Rollen außerhalb der fest hinterlegten echten Owner-Identität blockiert. Der Safety-Gate selbst wurde deshalb nicht als defekt bewertet. Der Schutz wurde nicht aufgeweicht und der Testaccount nicht umgeschrieben.

## Grenzen / nächster Produktblock

Main bleibt `50f88213571be13255bb52eb489cc28cca660001`. PR #5 bleibt offen, Draft und unmerged. Keine Production-/Production-Supabase-/Stripe-/TRADE-Änderungen.

Der private **Spieler**-Einladungspfad ist damit für den geprüften Casual-Beta-Scope geschlossen. Der bereits dokumentierte Zuschauerwunsch bleibt separat: öffentliche Matches frei für berechtigte Zuschauer; private Matches nur mit eigener Zuschauerberechtigung; Zuschauer belegen keinen Spielerplatz, senden standardmäßig keine Medien und erhalten keine Spieler-/Moderationsrechte. Vor Implementierung wird die Medienarchitektur getrennt vom bestehenden stabilen Zweier-P2P-Pfad festgelegt.
