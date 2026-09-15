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

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
