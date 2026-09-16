# DUELVANTA B07 · Entscheidung L07-01 / 54 · Release-1 Versandabschluss

Stand: 16.09.2026
Status: verbindliche Produktentscheidung für Release 1

## Zweck

Diese Entscheidung ersetzt für Release 1 die Annahme, dass eine kostenpflichtige Multi-Carrier-API zwingende Voraussetzung für den automatischen technischen Abschluss einer Bestellung ist.

AfterShip bleibt eine deaktivierte spätere Komfortoption. Release 1 funktioniert ohne kostenpflichtige Tracking-API.

## Versandregeln

1. Warenwert über 25 EUR: Tracking verpflichtend.
2. Warenwert bis einschließlich 25 EUR: Tracking optional.
3. Risikoregel kann Tracking unabhängig vom Warenwert verpflichtend machen.
4. Freiwillig getrackter Versand bis 25 EUR nutzt den getrackten Abschlussweg.
5. Persönliche Abholung wird ausschließlich über den bilateralen Einmal-Übergabecode abgeschlossen.

## Käuferbestätigung

Der Käufer kann nach Versand jederzeit ausdrücklich `ERHALTEN – ALLES IN ORDNUNG` bestätigen.

Diese ausdrückliche Käuferbestätigung schließt die Order technisch sofort ab, sofern kein offener Problemfall besteht.

Eine automatische technische Fertigstellung darf niemals nachträglich so dargestellt werden, als hätte der Käufer selbst den Erhalt bestätigt.

## Getrackter Versand ohne Carrier-API

Die Trackingnummer und der Versanddienstleister werden bei Versand in DUELVANTA gespeichert.

Wenn der Käufer nicht reagiert, kann der Verkäufer eine Zustellprüfung anfordern.

Die 72-Stunden-Frist startet NICHT durch die Verkäuferangabe und NICHT durch das bloße Vorhandensein einer Trackingnummer.

Ein Owner muss die Zustellung anhand der offiziellen Sendungsverfolgung prüfen und den tatsächlichen Zustellzeitpunkt in DUELVANTA verifizieren.

Erst die Owner-Verifizierung setzt `delivery_evidence_at` und `closure_eligible_at = delivery_evidence_at + 72 Stunden`.

Während der 72 Stunden kann der Käufer einen Problemfall öffnen. Ein offener Problemfall blockiert den automatischen technischen Abschluss.

Nach Ablauf der 72 Stunden ohne offenen Problemfall wird die Order technisch abgeschlossen. Der Abschlussgrund lautet `carrier_delivery_72h_elapsed`.

## Ungetrackter Versand

Ungetrackter Versand erhält keine 72-Stunden-Zustellfrist, da kein objektiver Zustellzeitpunkt vorhanden ist.

Ab Versandzeitpunkt gelten zwei feste Fristen:

- `Nicht erhalten` ist frühestens nach 14 Tagen zulässig.
- Ohne offenen Problemfall wird die Order nach 40 Tagen technisch automatisch abgeschlossen.

Der 40-Tage-Abschlussgrund lautet `untracked_shipping_40d_elapsed`.

Andere Problemkategorien wie beschädigt, nicht wie beschrieben oder sonstige konkrete Versandprobleme bleiben von der 14-Tage-Sperre unberührt, soweit der jeweilige Sachverhalt bereits eingetreten ist.

## Problemfälle

Ein offener Problemfall blockiert jeden automatischen Abschluss.

Wird ein Problemfall zurückgezogen oder anderweitig geschlossen, darf der technische Fristmechanismus wieder greifen. Ist die jeweilige Frist bereits abgelaufen, kann der Abschluss beim nächsten Lifecycle-Lauf erfolgen.

Bei getrackter Sendung bedeutet ein Carrier-Status `zugestellt` nicht automatisch, dass ein bestrittenes Nicht-Erhalten zugunsten des Verkäufers entschieden wird. Der Problemfall bleibt gesondert zu prüfen.

## Auszahlung

B07 führt weiterhin keine echte Auszahlung aus.

Für eine spätere integrierte Zahlungsabwicklung gilt als Freigabegrund für den Auszahlungspfad ausschließlich ein technischer Abschluss durch mindestens eines der folgenden Ereignisse:

- ausdrückliche Käuferbestätigung `ERHALTEN – ALLES IN ORDNUNG`,
- verifizierte getrackte Zustellung + 72 Stunden ohne offenen Problemfall,
- ungetrackter Versand + 40 Tage ohne offenen Problemfall,
- erfolgreich bestätigter bilateraler Übergabecode bei Abholung.

Der technische Abschluss ist von der tatsächlichen Bank-/Stripe-Auszahlungsdauer zu unterscheiden.

## AfterShip / Multi-Carrier-API

Die vorbereitete AfterShip-Anbindung bleibt standardmäßig deaktiviert und ist keine Release-1-Abhängigkeit.

Falls sie später aktiviert wird, darf sie ausschließlich die manuelle Owner-Zustellprüfung automatisieren. Die fachlichen Regeln bleiben identisch: nur belastbare Carrier-Zustellevidenz startet die 72 Stunden; wiederholte Events dürfen die Frist nicht neu starten.

## Technische Sicherheitsgrenzen

- Zustellevidenz kann nicht durch Käufer oder Verkäufer direkt geschrieben werden.
- Owner-Verifizierung ist serverseitig autorisiert und auditiert über Status, Zeitpunkte, Owner-ID und Prüfnotiz.
- Ungetrackter 40-Tage-Abschluss basiert ausschließlich auf `shipped_at`.
- `buyer_confirmed_at` bleibt bei automatischem Abschluss unverändert.
- Offene Problemfälle sperren den Lifecycle-Advance.
- Keine Payment-, Refund-, Fee- oder Payout-Ausführung wird durch diese Entscheidung aktiviert.
