# DUELVANTA – B07 Geschäftsmodellentscheidungen L07-01 (Fortsetzung)

Stand: 15.09.2026

Status: **B07 OFFEN / BLOCKIERT – interne Geschäftsmodellfestlegung, keine Rechtsfreigabe**

Dieses Dokument setzt `DUELVANTA_B07_DECISIONS_2026-09-15.md` ab Entscheidung L07-01/08 fort. Es dokumentiert ausschließlich ausdrücklich getroffene Betreiberentscheidungen innerhalb von B07 und ist weder Rechtsgutachten noch anwaltliche oder steuerliche Freigabe.

Verbindliche Grundlage bleiben `DUELVANTA_MASTERHANDOUT_V13_2026-09-15.md`, `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md` und die bereits dokumentierten Entscheidungen L07-01/01 bis /07.

## Entscheidung L07-01/08 – Verantwortlichkeit für Ware, Versand, Mängel und Rückabwicklung

**Betreiberentscheidung:**

- Im ersten kommerziellen Marketplace-Release bleibt der jeweilige Verkäufer gegenüber dem Käufer für die angebotene Ware, deren vertragsgemäße Beschaffenheit, die vereinbarte Lieferung beziehungsweise Übergabe und seine jeweils anwendbaren gesetzlichen Verkäuferpflichten verantwortlich.
- DUELVANTA stellt die Plattform-, Kommunikations-, Bestell- und technische Abwicklungsinfrastruktur bereit, wird dadurch aber nicht selbst Warenverkäufer und übernimmt keine eigene Verkäuferrolle für vermittelte Drittangebote.
- Bei B2C-Verkäufen bleibt der gewerbliche Verkäufer für die auf ihn anwendbaren Verbraucherrechte, insbesondere Mängelrechte, Widerruf und die zugehörige Rückabwicklung, verantwortlich; die konkrete rechtliche Ausgestaltung bleibt externer Freigabepunkt.
- Bei C2C-Verkäufen bleibt der private Verkäufer Vertragspartner des Käufers; DUELVANTA verspricht für die Ware keine eigene Gewährleistung oder Verkäuferleistung.
- DUELVANTA darf Reklamationen, Stornos, Rücksendungen, Problemfälle und spätere Refund-Prozesse technisch koordinieren, ohne dadurch selbst Partei des Warenkaufvertrags zu werden.
- Eine spätere technische Auslösung oder Vermittlung von Stripe-Refunds ist nur nach gesonderter Freigabe des finalen Zahlungs-, Haftungs- und Rückabwicklungsmodells zulässig.

### Technische Folge für den aktuellen B07-Stand

Die bestehende Order-/Resolution-Architektur kann als technische Grundlage erhalten bleiben. Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release müssen UI, Vertragsnachweis, Beschwerde-/Storno-/Retourenprozess und spätere Zahlungsaktionen exakt mit dem rechtlich freigegebenen Verantwortungsmodell übereinstimmen.

### Externer Freigabepunkt

Zwingend anwaltlich beziehungsweise für Zahlungsfolgen zusätzlich steuerlich/zahlungsdienstlich zu prüfen bleiben insbesondere:

- die konkrete Haftungsabgrenzung Plattform ↔ Verkäufer;
- B2C-Widerruf, Mängelrechte, Rücksendung und Erstattungsprozess;
- C2C-Hinweise und zulässige Haftungsregelungen;
- die Rolle von DUELVANTA bei Beschwerden, Streitfällen und Rückabwicklungen;
- die spätere technische Refund-/Chargeback-Architektur, ohne DUELVANTA unbeabsichtigt eine weitergehende Verkäufer- oder Zahlungsdiensterolle zuzuweisen.

**B07-Status nach dieser Entscheidung: unverändert OFFEN / BLOCKIERT.**
