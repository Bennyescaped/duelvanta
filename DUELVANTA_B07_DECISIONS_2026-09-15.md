# DUELVANTA – B07 Geschäftsmodellentscheidungen

Stand: 15.09.2026

Status: **B07 OFFEN / BLOCKIERT – interne Geschäftsmodellfestlegung, keine Rechtsfreigabe**

Dieses Dokument protokolliert ausschließlich vom Betreiber ausdrücklich getroffene Geschäftsmodellentscheidungen innerhalb von B07. Es ist kein Rechtsgutachten und keine anwaltliche oder steuerliche Freigabe. Widersprechende ungeprüfte Annahmen in älteren Arbeitsständen werden durch die hier ausdrücklich dokumentierten Betreiberentscheidungen ersetzt; gesetzliche Anforderungen und externe Freigabepunkte bleiben unberührt.

Verbindliche Grundlage: `DUELVANTA_MASTERHANDOUT_V13_2026-09-15.md` und `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md`.

## L07-01 – Betreiber-/Vermittlerrolle

### Entscheidung L07-01/01 – Release-Rolle von DUELVANTA

**Betreiberentscheidung:**

- Im ersten kommerziellen Marketplace-Release tritt DUELVANTA bei Warenverkäufen grundsätzlich als Plattformbetreiber/Vermittler auf.
- Der Kaufvertrag über die angebotene Ware kommt zwischen dem jeweiligen Verkäufer und dem Käufer zustande.
- DUELVANTA ist bei diesen vermittelten Drittangeboten weder Warenverkäufer noch Käufer und erwirbt kein Eigentum an der Ware.
- Private und gewerbliche Drittverkäufer bleiben zulässige Verkäufergruppen; ihre jeweilige Rolle ist getrennt auszuweisen und rechtlich noch final freizugeben.
- Der Betreiber darf zusätzlich einen normalen, getrennten Nutzer-/Verkäuferaccount verwenden und dort tatsächlich privat gehaltene Gegenstände als Privatverkäufer anbieten, sofern der konkrete Verkauf tatsächlich privat erfolgt. Betreiber-/Owner-Rechte und Verkäuferrolle sind technisch und organisatorisch getrennt zu behandeln; für eigene Angebote bestehen keine vorgesehenen Sondervorteile bei Moderation oder Streitbearbeitung.
- DUELVANTA darf in einer späteren Ausbaustufe eigene Waren im eigenen Namen als gewerblicher Verkäufer anbieten. Solche DUELVANTA-Eigenverkäufe gehören **nicht** zum ersten Marketplace-Release und müssen vor Aktivierung technisch, vertraglich, steuerlich und rechtlich eindeutig von vermittelten Drittangeboten getrennt und extern freigegeben werden.

### Technische Folge für den aktuellen B07-Stand

Für diese Entscheidung ist aktuell keine Produktcodeänderung erforderlich. Der bestehende Zielaufbau mit getrenntem Verkäuferstatus, Betreiberrolle und vermitteltem Checkout wird als Grundlage für die weitere L07-01-Ausarbeitung verwendet. Eine spätere Eigenverkaufsfunktion wird in B07 nicht vorgezogen und nicht implementiert.

### Externer Freigabepunkt

Zwingend extern freizugeben bleiben insbesondere:

- die konkrete rechtliche Einordnung der DUELVANTA-Vermittler-/Plattformrolle;
- die endgültige Vertragsbeziehung DUELVANTA ↔ Verkäufer und DUELVANTA ↔ Käufer;
- die wirksame Trennung Betreiberrolle ↔ privater Betreiber-Verkäuferaccount;
- die Plattform- und Verkäuferbedingungen;
- die später gesondert zu prüfende Architektur für DUELVANTA-Eigenverkäufe.

### Entscheidung L07-01/02 – Käuferkreis des ersten Marketplace-Releases

**Betreiberentscheidung:**

- Der erste kommerzielle Marketplace-Release richtet sich auf Käuferseite ausschließlich an private Käufer/Verbraucher.
- Gewerbliche beziehungsweise unternehmerische Käufe werden im ersten Release nicht angeboten und gehören nicht zum freizugebenden Release-Scope.
- Damit werden für den ersten Release auf Warenkaufebene nur die Zielkonstellationen C2C (privater Verkäufer → privater Käufer) und B2C (gewerblicher Verkäufer → privater Käufer) vorgesehen.
- B2B-Käufe bleiben eine mögliche spätere Ausbaustufe und müssen vor Aktivierung gesondert technisch, vertraglich, steuerlich und rechtlich geprüft und extern freigegeben werden.

### Technische Folge für den aktuellen B07-Stand

Der bestehende Checkout klassifiziert derzeit im Wesentlichen nach Verkäuferart. Diese Betreiberentscheidung legt nun den Ziel-Scope fest, ersetzt aber noch nicht die notwendige rechtliche und technische Abnahme, wie der Käuferstatus vor Vertragsschluss wirksam erhoben beziehungsweise der Käuferkreis verbindlich auf Verbraucher beschränkt wird. Eine Produktcodeänderung wird in diesem Schritt nicht vorgenommen.

### Externer Freigabepunkt

Zwingend extern freizugeben bleiben insbesondere:

- die rechtssichere vertragliche Beschränkung des Käuferkreises auf Verbraucher;
- die erforderliche Käufererklärung beziehungsweise das notwendige Prüf-/Hinweismodell vor Vertragsschluss;
- der Umgang mit Falschangaben oder tatsächlich unternehmerisch handelnden Käufern;
- die korrekte C2C-/B2C-Zuordnung und die daraus folgenden Pflichtinformationen.

### Entscheidung L07-01/03 – Gebührenmodell des ersten Marketplace-Releases

**Betreiberentscheidung:**

- Käufer zahlen im ersten kommerziellen Marketplace-Release keine gesonderte Gebühr an DUELVANTA.
- Für das Einstellen von Angeboten wird im ersten Release keine Einstellgebühr erhoben.
- Im ersten Release gibt es kein verpflichtendes Verkäufer-Abonnement.
- DUELVANTA soll nur bei einem tatsächlich erfolgreichen vermittelten Verkauf eine Verkaufsprovision vom Verkäufer erhalten.
- Die konkrete Höhe, Berechnungsbasis, Fälligkeit und steuerliche Behandlung dieser Verkäuferprovision sind mit dieser Entscheidung noch nicht festgelegt.

### Vertragsbeziehungen aus dieser Entscheidung

- Verkäufer ↔ Käufer: Kaufvertrag über die Ware und die unmittelbar zugehörige Lieferung beziehungsweise Übergabe.
- DUELVANTA ↔ Verkäufer: Plattform-/Vermittlungsvertrag; bei erfolgreichem Verkauf entsteht nach dem später freizugebenden Gebührenmodell die Verkäuferprovision zugunsten von DUELVANTA.
- DUELVANTA ↔ Käufer: Plattformnutzungsverhältnis ohne gesonderte Käufer-Transaktionsgebühr im ersten Release.

### Technische Folge für den aktuellen B07-Stand

Für die reine Festlegung des Gebührenmodells ist aktuell keine Produktcodeänderung erforderlich. Stripe Live, echte Zahlungen, Gebühreneinzug, Refunds und Payouts bleiben weiterhin deaktiviert. Die bereits vorbereitete Gebühren-/Stripe-Architektur ist vor Aktivierung gegen das final freigegebene Provisionsmodell zu prüfen.

### Externer Freigabepunkt

Zwingend extern beziehungsweise steuerlich zu prüfen bleiben insbesondere:

- rechtliche Ausgestaltung, Transparenz, Entstehung und Fälligkeit der Verkaufsprovision;
- konkrete Gebührenhöhe und Berechnungsbasis einschließlich Versand, Rabatten, Stornos, Refunds und Teilrückabwicklungen;
- Umsatzsteuer- und Rechnungsbehandlung der DUELVANTA-Provision gegenüber privaten und gewerblichen Verkäufern;
- Zahlungsdienst-/ZAG-Einordnung des tatsächlichen späteren Geldflusses;
- Stripe-Connect-, Gebühren-, Refund-, Chargeback- und Auszahlungskonfiguration vor Stripe Live.

### Entscheidung L07-01/04 – Länderumfang des ersten Marketplace-Releases

**Betreiberentscheidung:**

- Der erste kommerzielle Marketplace-Release wird auf Deutschland beschränkt.
- Käufer müssen für diesen Release eine deutsche Wohn-/Lieferadresse verwenden.
- Private und gewerbliche Verkäufer werden im ersten Release nur mit Wohnsitz beziehungsweise Sitz in Deutschland zugelassen.
- Österreich und die Schweiz bleiben technisch mögliche, aber nicht für Release 1 freigegebene spätere Erweiterungen.
- Grenzüberschreitende Verkäufe, Käufe und Versandkonstellationen gehören nicht zum freizugebenden Scope des ersten Releases.

### Technische Folge für den aktuellen B07-Stand

Die vorhandenen DACH-Auswahlmöglichkeiten im Verkäufer-Onboarding bleiben vorerst als technische Vorbereitung bestehen. Vor einem kommerziellen Release muss jedoch nachgewiesen werden, dass der tatsächlich freigegebene Produktivbetrieb Release 1 auf Deutschland begrenzt und nicht unbeabsichtigt AT-/CH- oder sonstige grenzüberschreitende Konstellationen zulässt. Diese Festlegung löst in diesem Dokumentationsschritt noch keine Produktcodeänderung aus.

### Externer Freigabepunkt

Für Release 1 extern freizugeben bleibt die konkrete deutsche Vertrags-, Plattform-, Verbraucher-, Datenschutz-, Steuer- und Zahlungsarchitektur. Österreich, Schweiz und sonstige grenzüberschreitende Konstellationen werden ausdrücklich nicht in die erste Freigabe einbezogen und benötigen vor späterer Aktivierung eine eigene rechtliche, steuerliche und technische Scope-Prüfung.

### Entscheidung L07-01/05 – Privater C2C-Tausch im ersten Marketplace-Release

**Betreiberentscheidung:**

- Der erste kommerzielle Marketplace-Release darf neben C2C- und B2C-Verkäufen auch reine Tauschgeschäfte zwischen privaten Nutzern enthalten.
- Zulässig ist in diesem Scope ausschließlich C2C-Tausch Ware gegen Ware zwischen privaten Nutzern.
- Gewerbliche beziehungsweise unternehmerische Tauschgeschäfte gehören nicht zum ersten Release.
- Mischgeschäfte mit zusätzlicher Geldzahlung, Aufpreis oder sonstigem Geldanteil neben der getauschten Ware gehören nicht zum ersten Release.
- Auf reine C2C-Tauschgeschäfte erhebt DUELVANTA im ersten Release keine Verkaufsprovision; ein späteres Gebührenmodell für Tauschgeschäfte ist nicht vorweggenommen.

### Vertragsbeziehung aus dieser Entscheidung

Beim reinen C2C-Tausch besteht der Tauschvertrag unmittelbar zwischen den beiden privaten Nutzern. DUELVANTA stellt die Plattform- und Vermittlungsfunktion bereit und wird nicht selbst Partei des Tauschvertrags.

### Technische Folge für den aktuellen B07-Stand

Der bereits vorhandene `trade`-Listing-Typ darf als technische Grundlage erhalten bleiben. Aus dieser Betreiberentscheidung folgt in diesem Dokumentationsschritt noch keine Codeänderung. Vor Release muss technisch sichergestellt werden, dass der freigegebene C2C-Tausch-Scope nicht unbeabsichtigt gewerbliche Tauschangebote oder Karte-plus-Geld-Konstellationen zulässt.

### Externer Freigabepunkt

Zwingend extern beziehungsweise steuerlich zu klären bleiben insbesondere:

- die konkrete vertragsrechtliche Abbildung des C2C-Tauschs und die anwendbaren Informations-/Plattformpflichten;
- PStTG-/DAC7-Einordnung reiner Ware-gegen-Ware-Tauschvorgänge einschließlich der Frage, ob und wie eine Vergütung beziehungsweise ein Wert für Reportingzwecke zu erfassen ist;
- die erforderliche Wert-/Nachweislogik, falls eine steuerliche oder regulatorische Erfassung notwendig ist;
- die klare Abgrenzung zu gewerblichen Tauschgeschäften und Mischgeschäften mit Geldanteil.

### Entscheidung L07-01/06 – Warenumfang des ersten Marketplace-Releases

**Betreiberentscheidung:**

- Der erste kommerzielle Marketplace-Release wird auf Trading-Card-Produkte beschränkt.
- Zulässig sind Einzelkarten, professionell gegradete Karten/Slabs und original versiegelte TCG-Produkte wie Booster, Displays, Boxen, ETBs und vergleichbare Sealed-Produkte.
- Zubehör, selbst hergestellte Produkte, 3D-Druck-Produkte, Kleidung, Elektronik, Lebensmittel, sonstiges Merchandise und andere nicht ausdrücklich freigegebene Produktkategorien gehören nicht zum ersten Release.
- Die Erweiterung um weitere Produktkategorien bleibt möglich, benötigt aber vor Aktivierung eine gesonderte rechtliche, technische und gegebenenfalls steuerliche Produkt-Scope-Prüfung.

### Technische Folge für den aktuellen B07-Stand

Die vorhandenen Marketplace-Strukturen für Karten, Slabs und Sealed-Produkte bilden den vorgesehenen Release-Scope ab. Aus dieser Betreiberentscheidung folgt in diesem Dokumentationsschritt keine Produktcodeänderung. Vor Release muss jedoch sichergestellt werden, dass nicht freigegebene Produktkategorien nicht unbeabsichtigt angeboten werden können.

### Externer Freigabepunkt

Für Release 1 extern zu prüfen bleiben insbesondere die auf diesen konkreten TCG-Warenumfang anwendbaren Produkt-, Informations- und Marketplace-Pflichten, einschließlich der bereits offenen GPSR-Fragen. Nicht freigegebene Produktgruppen sind ausdrücklich nicht Bestandteil der ersten anwaltlichen Produktfreigabe.

### Entscheidung L07-01/07 – Mindestalter für TRADE

**Betreiberentscheidung:**

- Kaufen, Verkaufen und C2C-Tauschen über TRADE ist im ersten kommerziellen Marketplace-Release ausschließlich volljährigen Nutzern ab 18 Jahren gestattet.
- Minderjährige dürfen im ersten Release keine Warenkauf-, Verkaufs- oder Tauschverträge über TRADE abschließen.
- Diese Altersgrenze betrifft den Marketplace-/TRADE-Vertragsschluss. Die Alters- und Zugangsregeln anderer DUELVANTA-Bereiche wie COLLECT oder BATTLE werden damit nicht vorweggenommen.

### Technische Folge für den aktuellen B07-Stand

Aus der Betreiberentscheidung folgt noch keine unmittelbare Produktcodeänderung. Vor kommerziellem Release muss jedoch ein rechtlich und technisch freigegebenes Verfahren sicherstellen, dass der TRADE-Vertragsschluss auf volljährige Nutzer beschränkt ist. Bestehende Altersdaten dürfen nicht ohne eigene Datenschutz-/Zweckprüfung zweckfremd verwendet werden.

### Externer Freigabepunkt

Zwingend extern zu prüfen bleiben insbesondere:

- wie die Volljährigkeit für den konkreten Marketplace-Scope angemessen und datenschutzkonform nachgewiesen beziehungsweise vertraglich abgesichert wird;
- welche Erklärung, Prüfung oder Altersverifikationsstufe erforderlich ist;
- der Umgang mit Falschangaben und nachträglich festgestellter Minderjährigkeit;
- die Abstimmung der Altersprüfung mit Verkäufer-Onboarding, Käuferstatus und späterem Zahlungsdienstleister.

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
