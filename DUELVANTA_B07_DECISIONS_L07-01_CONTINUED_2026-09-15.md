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

## Entscheidung L07-01/10 – Registrierungspflicht und kein Gast-Checkout

**Betreiberentscheidung:**

- Im ersten kommerziellen Marketplace-Release können nur registrierte und eingeloggte DUELVANTA-Nutzer über TRADE kaufen, verkaufen oder C2C-Tauschgeschäfte durchführen.
- Ein Gast-Checkout beziehungsweise Vertragsschluss ohne DUELVANTA-Konto wird im ersten Release nicht angeboten.
- Ein Käufer benötigt keinen Verkäuferstatus, solange er ausschließlich kauft; für Verkauf und C2C-Tausch gelten zusätzlich die dafür vorgesehenen Verkäufer-/Identitätsanforderungen.
- Das Nutzerkonto selbst darf kostenlos sein; aus der Registrierung entsteht keine Käufer-Transaktionsgebühr.
- Bestell-, Vertrags-, Kommunikations-, Alters-, Adress- und Beschwerdeprozesse werden einem authentifizierten Nutzerkonto zugeordnet.

### Technische Folge für den aktuellen B07-Stand

Das bestehende authentifizierte TRADE-Modell entspricht dieser Zielentscheidung grundsätzlich. Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release muss technisch nachgewiesen werden, dass Kauf-, Verkaufs- und Tauschvertragsschlüsse ohne gültige authentifizierte Session nicht möglich sind und dass die später freigegebenen Alters-/Käuferstatusanforderungen am Konto beziehungsweise vor Vertragsschluss wirksam durchgesetzt werden.

### Externer Freigabepunkt

Zwingend extern zu prüfen bleiben insbesondere:

- die wirksame Einbeziehung der Plattformbedingungen bei Registrierung beziehungsweise erstmaliger Marketplace-Nutzung;
- Umfang und Zeitpunkt der erforderlichen Konto-, Alters-, Käufer- und Adressangaben;
- die zulässige Verknüpfung von Vertragsnachweisen, Kommunikation und Aufbewahrung mit dem Nutzerkonto;
- Folgen von Kontosperre oder Kontolöschung für laufende und abgeschlossene Verträge sowie gesetzliche Aufbewahrungspflichten.

## Entscheidung L07-01/11 – Integrierter Zahlungsweg für entgeltliche Verkäufe

**Betreiberentscheidung:**

- Entgeltliche Verkäufe im ersten kommerziellen Marketplace-Release werden ausschließlich über den später rechtlich, steuerlich und zahlungsdienstlich freigegebenen integrierten Zahlungsdienstleister abgewickelt.
- Externe Zahlungen außerhalb des DUELVANTA-Marketplace-Prozesses, insbesondere private Banküberweisung an den Verkäufer, PayPal-Freunde-Zahlungen, Barzahlung oder sonstige individuell vereinbarte externe Zahlungswege, werden für abgeschlossene Marketplace-Verkäufe im ersten Release nicht vorgesehen.
- DUELVANTA nimmt Kundengelder nicht auf einem eigenen Konto entgegen und bezeichnet den Zahlungsfluss nicht als Treuhand oder Escrow, sofern dies nicht später ausdrücklich rechtlich freigegeben wird.
- Die Verkäuferprovision von DUELVANTA soll im später freigegebenen integrierten Zahlungsmodell technisch nachvollziehbar zugeordnet beziehungsweise abgerechnet werden.
- Eine Abholung der Ware kann als Übergabeart möglich bleiben; auch in diesem Fall soll die entgeltliche Zahlung über den freigegebenen integrierten Zahlungsweg erfolgen.
- Reine C2C-Tauschgeschäfte Ware gegen Ware nach Entscheidung L07-01/05 bleiben ohne Geldzahlung und werden von dieser Zahlungsentscheidung nicht erfasst.

### Technische Folge für den aktuellen B07-Stand

Für diese Geschäftsmodellentscheidung wird jetzt keine Zahlungsfunktion aktiviert. `manual_beta`, Stripe Live, echte Payments, Refunds und Payouts bleiben unverändert deaktiviert beziehungsweise verboten. Die vorhandene Stripe-Connect-Vorbereitung ist erst nach finaler externer Freigabe des End-to-End-Geldflusses gegen dieses Zielmodell abzugleichen und darf vorher nicht produktiv aktiviert werden.

### Externer Freigabepunkt

Zwingend extern beziehungsweise steuerlich/zahlungsdienstlich zu prüfen bleiben insbesondere:

- der konkrete End-to-End-Geldfluss zwischen Käufer, Zahlungsdienstleister, Verkäufer und DUELVANTA;
- ZAG-/Zahlungsdiensterolle und die konkrete Stripe-Connect-Konfiguration;
- Einzug, Berechnung, Fälligkeit und steuerliche Behandlung der DUELVANTA-Provision;
- Refunds, Chargebacks, Stornos, Rückabwicklungen und Auszahlungen;
- die vertragliche Behandlung unzulässiger externer Zahlungsumgehungen und deren Folgen;
- die zulässige Gestaltung einer Abholung bei weiterhin integrierter Onlinezahlung.

## Entscheidung L07-01/12 – Keine eigene DUELVANTA-Käuferschutzgarantie

**Betreiberentscheidung:**

- DUELVANTA gibt im ersten kommerziellen Marketplace-Release keine eigene Geld-zurück-, Beschaffenheits-, Liefer- oder sonstige Käuferschutzgarantie für vermittelte Drittverkäufe.
- Gesetzliche und vertragliche Ansprüche aus dem Warenkauf richten sich grundsätzlich gegen den jeweiligen Verkäufer nach der konkret anwendbaren C2C- oder B2C-Konstellation.
- DUELVANTA darf einen technischen Problemfall-, Beschwerde-, Rückabwicklungs- und späteren Refund-Prozess bereitstellen, ohne dadurch eine eigene Garantie oder Verkäuferhaftung zu übernehmen.
- Eine spätere freiwillige DUELVANTA-Käuferschutzleistung bleibt möglich, gehört aber nicht zum ersten Release und muss vor Einführung gesondert rechtlich, wirtschaftlich, steuerlich und technisch freigegeben werden.

### Technische Folge für den aktuellen B07-Stand

Die bestehende Order-/Resolution-Architektur kann für technische Streit- und Rückabwicklungsprozesse als Grundlage erhalten bleiben. Es darf vor Release keine UI-, Werbe- oder Vertragsdarstellung geben, die einen eigenen DUELVANTA-Käuferschutz oder eine eigene Garantie suggeriert, solange eine solche Leistung nicht ausdrücklich eingeführt und freigegeben wurde. Diese Entscheidung löst aktuell keine Produktcodeänderung aus.

### Externer Freigabepunkt

Zwingend anwaltlich beziehungsweise für Zahlungsfolgen zusätzlich zahlungsdienstlich zu prüfen bleiben insbesondere:

- die zulässige Abgrenzung zwischen technischer Streit-/Refund-Unterstützung und eigener Garantie- oder Einstandspflicht;
- die konkreten Plattformbedingungen zu Beschwerden, Rückabwicklung und Zahlungsproblemen;
- Formulierungen in UI, Werbung und Bestellkommunikation, damit keine weitergehende Käuferschutzleistung versprochen wird;
- die Rechte und Pflichten des Zahlungsdienstleisters bei Refunds und Chargebacks.

## Entscheidung L07-01/13 – Moderation, Angebotsentfernung und Kontosperren

**Betreiberentscheidung:**

- DUELVANTA darf im ersten kommerziellen Marketplace-Release rechtswidrige oder gegen die freigegebenen Plattform-/Marketplace-Regeln verstoßende Angebote entfernen, ausblenden oder deren Veröffentlichung verhindern.
- DUELVANTA darf Marketplace-Funktionen eines Nutzers vorübergehend beschränken oder ein Nutzerkonto beziehungsweise Verkäuferkonto vorübergehend oder dauerhaft sperren, wenn hierfür ein sachlicher und nach dem später freigegebenen Regelwerk zulässiger Grund besteht.
- Moderations- und Sperrmaßnahmen sollen grundsätzlich nachvollziehbar begründet und, soweit gesetzlich beziehungsweise nach dem freigegebenen Verfahren erforderlich, dem Betroffenen mitgeteilt werden.
- Für betroffene Nutzer wird ein geeigneter Einspruchs-/Beschwerdeweg vorgesehen, soweit dies nach dem anwendbaren Rechts- und Plattformmodell erforderlich oder vorgesehen ist.
- Bei schweren, offensichtlichen oder akut sicherheits-/rechtsrelevanten Fällen dürfen technisch sofortige Schutzmaßnahmen vorgesehen werden; die nachgelagerte Begründungs- und Prüfpflicht bleibt davon unberührt.
- Eine Kontosperre oder Angebotsentfernung beseitigt bereits entstandene Kauf-, Tausch-, Zahlungs-, Rückabwicklungs-, Nachweis- oder sonstige gesetzliche beziehungsweise vertragliche Ansprüche nicht automatisch.
- Offene Bestellungen, laufende Streitfälle, Vertragsnachweise und gesetzlich aufzubewahrende Daten müssen trotz Kontosperre nach dem später freigegebenen Prozess korrekt weiterbehandelt werden.

### Technische Folge für den aktuellen B07-Stand

Die bereits vorbereitete Notice-and-Action-, Moderations-, Verkäuferfreigabe- und Audit-Architektur kann als technische Grundlage erhalten bleiben. Diese Entscheidung löst aktuell keine Produktcodeänderung aus. Vor Release müssen konkrete Sperrgründe, Maßnahmenstufen, Begründungen, Benachrichtigungen, Einspruchswege und die Behandlung laufender Transaktionen gegen das rechtlich freigegebene Regelwerk abgenommen werden.

### Externer Freigabepunkt

Zwingend anwaltlich zu prüfen bleiben insbesondere:

- zulässige und hinreichend bestimmte Moderations-, Sperr- und Kündigungsgründe;
- DSA-Anforderungen an Bedingungen, Begründungen, Beschwerde-/Einspruchsverfahren und gegebenenfalls weitere Plattformpflichten;
- die Behandlung gewerblicher Verkäufer einschließlich einer möglichen P2B-Anwendbarkeit und dortiger Beschränkungs-/Beendigungsanforderungen;
- Verhältnis von Sofortmaßnahmen zu Vorankündigung, Anhörung und nachgelagerter Begründung;
- Auswirkungen von Sperre oder Beendigung auf laufende Verträge, Zahlungen, Refunds, Datenzugang und Aufbewahrung.

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
