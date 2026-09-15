# DUELVANTA – B07 Geschäftsmodellentscheidungen L07-01 (Fortsetzung 2)

Stand: 15.09.2026

Status: **B07 OFFEN / BLOCKIERT – interne Geschäftsmodellfestlegung, keine Rechtsfreigabe**

Dieses Dokument setzt `DUELVANTA_B07_DECISIONS_2026-09-15.md` sowie `DUELVANTA_B07_DECISIONS_L07-01_CONTINUED_2026-09-15.md` fort. Es dokumentiert ausschließlich ausdrücklich getroffene Betreiberentscheidungen innerhalb von B07 und ist weder Rechtsgutachten noch anwaltliche oder steuerliche Freigabe.

Verbindliche Grundlage bleiben `DUELVANTA_MASTERHANDOUT_V13_2026-09-15.md`, `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md` und die bereits dokumentierten Entscheidungen L07-01/01 bis /14.

## Entscheidung L07-01/15 – Preisverhandlung und Vertragsschluss

**Betreiberentscheidung:**

- Preisverhandlungen beziehungsweise Preisvorschläge bleiben Bestandteil des ersten kommerziellen Marketplace-Releases.
- Die Annahme eines Preisvorschlags durch den Verkäufer führt im Zielmodell **noch nicht** zum Abschluss des Warenkaufvertrags und erzeugt noch keine verbindliche Bestellung.
- Nach Annahme des Preisvorschlags wird der ausgehandelte Preis für den konkreten Vorgang übernommen beziehungsweise reserviert und der Käufer anschließend in einen vollständigen Checkout geführt.
- Erst die abschließende Käufererklärung im vollständigen Checkout mit dem freigegebenen eindeutigen Bestellbutton, derzeit als Zielbezeichnung `Zahlungspflichtig bestellen`, soll den verbindlichen Kauf auslösen.
- Festpreis- und Verhandlungskäufe sollen damit beim eigentlichen Vertragsschluss auf denselben finalen Checkout-, Pflichtinformations- und Nachweisprozess zulaufen.
- Die konkrete Bindungswirkung und zeitliche Reservierung eines angenommenen Preisvorschlags, einschließlich Ablauf, Rücknahme und zwischenzeitlicher Verfügbarkeit des Artikels, ist noch gesondert festzulegen und extern freizugeben.

### Technische Folge für den aktuellen B07-Stand

Der aktuell dokumentierte Verhandlungsflow, bei dem die Verkäuferannahme unmittelbar einen Deal erzeugen kann, entspricht dieser Betreiberentscheidung nicht und bleibt daher ein realer B07-R0-Befund. In diesem Entscheidungsschritt wird noch keine Produktcodeänderung vorgenommen. Vor Release muss der Verhandlungsflow minimal so angepasst und anschließend nachgewiesen werden, dass die Verkäuferannahme keinen Kaufvertrag erzeugt und der Käufer zwingend durch den vollständigen finalen Checkout geführt wird.

### Externer Freigabepunkt

Zwingend anwaltlich zu prüfen bleiben insbesondere:

- die genaue rechtliche Qualität des Käufer-Preisvorschlags und der Verkäuferannahme vor dem finalen Checkout;
- ob und wie lange der ausgehandelte Preis beziehungsweise die Ware nach Verkäuferannahme für den Käufer reserviert werden darf oder soll;
- welche Rücknahme-, Ablauf- und Ablehnungsregeln zulässig und in den Plattform-/Verkäuferbedingungen abzubilden sind;
- vollständige B2C-Pflichtinformationen und Button-Lösung beim finalen Checkout;
- die identische Behandlung von Vertragsnachweis, Widerruf, Bestellbestätigung und Zahlung nach Festpreis- und Verhandlungskauf.

**B07-Status nach dieser Entscheidung: unverändert OFFEN / BLOCKIERT.**
