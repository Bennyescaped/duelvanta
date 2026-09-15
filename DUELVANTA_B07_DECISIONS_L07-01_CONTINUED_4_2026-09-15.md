# DUELVANTA – B07 Geschäftsmodellentscheidungen L07-01 (Fortsetzung 4)

Stand: 15.09.2026

Status: **B07 OFFEN / BLOCKIERT – interne Geschäftsmodellfestlegung, keine Rechtsfreigabe**

Dieses Dokument setzt die bereits dokumentierten Entscheidungen L07-01/01 bis /18 fort. Es ist weder Rechtsgutachten noch anwaltliche oder steuerliche Freigabe.

## Entscheidung L07-01/19 – Verkäuferstatus privat/gewerblich und Statusänderungen

**Betreiberentscheidung:**

- Jeder Verkäufer muss vor Verkaufsfreigabe angeben, ob er auf DUELVANTA als privater oder gewerblicher Verkäufer auftritt.
- Der Verkäuferstatus darf nicht bewusst falsch angegeben werden, um Pflichten zu umgehen.
- Private Verkäufer werden als privat, gewerbliche Verkäufer als gewerblich gekennzeichnet.
- Verkäufer müssen Änderungen melden, wenn ihr bisheriger Status nicht mehr zutrifft oder überprüft werden muss.
- Bei erkennbaren Widersprüchen oder unplausiblen Angaben darf DUELVANTA Verkaufsfunktionen vorübergehend beschränken, weitere Angaben oder Nachweise anfordern und eine erneute Statusprüfung durchführen.
- DUELVANTA trifft damit keine abschließende steuerliche oder rechtliche Feststellung über die Unternehmereigenschaft eines Nutzers. Die Verantwortung für richtige Angaben und die Einhaltung der jeweils geltenden Verkäuferpflichten bleibt beim Verkäufer; gesetzliche Plattformpflichten bleiben unberührt.
- Ein Wechsel zwischen privatem und gewerblichem Verkäuferstatus muss technisch nachvollziehbar dokumentiert werden. Bereits abgeschlossene Verträge werden durch eine spätere Statusänderung nicht automatisch rückwirkend neu eingeordnet.

### Technische Folge für den aktuellen B07-Stand

Das vorhandene Verkäufer-Onboarding mit Auswahl zwischen privatem und gewerblichem Verkäufer kann als Grundlage erhalten bleiben. Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release müssen Statusänderung, erneute Prüfung, Kennzeichnung, Sperr-/Freigabelogik und die Zuordnung neuer Listings und Bestellungen zum jeweils gültigen Verkäuferstatus technisch abgenommen werden.

### Externer Freigabepunkt

Zwingend anwaltlich beziehungsweise steuerlich zu prüfen bleiben insbesondere:

- erforderliche Erklärungen und Nachweise für private und gewerbliche Verkäufer;
- der Umgang mit unplausiblen Privatstatus-Angaben, Statuswechseln und Falschangaben;
- notwendige Kennzeichnungen und Verbraucherinformationen je Verkäuferstatus;
- die zulässige Rolle von DUELVANTA bei der Plausibilisierung, ohne selbst eine abschließende steuerliche oder rechtliche Statusentscheidung zu behaupten;
- Auswirkungen auf B2C-Pflichten, PStTG/DAC7, mögliche P2B-Anforderungen, Zahlungsabwicklung und Aufbewahrung.

## Entscheidung L07-01/20 – Entstehung und Berechnungsbasis der Verkäuferprovision

**Betreiberentscheidung:**

- Die DUELVANTA-Verkäuferprovision entsteht im ersten kommerziellen Marketplace-Release erst bei einem tatsächlich erfolgreich bezahlten vermittelten Verkauf.
- Das bloße Einstellen eines Angebots, ein Preisvorschlag, dessen Annahme oder eine noch nicht erfolgreich bezahlte Bestellung lösen keine Verkaufsprovision aus.
- Berechnungsbasis der Provision ist ausschließlich der tatsächlich bezahlte Warenpreis. Versandkosten gehören nicht zur provisionspflichtigen Berechnungsbasis.
- Wird ein Verkauf vollständig storniert und der Warenpreis vollständig erstattet, wird die zugehörige DUELVANTA-Verkaufsprovision vollständig zurückgerechnet beziehungsweise nicht endgültig geschuldet.
- Bei einer teilweisen Erstattung des Warenpreises wird die Provision entsprechend dem nach der Rückabwicklung verbleibenden tatsächlich bezahlten Warenumsatz angepasst.
- Die konkrete Provisionshöhe wird mit dieser Entscheidung noch nicht festgelegt.

### Technische Folge für den aktuellen B07-Stand

Diese Entscheidung aktiviert keine Zahlungs- oder Provisionsfunktion. Stripe Live, echte Payments, Refunds und Payouts bleiben weiterhin deaktiviert. Vor kommerziellem Release müssen Zahlungsstatus, Warenpreis, Versandkosten, Refund-Beträge und Provisionskorrekturen technisch eindeutig getrennt und revisionsfähig nachvollziehbar sein.

### Externer Freigabepunkt

Zwingend anwaltlich, steuerlich und zahlungsdienstlich zu prüfen bleiben insbesondere:

- die konkrete Provisionshöhe und deren transparente vertragliche Darstellung;
- Umsatzsteuer- und Rechnungsbehandlung der DUELVANTA-Provision gegenüber privaten und gewerblichen Verkäufern;
- Zeitpunkt der endgültigen Fälligkeit und Abrechnung der Provision;
- Behandlung von Teilrefunds, Chargebacks, nachträglichen Preisnachlässen und sonstigen Rückabwicklungen;
- Abgleich der Provisionslogik mit dem final freigegebenen Stripe-Connect-/Zahlungsfluss.

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
