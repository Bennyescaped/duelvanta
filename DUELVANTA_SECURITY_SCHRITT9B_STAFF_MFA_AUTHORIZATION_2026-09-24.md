# DUELVANTA – Schritt 9B Staff-MFA-Autorisierung

Stand: 24.09.2026.

Diese Datei ergänzt **V53 ausschließlich um die ausdrückliche Benutzerautorisierung für die noch offenen echten Staff-MFA-Livetests auf Staging**. Sie ersetzt V53 nicht und nimmt V54 nicht vorweg.

## Autorisierung

Der Benutzer autorisiert ausdrücklich:

> Staging-only dürfen bei Bedarf minimale synthetische Admin-, Moderator- und Judge-Testkonten angelegt und mit echten MFA-Faktoren versehen werden. Sie dürfen ausschließlich für Schritt 9B verwendet werden; Production bleibt unangetastet.

## Geltungsbereich

Ausschließlich:

- Supabase Staging `xhmjxrcskfhbovhitdej`
- Branch `marketplace-ux-v1`
- Schritt 9B gemäß `DUELVANTA_MASTERHANDOUT_V53_2026-09-24.md`

Production `enifiaqsnqtbzylnfrpi` bleibt vollständig read-only.

## Erlaubte Fixture-Provisionierung

Falls für die noch offenen Live-Grenztests erforderlich, darf Work auf Staging:

- je ein minimal synthetisches Admin-, Moderator- und Judge-Testkonto anlegen;
- eindeutig synthetische, nicht reale Identitäten verwenden;
- vorhandene sichere Admin-/Service-Role-Provisionierungswege ausschließlich zum Fixture-Setup verwenden;
- die fachlich vorgesehenen Staffrollen kontrolliert zuweisen;
- echte MFA/TOTP-Faktoren über den normalen Supabase-/Produktpfad enrollen;
- echte AAL2-Sessions für die jeweilige synthetische Staffrolle herstellen;
- diese Rollen ausschließlich für die in V53 offenen Session-/RPC-/Staff-Grenztests verwenden.

Empfohlene eindeutige Kennzeichnung:

- `dv-step9b-admin-20260924@invalid.example`
- `dv-step9b-moderator-20260924@invalid.example`
- `dv-step9b-judge-20260924@invalid.example`

Keine reale Mailadresse verwenden. Keine echte E-Mail versenden.

## Menschliche MFA-Bedienung

TOTP-QR-Code, Enrollment-Bestätigung und erforderliche MFA-Challenges werden vom Benutzer persönlich bedient.

Work darf:

- den Browser an der erforderlichen MFA-Stelle offen lassen;
- präzise sagen, welcher QR-/Bestätigungsschritt nötig ist;
- nach der Benutzeraktion **im selben Work-Chat selbstständig weiterarbeiten**.

Work darf nicht:

- TOTP-Seeds dokumentieren;
- OTP-Codes in Repository/Evidenz schreiben;
- JWTs, Sessiontokens oder Recovery-Secrets extrahieren;
- MFA-Faktor- oder Sessionzeilen künstlich in der Datenbank erzeugen;
- Service Role als menschlichen MFA-Ersatz verwenden.

## Zu beweisende Live-Grenzen

Mit den echten synthetischen MFA-Staffsessions darf Work die in V53 offenen Nachweise schließen, insbesondere:

1. direkter privilegierter RPC-Aufruf unter echter AAL1-Session → abgewiesen;
2. derselbe zulässige Rollenpfad unter echter AAL2-Session → nur bei fachlicher Berechtigung erlaubt;
3. widerrufene/abgelaufene Session → abgewiesen;
4. fremde Session-/Rollenbindung → abgewiesen;
5. Admin-/Moderator-/Judge-Rollengrenzen → jeweils nur fachlich zulässige Funktionen;
6. alte/dv_core-/alternative privilegierte Pfade → kein Bypass;
7. beide Invite-Namen live negativ prüfen, **ohne** gültige Einladung oder Mailversand;
8. verbleibende sichere COLLECT-/BATTLE-/TRADE-Geschäfts-Smokes nach Härtung.

Keine Einwilligungen, Alters-, Wohnsitz-, Verbraucher- oder Arenaerklärungen für reale Personen erfinden. Synthetische Konten dürfen nur die minimal nötigen, eindeutig als Test markierten Angaben erhalten.

## Abschluss / Cleanup

Nach den Tests:

- alle synthetischen Staffsessions regulär abmelden bzw. widerrufen;
- keine dauerhaft unnötigen aktiven privilegierten Sessions belassen;
- Testkonten und MFA-Nachweise eindeutig als Staging-Fixtures dokumentieren;
- keine immutable Audit-/Security-Evidenz löschen;
- keine Productiondaten oder -rollen verändern.

Wenn die vorhandene Architektur einen sicheren vorgesehenen Weg bietet, privilegierte Testkonten nach Abschluss auf einen nicht-operativen Zustand zurückführen; dabei keine Audit- oder Nachweisevidenz zerstören.

## Harte Grenzen

Nicht autorisiert:

- Production-Mutation
- Production-Migration
- Production-Deployment
- Merge nach main
- Stripe Live
- Stripe Sandbox
- echte Zahlung
- Refund/Payout
- echte E-Mail/Einladung
- Domain-/Environment-Umschaltung
- Abschalten des MFA-/Session-Guards
- Wiederherstellung breiter Browserrechte
- neue Rechts-/Steuerentscheidung

V53 bleibt für den restlichen Auftrag verbindlich.

**Ziel: Schritt 9B im selben Work-Block vollständig bis PASS oder einem echten HARD STOP abschließen. V54 erst am Ende erstellen.**
