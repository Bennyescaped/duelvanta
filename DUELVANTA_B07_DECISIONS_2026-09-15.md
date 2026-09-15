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

**B07-Status nach diesen Entscheidungen: unverändert OFFEN / BLOCKIERT.**
