# DUELVANTA – B07 Geschäftsmodellentscheidungen L07-01 (Fortsetzung 5)

Stand: 15.09.2026

Status: **B07 OFFEN / BLOCKIERT – interne Geschäftsmodellfestlegung, keine Rechtsfreigabe**

Dieses Dokument setzt die bereits dokumentierten Entscheidungen L07-01/01 bis /21 fort. Es ist weder Rechtsgutachten noch anwaltliche oder steuerliche Freigabe.

## Entscheidung L07-01/22 – Nachverfolgbarer Versand bei entgeltlichen Versandverkäufen

**Betreiberentscheidung:**

- Bei entgeltlichen Versandverkäufen im ersten kommerziellen Marketplace-Release ist grundsätzlich eine nachverfolgbare Versandart mit Sendungsnummer beziehungsweise vergleichbarem Tracking-Nachweis zu verwenden.
- Der Verkäufer muss die zugehörige Sendungsnummer beziehungsweise den freigegebenen Versandnachweis im DUELVANTA-Auftrag hinterlegen, soweit der konkrete Versanddienst dies ermöglicht.
- Die Versandinformationen dürfen im Rahmen des freigegebenen Bestell-, Status- und Streitprozesses verwendet werden, um Versandstatus und Problemfälle nachvollziehbar zu dokumentieren.
- Persönliche Abholung bleibt als gesonderte Übergabeart möglich und benötigt keinen Paket-Tracking-Nachweis; hierfür ist vor Release ein eigener geeigneter Übergabe-/Bestätigungsprozess festzulegen.
- Die konkrete Liste zulässiger Versandarten, Mindestanforderungen an Tracking sowie mögliche Ausnahmen für besonders niedrigpreisige Sendungen werden mit dieser Entscheidung noch nicht festgelegt.
- Die Verkäuferverantwortung für ordnungsgemäße Verpackung, Versand und die jeweils anwendbaren gesetzlichen Pflichten bleibt durch den Tracking-Nachweis unberührt.

### Technische Folge für den aktuellen B07-Stand

Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release müssen Versandart, Trackingnummer, Versandstatus und gegebenenfalls Abholbestätigung technisch einem Auftrag zugeordnet und im Problemfall nachvollziehbar sein. Eine automatische Haftungs- oder Anspruchsentscheidung allein aufgrund eines Trackingstatus wird damit nicht eingeführt.

### Externer Freigabepunkt

Zwingend anwaltlich beziehungsweise datenschutz- und prozessbezogen zu prüfen bleiben insbesondere:

- die zulässige vertragliche Ausgestaltung einer Tracking-Pflicht und möglicher Ausnahmen;
- die Behandlung von Verlust, Fehlzustellung, beschädigter Sendung und widersprüchlichen Zustellnachweisen;
- die Unterschiede zwischen C2C- und B2C-Verkäufen hinsichtlich Versandrisiko und Verkäuferpflichten;
- die datenschutzkonforme Verarbeitung und Aufbewahrung von Versand-/Trackingdaten;
- der geeignete Nachweisprozess bei persönlicher Abholung.

## Entscheidung L07-01/23 – Zwei-Stunden-Reservierung nach angenommenem Preisvorschlag

**Betreiberentscheidung:**

- Nimmt der Verkäufer einen Preisvorschlag an, entsteht dadurch weiterhin noch kein Warenkaufvertrag.
- Der betroffene Artikel wird nach der Verkäuferannahme für **2 Stunden** exklusiv für den Käufer reserviert, dessen Preisvorschlag angenommen wurde.
- Während dieser Reservierungszeit kann der Artikel nicht von einem anderen Nutzer gekauft werden.
- Der Käufer muss innerhalb der Zwei-Stunden-Frist den vollständigen Checkout durchlaufen und die Zahlung erfolgreich abschließen.
- Erfolgt innerhalb der Frist kein erfolgreicher Checkout mit Zahlung, verfällt die Reservierung automatisch und der Artikel wird wieder für andere Nutzer verfügbar.
- Bis zum erfolgreichen finalen Checkout entstehen weder Kaufvertrag noch DUELVANTA-Verkaufsprovision.
- Die Reservierungsdauer ist Bestandteil des Marketplace-Zielmodells; die genaue rechtliche Einordnung der Reservierung und erforderliche Nutzerkommunikation bleiben extern freizugeben.

### Technische Folge für den aktuellen B07-Stand

Diese Entscheidung löst aktuell noch keine Produktcodeänderung aus. Bei der späteren B07-Minimalkorrektur des Verhandlungsflows muss die Zwei-Stunden-Reservierung serverseitig nachvollziehbar abgebildet werden, einschließlich Startzeitpunkt, Ablauf, Exklusivität und automatischer Freigabe. Der bestehende R0-Befund zum unmittelbaren Deal nach Verkäuferannahme bleibt bis zu dieser Korrektur offen.

### Externer Freigabepunkt

Zwingend anwaltlich zu prüfen bleiben insbesondere:

- die rechtliche Qualität der Verkäuferannahme und der anschließenden zeitlich begrenzten Reservierung;
- die Darstellung der Zwei-Stunden-Frist gegenüber Käufer und Verkäufer;
- Folgen bei technischem Zahlungsfehler, Systemstörung oder abgebrochenem Checkout innerhalb der Reservierungsfrist;
- zulässige Regeln für vorzeitige Aufhebung, erneute Preisverhandlung und Wiederfreigabe des Artikels.

## Entscheidung L07-01/24 – Versandkosten und Kostendarstellung

**Betreiberentscheidung:**

- Bei entgeltlichen Versandverkäufen im ersten kommerziellen Marketplace-Release trägt grundsätzlich der Käufer die vor Vertragsschluss klar ausgewiesenen Versandkosten.
- Warenpreis und Versandkosten werden im Angebot beziehungsweise spätestens im vollständigen Checkout getrennt und transparent dargestellt.
- Der Verkäufer darf nur die für den freigegebenen Versandweg vorgesehenen Versandkosten berechnen; versteckte Versand-, Verpackungs- oder Bearbeitungsaufschläge außerhalb der ausgewiesenen Kosten sind nicht vorgesehen.
- Versandkosten gehören nach Entscheidung L07-01/20 nicht zur Berechnungsbasis der DUELVANTA-Verkäuferprovision.
- Bei persönlicher Abholung fallen keine Versandkosten an.
- Die konkrete Behandlung von Rücksendekosten, Hinsendekosten und Erstattungen bei B2C-Widerruf, Mängelfällen oder sonstiger Rückabwicklung richtet sich nach dem später rechtlich freigegebenen Modell und wird mit dieser Betreiberentscheidung nicht vorweggenommen.

### Technische Folge für den aktuellen B07-Stand

Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release müssen Warenpreis, Versandkosten und DUELVANTA-Provision technisch getrennt geführt und im Checkout sowie im Vertrags-/Zahlungsnachweis eindeutig ausgewiesen werden. Zulässige Versandarten und deren Kostenmodell können serverseitig begrenzt beziehungsweise vorgegeben werden.

### Externer Freigabepunkt

Zwingend anwaltlich beziehungsweise steuerlich und prozessbezogen zu prüfen bleiben insbesondere:

- die konkrete Preis- und Versandkostendarstellung vor Vertragsschluss;
- die Behandlung von Versandkosten bei B2C-Widerruf, Mängeln, Teilrückabwicklungen und Erstattungen;
- zulässige Vorgaben für Versandpreise, Verpackungskosten und Abholung;
- die korrekte Trennung von Warenpreis, Versandkosten und DUELVANTA-Provision in Abrechnung und Zahlungsfluss.

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
