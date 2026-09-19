# DUELVANTA – B07 Geschäftsmodellentscheidungen L07-01 (Fortsetzung 6)

Stand: 15.09.2026

Status: **B07 OFFEN / BLOCKIERT – interne Geschäftsmodellfestlegung, keine Rechtsfreigabe**

Dieses Dokument setzt die bereits dokumentierten Entscheidungen L07-01/01 bis /25 fort. Es ist weder Rechtsgutachten noch anwaltliche oder steuerliche Freigabe.

## Entscheidung L07-01/26 – Versandfrist und Tracking beim privaten C2C-Tausch

**Betreiberentscheidung:**

- Bei einem verbindlich bestätigten privaten C2C-Tausch Ware gegen Ware müssen beide Tauschpartner ihre jeweilige Ware spätestens innerhalb von **3 Werktagen** nach der verbindlichen Tauschbestätigung versenden.
- Beide Tauschpartner müssen innerhalb derselben Frist eine nachverfolgbare Versandart verwenden und die jeweilige Sendungsnummer beziehungsweise den freigegebenen Tracking-Nachweis im DUELVANTA-Tauschvorgang hinterlegen.
- Die Pflichten gelten symmetrisch für beide Tauschpartner.
- Erfolgt Versand oder Tracking-Nachweis nicht fristgerecht, darf der andere Tauschpartner einen Problemfall über den vorgesehenen DUELVANTA-Prozess eröffnen.
- Persönliche Übergabe bleibt als gesonderte Tauschabwicklung möglich; dafür ist statt Paket-Tracking ein später freizugebender geeigneter Übergabe-/Bestätigungsnachweis erforderlich.
- Wiederholte oder erhebliche Verstöße dürfen nach dem freigegebenen Moderationsmodell berücksichtigt werden; DUELVANTA trifft dadurch keine verbindliche zivilrechtliche Endentscheidung über Ansprüche der Tauschpartner.

### Technische Folge für den aktuellen B07-Stand

Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release muss der Tauschflow beide Versandseiten getrennt abbilden können, einschließlich Fristbeginn nach verbindlicher Tauschbestätigung, jeweiligem Tracking-Nachweis, Versandstatus, Fristüberschreitung und Problemfalleröffnung. Bei persönlicher Übergabe ist ein eigener beidseitiger Nachweisprozess vorzusehen.

### Externer Freigabepunkt

Zwingend anwaltlich beziehungsweise datenschutz- und prozessbezogen zu prüfen bleiben insbesondere:

- die konkrete rechtliche Qualität und der Zeitpunkt der verbindlichen Tauschbestätigung;
- die zulässige Drei-Werktage-Frist und deren Definition im Tauschmodell;
- die Behandlung einseitiger Nichtversendung, Verlust, Fehlzustellung, Beschädigung und widersprüchlicher Trackingdaten;
- die Rechte der Tauschpartner bei Rückabwicklung oder Scheitern des Tauschs;
- die datenschutzkonforme Verarbeitung und Aufbewahrung der Versand- und Übergabenachweise.

## Entscheidung L07-01/27 – Vertragsschluss beim Festpreis

**Betreiberentscheidung:**

- Ein veröffentlichtes Festpreisangebot des Verkäufers bildet im Zielmodell die Grundlage für den Kauf zum angegebenen Preis; allein durch Veröffentlichung entsteht noch kein Kaufvertrag mit einem bestimmten Käufer.
- Der Käufer wird vor dem verbindlichen Vertragsschluss durch den vollständigen Checkout geführt, in dem insbesondere Verkäuferrolle, Warenpreis, Versandkosten und die jeweils erforderlichen Pflichtinformationen angezeigt werden.
- Der Kaufvertrag soll erst entstehen, wenn ein berechtigter Käufer den vollständigen Checkout abschließt und dort die verbindliche Bestellerklärung über den freigegebenen eindeutigen Bestellbutton, derzeit Zielbezeichnung `Zahlungspflichtig bestellen`, abgibt.
- Ein zusätzliches manuelles Verkäufer-Akzeptieren nach der verbindlichen Käuferbestellung ist im Festpreismodell nicht vorgesehen.
- Für nur einmal vorhandene Artikel muss technisch verhindert werden, dass derselbe Artikel gleichzeitig mehrfach wirksam verkauft wird.
- Das Zusammenspiel von verbindlicher Bestellerklärung, Zahlungsautorisierung, erfolgreicher Zahlung und technischen Zahlungsfehlern ist noch rechtlich und zahlungsdienstlich final festzulegen.

### Technische Folge für den aktuellen B07-Stand

Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release muss der Festpreisflow technisch eindeutig denselben finalen Checkout-, Pflichtinformations- und Vertragsnachweisprozess verwenden, der für den freigegebenen Vertragsschluss vorgesehen ist. Die Verfügbarkeit einmaliger Artikel muss serverseitig gegen Doppelverkauf abgesichert werden.

### Externer Freigabepunkt

Zwingend anwaltlich beziehungsweise zahlungsdienstlich zu prüfen bleiben insbesondere:

- die genaue rechtliche Einordnung des veröffentlichten Festpreisangebots und der Käufererklärung;
- der exakte Zeitpunkt des Vertragsschlusses im Zusammenspiel mit Zahlungsautorisierung und erfolgreicher Zahlung;
- die Behandlung abgebrochener oder technisch fehlgeschlagener Zahlungen nach Abgabe der Bestellerklärung;
- vollständige B2C-Pflichtinformationen und Button-Lösung;
- der belastbare technische Nachweis des Vertragsschlusses und die Verhinderung von Doppelverkäufen.

## Entscheidung L07-01/28 – Höhe der Verkäuferprovision

**Betreiberentscheidung:**

- DUELVANTA erhebt im ersten kommerziellen Marketplace-Release eine Verkäuferprovision von **4 %** auf den tatsächlich erfolgreich bezahlten Warenpreis.
- Versandkosten bleiben vollständig außerhalb der Provisionsbasis.
- Die Provision entsteht nur nach Maßgabe der bereits dokumentierten Entscheidung L07-01/20; bei vollständigen oder teilweisen Erstattungen wird sie entsprechend korrigiert.
- Reine private C2C-Tauschgeschäfte Ware gegen Ware bleiben im ersten Release provisionsfrei.
- Zahlungsdienstkosten des später freigegebenen Zahlungsdienstleisters sind **nicht automatisch Bestandteil der 4-%-DUELVANTA-Provision**. Deren wirtschaftliche und vertragliche Zuordnung wird separat festgelegt und vor kommerziellem Release geprüft.
- Die 4-%-Provision ist eine Geschäftsmodellentscheidung für Release 1 und keine rechtliche oder steuerliche Freigabe.

### Technische Folge für den aktuellen B07-Stand

Diese Entscheidung aktiviert keine Zahlungs- oder Gebührenfunktion. Stripe Live, echte Payments, Refunds und Payouts bleiben deaktiviert. Vor Release muss die Gebührenlogik 4 % ausschließlich auf den tatsächlich bezahlten Warenpreis berechnen, Versandkosten ausschließen und Refund-/Teilrefund-Korrekturen revisionsfähig abbilden.

### Externer Freigabepunkt

Zwingend anwaltlich, steuerlich und zahlungsdienstlich zu prüfen bleiben insbesondere:

- transparente und wirksame Einbeziehung der 4-%-Verkäuferprovision in die Verkäufer-/TRADE-Bedingungen;
- Umsatzsteuer- und Rechnungsbehandlung der DUELVANTA-Provision gegenüber privaten und gewerblichen Verkäufern;
- konkrete Behandlung und Zuordnung von Zahlungsdienst-, Chargeback- und sonstigen Transaktionskosten;
- Abgleich der Gebührenlogik mit dem final freigegebenen Stripe-Connect-/Zahlungsfluss;
- korrekte Behandlung von Stornos, vollständigen Refunds und Teilrefunds.

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
