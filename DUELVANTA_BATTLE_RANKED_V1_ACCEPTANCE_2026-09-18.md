# DUELVANTA – BATTLE Ranked V1 Acceptance

Stand: 18.09.2026
Branch: `marketplace-ux-v1`
Technischer Abschluss-Head: `2b1d237f22083272a882af3153b500933814c7eb`
Status: **Ranked-V1-Kern praktisch und technisch abgenommen.**

## Reale Staging-Abnahme

Staging: `xhmjxrcskfhbovhitdej / DUELVANTA-STAGING`.
Testspieler: `test-verkaeufer@duelvanta.de`, `test-kaeufer@duelvanta.de`.
Judge-Testaccount: `test-judge@duelvanta.de`, Rolle `judge`, ausschließlich `battle_moderate`.

Bestätigt:
- Ranked-Erstellungsdialog kennzeichnet Ratingwirkung, Startwert 1000, TCG-getrennte Wertung und öffentliche Ranked-Sichtbarkeit.
- Serveranlage: Pokémon / ranked / public / waiting.
- Öffentliche Lobby kennzeichnet Ranked eindeutig.
- Erstes gewertetes Match aus 1000/1000 erzeugte exakt 1016/984 und genau ein Rating-Event.
- Rating, Statistik und BATTLE-UI waren synchron.
- One Piece blieb unabhängig UNRANKED.
- Widersprüchliche Spielerresultate erzeugten `dispute`, keinen Sieger und vor Auflösung kein Rating-Event.
- Ein später von beiden Spielern als Draw bestätigter Ranked-Fall wurde korrekt gewertet; aufgrund unterschiedlicher Ratings ergab sich 1016→1015 und 984→985.
- Neuer realer Ranked-Dispute `e688b110-f831-411e-9205-68fd33654531` wurde für die Judge-Abnahme erzeugt.
- Judge Desk zeigt offene Disputes ausschließlich getrennt von der Spieler-Lobby.
- Judge kann den Fall prüfen und dem Match sichtbar als Moderator beitreten.
- Judge-Entscheidung erfordert eine Notiz und läuft über `resolve_battle_dispute`.
- Reale Entscheidung zugunsten des Hosts setzte `completed`, `moderation_state=resolved`, korrekte `winner_id`, Moderator-ID und Entscheidungsnotiz.
- Audit `battle_dispute_resolved` wurde geschrieben.
- Elo wurde genau einmal verarbeitet: Host 985→1002 (+17), Gast 1015→998 (-17).
- Abschlussstand beider Spieler: jeweils 3 Pokémon-Ranked-Matches, 1 Sieg, 1 Niederlage, 1 Remis; Ratings 1002 und 998.
- Wiederholte Auflösung ist durch den dispute-only Resolver serverseitig ausgeschlossen; Rating-Event bleibt single-shot.
- UI-Abschlussfix: Entscheidungsfelder werden erst angezeigt, wenn genau der aktuelle Judge sichtbar beigetreten ist.

## Technische Bausteine

- `supabase/migrations/20260918152000_battle_dispute_resolution_v1.sql`
- `supabase/migrations/20260918155500_battle_judge_desk_v1.sql`
- `tests/battle-dispute-resolution-test.mjs`
- `tests/battle-judge-desk-test.mjs`
- Judge-UI in `battle.html` / `battle-moderation.js`

Abschluss-CI:
- Battle WebRTC Check #33: SUCCESS.
- Scanner V16 Check #557: SUCCESS.

## Testvorbereitung / Abgrenzung

Der Judge-Account wurde regulär als Beta-Player angelegt, durchlief den BATTLE-Safety-Gate und reichte eine echte Staff-Bewerbung ein. Wegen der bekannten Staging-Owner-Identitätsgrenze wurde diese Bewerbung für die Abnahme direkt auf Staging als `approved` vorbereitet und die Rolle `judge` plus ausschließlich `battle_moderate` gesetzt. Dies ist **keine bestandene Owner-UI/RPC-Abnahme**.

Der temporär entwickelte Edge-Function-Pfad `owner-invite-beta-user` wurde für den Judge nicht benutzt. Neue Staging-Auth-Nutzer unterliegen weiterhin dem bestehenden `beta_waitlist`-Trigger.

## Release-Grenzen

Main bleibt `50f88213571be13255bb52eb489cc28cca660001`. PR #5 bleibt offen, Draft und unmerged. Production und Production-Supabase wurden nicht verändert. TRADE blieb eingefroren.

## Nächster BATTLE-Block

**Spectator Foundation V1**, zunächst ohne SFU/Video:
- Zuschauer als eigene read-only Rolle/Teilnahme;
- öffentliche Matches: freier Zuschauerbeitritt für berechtigte BATTLE-Nutzer;
- private Matches: separate Zuschauerberechtigung, niemals Wiederverwendung des Spieler-Codes;
- Zuschauer belegen keinen Host-/Gastplatz;
- keine Ready-/Start-/Result-/Moderationsrechte;
- keine Kamera-/Mikrofon-Publikation durch Zuschauer;
- Zuschauerzahl und eigene Spectator-Ansicht;
- bestehender Zweier-P2P-WebRTC-Pfad bleibt geschützt.

Erst nach vollständiger Foundation-Abnahme folgt Spectator Media V1 mit SFU.
