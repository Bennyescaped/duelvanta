# DUELVANTA – Schritt 9B: Nachweisgrenzen-Abnahme

24.09.2026.

## Entscheidung

Der Betreiber akzeptiert ausdrücklich folgende Nachweisgrenze für die zwei verbliebenen, regulär nicht sicher herstellbaren Live-Negativfälle:

1. natürlich abgelaufene privilegierte Session / `not_after`
2. fremde `session_id` unter abweichender Benutzeridentität

Für diese beiden Fälle gelten die bereits bestandenen nativen PostgreSQL-17-Negativtests zusammen mit den echten Live-Nachweisen aus Schritt 9B als ausreichende Abnahme.

Es werden hierfür bewusst **keine** JWTs, Sessionzeilen, Auth-Claims oder MFA-Faktoren manipuliert.

## Begründung

### Fremde session_id

Eine regulär von Supabase ausgestellte Session ist an ihren Benutzer gebunden. Ein echter Livefall „User A mit session_id von User B“ lässt sich nicht über einen normalen Produkt- oder Authflow erzeugen.

Ein künstlicher Livebeweis würde eine Manipulation von Session-/JWT-Zuordnung voraussetzen und damit die eigentliche Sicherheitsgrenze umgehen.

Die fachliche Benutzerbindung wurde deshalb:

- nativ unter PostgreSQL 17 negativ geprüft;
- zusätzlich durch echte Owner/Admin/Moderator/Judge-Rollen- und MFA-Livetests ergänzt;
- durch echten Sessionwiderruf live ergänzt;
- ohne beobachteten Bypass bestanden.

### Natürliches not_after

Ein echter natürlicher Ablauf verlangt eine absichtlich nicht refreshte reale Session bis über den tatsächlichen Ablaufzeitpunkt. Das liefert gegenüber dem bereits isoliert getesteten serverseitigen `not_after`-Guard nur geringe zusätzliche Sicherheit, verursacht aber lange Warte-/Browserabhängigkeit.

Stattdessen liegen vor:

- native PostgreSQL-17-Negativtests für abgelaufene Sessions;
- echte AAL1-/AAL2-Livetests;
- echter verifizierter MFA-Faktor;
- echter globaler Sessionwiderruf und anschließende direkte RPC-Ablehnung;
- funktionale Live-Abnahme der privilegierten Rollen.

## Ergebnis

Die zwei Fälle bleiben in der Dokumentation als **isoliert nachgewiesen, nicht künstlich live erzeugt** gekennzeichnet.

Sie werden nicht in „direkter Live-Replay bestanden“ umetikettiert.

Mit dieser ausdrücklichen Betreiberentscheidung gilt die Sicherheitsabnahme von Schritt 9B insgesamt als ausreichend abgeschlossen.

## Unveränderte Grenzen

Keine Production-Freigabe.

Kein Merge.

Keine Production-Migration.

Kein Production-Deployment.

Keine Stripe-Live-Freigabe.

Keine Rechts-/Steuerfreigabe.

Weitere P0/P1/P2-Punkte aus V51 bleiben offen.
