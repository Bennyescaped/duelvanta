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

## Entscheidung L07-01/16 – Zweistufiges Bedingungsmodell

**Betreiberentscheidung:**

- Alle registrierten Nutzer, die DUELVANTA verwenden, akzeptieren allgemeine DUELVANTA-Plattformbedingungen in der jeweils freigegebenen und versionierten Fassung.
- Nutzer, die über TRADE verkaufen oder einen privaten C2C-Tausch anbieten beziehungsweise durchführen wollen, akzeptieren zusätzlich gesonderte Verkäufer-/TRADE-Bedingungen in der jeweils freigegebenen und versionierten Fassung.
- Käufer, die nicht verkaufen oder tauschen, benötigen keinen Verkäuferstatus und keine Verkäuferbedingungen; für ihre Marketplace-Nutzung gelten die allgemeinen Plattformbedingungen sowie die konkret vor Vertragsschluss erforderlichen TRADE-/Checkout-Informationen.
- Der Warenkauf- beziehungsweise Tauschvertrag wird nicht mit DUELVANTA, sondern unmittelbar zwischen den beteiligten Nutzern geschlossen. Bei gewerblichen Verkäufern kommen die jeweils erforderlichen Händler- und Verbraucherinformationen des konkreten Verkäufers hinzu.
- Zustimmung, Fassungskennung und Zeitpunkt sollen beweissicher gespeichert werden. Eine neue Zustimmung soll nur verlangt werden, wenn eine rechtlich beziehungsweise inhaltlich relevante neue Fassung dies erfordert.
- Die vorhandene technische Zustimmung zu `seller-beta-2026-09` ist keine Rechtsfreigabe und darf erst dann produktiv als Vertragsgrundlage verwendet werden, wenn ihr ein eindeutig zugeordneter, erreichbarer und extern freigegebener Bedingungstext entspricht.

### Vertragsbeziehungen aus dieser Entscheidung

- DUELVANTA ↔ Käufer/Nutzer: Plattformnutzungsvertrag auf Grundlage der allgemeinen Plattformbedingungen.
- DUELVANTA ↔ Verkäufer/Tauschender: Plattformnutzungsvertrag plus zusätzliche Verkäufer-/TRADE-Bedingungen.
- Verkäufer ↔ Käufer beziehungsweise Tauschpartner ↔ Tauschpartner: eigenständiger Warenkauf- oder Tauschvertrag zwischen den Nutzern; DUELVANTA bleibt Vermittler.

### Technische Folge für den aktuellen B07-Stand

Die bereits vorhandene Versionierungs- und Zustimmungsvorbereitung kann als Grundlage erhalten bleiben. In diesem Entscheidungsschritt wird keine Produktcodeänderung vorgenommen. Vor Release müssen die tatsächlich freigegebenen Dokumentfassungen dauerhaft erreichbar sein und technisch eindeutig mit der gespeicherten Zustimmungsversion verknüpft werden.

### Externer Freigabepunkt

Zwingend anwaltlich zu prüfen und freizugeben bleiben insbesondere:

- die vollständigen allgemeinen Plattformbedingungen einschließlich Betreiber-/Vermittlerrolle, Leistungsumfang, Moderation, Sperren, Beendigung, Beschwerden und Datenzugang;
- die zusätzlichen Verkäufer-/TRADE-Bedingungen einschließlich Verkäuferpflichten, Gebühren, Statusangaben, Zahlungsweg, Versand, Rückabwicklung und Tauschregeln;
- die Abgrenzung zwischen Plattformvertrag und Warenkauf-/Tauschvertrag;
- wirksame Einbeziehung, Änderungsmechanismus, Versionierung und erneute Zustimmung;
- besondere Anforderungen für gewerbliche Verkäufer einschließlich einer möglichen P2B-Anwendbarkeit.

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
