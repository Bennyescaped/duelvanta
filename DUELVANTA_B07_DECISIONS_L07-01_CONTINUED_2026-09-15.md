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

## Entscheidung L07-01/09 – Verkäuferidentität und anonymer Verkauf

**Betreiberentscheidung:**

- Anonymes Verkaufen ist im ersten kommerziellen Marketplace-Release ausgeschlossen.
- Jeder Verkäufer muss DUELVANTA gegenüber vor Verkaufsfreigabe seine echte Identität und eine belastbare Anschrift hinterlegen.
- Ein öffentlicher Anzeigename oder Nickname darf weiterhin verwendet werden, ersetzt aber nicht die interne Identifizierung des Verkäufers.
- Bei privaten Verkäufern werden Identitäts- und Anschriftdaten nicht pauschal öffentlich angezeigt; eine Offenlegung erfolgt nur soweit dies nach dem final freigegebenen Rechts- und Prozessmodell erforderlich ist.
- Gewerbliche Verkäufer müssen zusätzlich die für ihren Händlerstatus erforderlichen Unternehmens-/Anbieterangaben hinterlegen und den dafür vorgesehenen Prüfprozess durchlaufen.
- Verkaufsfreigabe erfolgt erst nach abgeschlossenem Verkäufer-Onboarding und der jeweils erforderlichen Prüfung; interne Owner-/Staff-Rollen ersetzen diese Verkäuferprüfung nicht.

### Technische Folge für den aktuellen B07-Stand

Die bestehende Architektur mit getrennten privaten Verkäuferdaten, Verkäuferstatus und serverseitiger Verkaufsfreigabe entspricht diesem Zielmodell grundsätzlich. Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release muss der tatsächliche Identitäts-, Änderungs-, Prüf- und Sperrprozess gegen das freigegebene Modell abgenommen werden.

### Externer Freigabepunkt

Zwingend extern zu prüfen bleiben insbesondere:

- welche Identitäts- und Adressdaten je privatem beziehungsweise gewerblichem Verkäufer tatsächlich erhoben werden müssen;
- welche Prüfintensität und Nachweise für private und gewerbliche Verkäufer erforderlich sind;
- welche Verkäuferdaten gegenüber Käufern oder öffentlich offengelegt werden müssen oder dürfen;
- DSA-, Datenschutz- und PStTG-Anforderungen an Erhebung, Verifikation, Speicherung, Aktualisierung und Offenlegung;
- der Umgang mit Falschangaben, Statusänderungen und gesperrten beziehungsweise nicht mehr verifizierten Verkäufern.

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
