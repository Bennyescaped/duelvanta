# DUELVANTA – B07 qualifizierte rechtliche Schlussprüfung

Stand: 15.09.2026

Status: **BLOCKIERT / NICHT GESCHLOSSEN**

Dieses Dokument ist ausschließlich die technische und rechtliche Vorbereitung für die in B07 verlangte qualifizierte externe Schlussprüfung. Es ist **keine anwaltliche Freigabe** und darf nicht als Go-Live-Freigabe verwendet werden.

## 1. Verbindlicher Prüfstand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- technischer Ausgangs-Head für B07: `236934602c20a4131cdf48ed76672bef560bbfe6`
- `main`: `50f88213571be13255bb52eb489cc28cca660001`, unverändert
- PR #5: open, Draft, nicht gemergt
- B01–B06: geschlossen; in B07 nicht erneut auditiert
- B08–B12: nicht begonnen
- Produktion, produktives Supabase, Stripe Live, Domains und `main`: nicht verändert

B07 ist nach V11/V9 verbindlich die **qualifizierte rechtliche Schlussprüfung**. Die detaillierte Rekonstruktion der bereits vorbereiteten Rechtsanforderungen erfolgt aus V5 und `MARKETPLACE_COMPLIANCE_REQUIREMENTS.md`; widersprechende technische Statusangaben älterer Handouts sind nicht maßgeblich.

## 2. Ergebnis

B07 kann am 15.09.2026 nicht geschlossen werden.

Primärer Abschlussblocker ist das Fehlen einer dokumentierten qualifizierten Rechtsfreigabe für die konkrete aktuelle Fassung von Plattformmodell, Verkäuferbedingungen, C2C/B2C-Vertragsschluss, Widerruf, Bestellbestätigung, DSA-Anwendbarkeit, Datenschutz, Auftragsverarbeitung, Drittlandtransfers und Consent.

Zusätzlich bestehen in der aktuellen Implementierung mehrere konkrete rechtliche Prüflücken, die vor einer Freigabe geklärt beziehungsweise nach qualifizierter Vorgabe korrigiert werden müssen.

## 3. Konkrete B07-Befunde

### L07-01 – Verkäuferbedingungen werden akzeptiert, ein freigegebener Bedingungstext fehlt

**Befund:**

- `seller-onboarding.html` verlangt die Checkbox „Ich akzeptiere die Verkäuferbedingungen“.
- Die Datenbank versioniert die Zustimmung als `seller-beta-2026-09`.
- Im aktuellen Repository existiert jedoch kein eigener freigegebener und für den Verkäufer erreichbarer Dokumenttext für diese Verkäuferbedingungen und kein Link aus der Zustimmung auf eine solche Fassung.
- Ebenfalls existieren keine allgemeinen Plattformbedingungen, die insbesondere Moderationsregeln, Sperren, Vertragsrollen und Verfahrensregeln vollständig beschreiben.

**Rechtlicher Bezug:** DSA Art. 14 verlangt für Vermittlungsdienste klare, öffentlich verfügbare Bedingungen zu Beschränkungen und Content-Moderation. Für eine beweissichere Zustimmung muss außerdem feststehen, welchem konkreten Inhalt die dokumentierte Versionsnummer entspricht.

**Folge:** Freigabe nicht möglich.

**Minimale Gegenmaßnahme:** Qualifizierte Rechtsprüfung erstellt/freigibt Plattformbedingungen und Verkäuferbedingungen; anschließend wird genau diese Fassung versioniert, verlinkt und beweissicher der gespeicherten Zustimmung zugeordnet.

### L07-02 – Verhandlungsangebot kann automatisch zum bindenden B2C-Vertrag werden

**Befund:**

- Der Käufer sendet bei Verhandlungsbasis über „PREISANGEBOT SENDEN“ ein Preisangebot.
- Die UI erklärt: „Bei Annahme entsteht automatisch eine Bestellung.“
- `respond_to_market_offer(...)` erzeugt bei Annahme durch den Verkäufer unmittelbar einen akzeptierten Deal; der Käufer erhält vor diesem automatischen Vertragsschluss keinen separaten finalen B2C-Checkout mit der bereits beim Festpreis vorhandenen Schaltfläche „Zahlungspflichtig bestellen“.
- Der Festpreis-Checkout besitzt dagegen den hervorgehobenen Abschlussbutton und die serverseitige Vertragsprüfung.

**Rechtlicher Bezug:** § 312j BGB verlangt bei zahlungspflichtigen Verbraucherverträgen im elektronischen Geschäftsverkehr unmittelbar vor der Verbraucherbestellung hervorgehobene Pflichtinformationen sowie eine eindeutige Bestätigung der Zahlungspflicht; bei einer Schaltfläche gilt insbesondere „zahlungspflichtig bestellen“ oder eine entsprechend eindeutige Formulierung.

**Folge:** Für gewerblichen Verkäufer + Verbraucher ist der aktuelle Verhandlungsflow rechtlich nicht freigegeben.

**Minimale Gegenmaßnahme:** Qualifizierte Rechtsprüfung legt verbindlich fest, ob das Preisangebot selbst bindende Verbraucherbestellung sein soll. Entweder erhält der Flow vor Abgabe die vollständige B2C-Bestellsituation einschließlich rechtskonformer Button-Lösung, oder die Preisverhandlung bleibt unverbindlich und ein gesonderter finaler Checkout bildet erst den Vertrag.

### L07-03 – B2C-Widerrufsrecht und elektronische Widerrufsfunktion fehlen

**Befund:**

- Der aktuelle B2C-Checkout enthält keine Widerrufsbelehrung und kein Muster-Widerrufsformular.
- Es existiert keine für B2C-Orders zugeordnete elektronische Widerrufsfunktion.
- Die Bestellbestätigung enthält nach dem aktuellen Vertrags-Snapshot keine ersichtliche Widerrufsbelehrung.

**Rechtlicher Bezug:** Art. 246a § 1 Abs. 2 EGBGB verlangt bei bestehendem Widerrufsrecht Informationen zu Bedingungen, Frist und Verfahren sowie das Muster-Widerrufsformular. § 356a BGB verlangt für über eine Online-Benutzeroberfläche geschlossene Fernabsatzverträge eine ständig verfügbare, hervorgehoben platzierte elektronische Widerrufsfunktion mit Bestätigungsfunktion und unverzüglicher Eingangsbestätigung auf dauerhaftem Datenträger.

**Folge:** B2C-Go-Live derzeit gesperrt.

**Minimale Gegenmaßnahme:** Anwaltlich freigegebene Widerrufsbelehrung, Musterformular und Verantwortungszuordnung Verkäufer/Plattform; danach Umsetzung der §-356a-Funktion exakt nach der freigegebenen Vertragsarchitektur.

### L07-04 – Dauerhafter Datenträger / Bestellbestätigung noch nicht abschließend freigegeben

**Befund:**

- `market_contract_snapshots` hält einen unveränderbaren Vertragsnachweis und Bestätigungstext vor.
- Eine Message-Outbox für `order_confirmation` ist vorhanden.
- Der Nachrichten-Dispatcher ist für den Release weiterhin standardmäßig deaktiviert; allein die Abrufbarkeit im Account ist noch nicht qualifiziert als rechtssicherer dauerhafter Datenträger bestätigt.

**Rechtlicher Bezug:** § 312f Abs. 2 BGB verlangt bei Fernabsatzverträgen die Vertragsbestätigung innerhalb angemessener Frist auf einem dauerhaften Datenträger und gegebenenfalls die Informationen nach Art. 246a EGBGB.

**Folge:** Technische Grundlage vorhanden, rechtliche Abnahme des tatsächlichen Zustellwegs fehlt.

**Minimale Gegenmaßnahme:** Rechtsprüfung bestimmt den verbindlichen dauerhaften Datenträger und den Mindestinhalt; Engineering aktiviert später nur den bereits vorgesehenen, freigegebenen Zustellweg im dafür vorgesehenen Rolloutblock.

### L07-05 – Online-Marktplatz-Informationspflichten nur teilweise abgebildet

**Befund:**

- Verkäufer werden als privat/gewerblich klassifiziert und der Checkout zeigt C2C/B2C sowie den Vertragspartner.
- Die Marktansicht bietet Sortierung nach „Neueste“, „Preis aufsteigend“ und „Beste Deals“; „Deal of the Day“ wird nach Abweichung vom gespeicherten Marktpreis ausgewählt.
- Eine allgemeine, leicht zugängliche Information über die Hauptparameter des Rankings und deren relative Gewichtung ist nicht vorhanden.
- Für private Verkäufer existiert bereits ein Hinweis, dass DUELVANTA Vermittler ist und besondere B2C-Pflichten nicht als Plattformleistung dargestellt werden; die endgültige Verbraucherformulierung ist jedoch nicht qualifiziert freigegeben.

**Rechtlicher Bezug:** Art. 246d § 1 EGBGB verlangt insbesondere Informationen zu Rankingparametern und deren relativer Gewichtung sowie zur Unternehmererklärung des Anbieters und bei Nicht-Unternehmern dazu, dass besondere Verbrauchervertragsvorschriften nicht anwendbar sind.

**Folge:** Rechtliche Schlussfreigabe offen.

**Minimale Gegenmaßnahme:** Rechtsprüfung freigibt eine Marketplace-Informationsseite beziehungsweise entsprechende Checkout-/Suchhinweise anhand der realen Sortierlogik.

### L07-06 – Käuferrolle wird nicht als Verbraucher/Unternehmer festgelegt

**Befund:**

- Die vorbereitete Rechtsarchitektur trennt private und gewerbliche Verkäufer.
- `review_market_checkout(...)` klassifiziert einen Verkauf eines gewerblichen Verkäufers derzeit allein aufgrund der Verkäuferart als `b2c`.
- Der Käuferstatus als Verbraucher oder Unternehmer wird weder erhoben noch durch öffentlich vorhandene Plattformbedingungen auf Verbraucher beschränkt.

**Folge:** Ein geschäftlich kaufender Nutzer könnte technisch als B2C behandelt werden; umgekehrt fehlt eine rechtsverbindliche Festlegung, dass Käufer ausschließlich als Verbraucher handeln dürfen.

**Minimale Gegenmaßnahme:** Qualifizierte Rechtsprüfung entscheidet die Zielarchitektur: entweder Käuferseite vertraglich auf Verbraucher beschränken oder die konkrete Käuferrolle vor Vertragsschluss erfassen und die Informations-/Checkoutlogik entsprechend unterscheiden.

### L07-07 – DSA-Grundpflichten und Kleinunternehmensausnahmen müssen verbindlich eingeordnet werden

**Positiver Stand:**

- Ein elektronisches Notice-and-Action-Verfahren für konkrete Angebote ist vorhanden.
- Meldungen enthalten Angebotsbezug, Begründung, Kontaktdaten, Kategorie und weitere Belege; Entscheidung und Einspruch sind technisch vorbereitet.

**Offen:**

- Keine öffentlich ausgewiesene DSA-Kontaktstelle für Behörden mit Kommunikationssprachen gemäß Art. 11.
- Keine ausdrücklich ausgewiesene Nutzer-Kontaktstelle gemäß Art. 12.
- Keine allgemeinen Bedingungen nach Art. 14 mit vollständigen Moderations-/Beschränkungsregeln.
- Die genaue DSA-Einordnung als Vermittlungs-/Hosting-/Onlineplattform sowie die Anwendung der Kleinst-/Kleinunternehmensausnahmen ist nicht qualifiziert bestätigt.

**Rechtlicher Bezug:**

- DSA Art. 11–14 enthalten Grundpflichten für Vermittlungsdienste.
- DSA Art. 16/17 betreffen Notice-and-Action und Begründungen bei Hostingdiensten.
- Art. 19 nimmt Kleinst-/Kleinunternehmen grundsätzlich von Abschnitt 3 der zusätzlichen Onlineplattformpflichten aus.
- Art. 29 nimmt Kleinst-/Kleinunternehmen grundsätzlich von Abschnitt 4, darunter Art. 30–32 für Online-Marktplätze, aus; VLOPs sind ausgenommen.
- Die Grundpflichten aus den vorherigen Abschnitten werden dadurch nicht pauschal aufgehoben.

**Folge:** B07 nicht freigabefähig, solange die konkrete Größen-/Dienste-Einordnung und die daraus folgende Pflichtenliste nicht schriftlich bestätigt ist.

**Minimale Gegenmaßnahme:** Qualifizierter Rechtsprüfer dokumentiert die konkrete DSA-Rolle von DUELVANTA, die anwendbaren Ausnahmen sowie die verbleibenden Pflichten. B08–B12 werden hierfür nicht vorgezogen.

### L07-08 – Datenschutzerklärung bildet den aktuellen Funktionsumfang nicht vollständig ab

**Befund:**

`datenschutz.html` ist eine Beta-Fassung und enthält selbst den Hinweis, dass sie vor kommerziellem Start unter anderem für integrierte Zahlungen, Auszahlungen und Webcam-Arena erneut erweitert/rechtlich geprüft werden muss.

Aktuell nicht beziehungsweise nicht hinreichend konkret beschrieben sind insbesondere:

- Verkäufer-Onboarding mit Geburtsdatum, Privatanschrift, Steueransässigkeit und Händlerangaben;
- Offenlegung von Verkäufer-Vertragsdaten im Checkout;
- Notice-and-Action-/Einspruchsdaten;
- konkrete Aufbewahrungslogik nach Datenkategorien;
- aktive BATTLE-Webcam-/Mikrofonfunktion;
- WebRTC-Signalisierung sowie die in `battle-webrtc.js` verwendeten Google-STUN-Endpunkte `stun.l.google.com` und `stun1.l.google.com`;
- Drittanbieter-CDN-Abrufe über `cdn.jsdelivr.net` auf mehreren App-Seiten;
- bei aktivierter KI-Scannerfunktion die Übermittlung des komprimierten Kartenfotos an OpenAI;
- konkrete Transfermechanismen und Bezugswege für Garantien bei Drittlandübermittlungen.

**Rechtlicher Bezug:** Art. 13 DSGVO verlangt unter anderem Zwecke und Rechtsgrundlagen, Empfänger/Kategorien von Empfängern, Drittlandübermittlungen und Garantien sowie Speicherfristen oder deren Kriterien. Art. 28 DSGVO verlangt einen bindenden Auftragsverarbeitungsvertrag, soweit ein Dienstleister als Auftragsverarbeiter eingesetzt wird. Art. 44 ff. DSGVO regelt Drittlandtransfers.

**Folge:** Aktuelle Datenschutzerklärung nicht als finale Releasefassung freigeben.

**Minimale Gegenmaßnahme:** Verarbeitungsverzeichnis für den tatsächlichen Releaseumfang finalisieren; Rechtsprüfung legt je Verarbeitung Zweck, Rechtsgrundlage, Empfängerrolle, Frist, Drittlandmechanismus und Betroffeneninformation fest; anschließend erst Datenschutzerklärung angleichen.

### L07-09 – Dienstleisterverträge und Drittlandtransfers sind nicht vollständig nachgewiesen

**Befund:**

- Supabase stellt einen DPA/SCC-Rahmen bereit; im Repository liegt jedoch kein privater Nachweis darüber, welche konkrete Vertragsfassung für den Betreiber wirksam einbezogen ist. Solche privaten Unterlagen sollen auch nicht in das öffentliche Repository eingecheckt werden.
- Der öffentlich aktuelle Vercel-DPA erklärt seine Geltung für Pro- und Enterprise-Kunden. B07 enthält keinen privaten Nachweis, dass der für DUELVANTA tatsächlich verwendete Vertrag/Tarif diesen Art.-28-Rahmen wirksam einbezieht. Eine Tarifentscheidung selbst gehört weiterhin zu B10 und wird in B07 nicht vorgenommen.
- Für Google-STUN und jsDelivr ist im B07-Stand weder die datenschutzrechtliche Rollenverteilung noch ein dokumentierter Transfer-/Vertragsnachweis für DUELVANTA vorhanden.
- Stripe wird in B07 nicht live freigeschaltet; dessen produktive Rollen-/Vertragsprüfung bleibt der dafür vorgesehenen späteren Freigabe vorbehalten.

**Folge:** Auftragsverarbeitung und Transfers können nicht qualifiziert abgenommen werden.

**Minimale Gegenmaßnahme:** Außerhalb des öffentlichen Repositorys ein datiertes Provider-/DPA-/SCC-/Subprocessor-Register mit Vertragsstatus und Transfergrundlage führen und dem Rechtsprüfer vorlegen. Keine Tarif- oder Live-Aktivierung im Rahmen von B07.

### L07-10 – Consent/TDDDG: aktueller Grundansatz plausibel, Schlussprüfung fehlt

**Befund:**

- Die Warteliste verwendet eine ausdrückliche, nicht vorausgewählte Zustimmung zur E-Mail-Verarbeitung.
- Die Datenschutzerklärung behauptet aktuell keine Analyse-/Marketing-Cookies.
- Authentifizierungs-/Session-Speicherung ist für den ausdrücklich gewünschten Login technisch erforderlich.
- Eine vollständige Inventur aller Endeinrichtungszugriffe und optionalen Drittanbieterdienste liegt als rechtlich freigegebene Matrix nicht vor.

**Rechtlicher Bezug:** § 25 TDDDG verlangt grundsätzlich Einwilligung für Speichern/Auslesen in Endeinrichtungen, mit Ausnahmen insbesondere für unbedingt erforderliche Vorgänge zur Bereitstellung eines ausdrücklich gewünschten digitalen Dienstes.

**Folge:** Kein pauschales Consent-Banner wird allein aufgrund dieses Befunds verlangt; die rechtliche Klassifizierung der tatsächlichen Speicher-/Abrufvorgänge muss jedoch vor Release schriftlich abgeschlossen sein.

**Minimale Gegenmaßnahme:** Rechtsprüfer bestätigt die technische Consent-Matrix; nur für tatsächlich einwilligungspflichtige, nicht notwendige Funktionen wird Consent vorgesehen.

### L07-11 – Impressum ist als Basis vorhanden, finale Betreiberangaben bleiben abhängig von B09

**Befund:**

`impressum.html` enthält Name, ladungsfähige Anschrift und E-Mail des Betreibers sowie den Bezug auf § 5 DDG. Register-/USt-ID-/Unternehmensangaben können erst nach final feststehendem Betreiberstatus zuverlässig vervollständigt werden.

**Folge:** Kein technischer B07-Fix. Die rechtliche Endfassung bleibt von den später nachgewiesenen Betreiberangaben abhängig; B09 wird in diesem Block nicht begonnen.

## 4. Bereits geeignete Grundlagen

Folgende vorhandene Bausteine sind aus technischer Sicht gute Grundlage für die externe Rechtsprüfung und sollen nicht ohne konkrete rechtliche Vorgabe neu gebaut werden:

- getrennte Verkäuferklassifikation `private` / `trader`;
- getrennte private Händler-/Steuerdaten;
- Händlerprüfung und serverseitige Verkaufsfreigabe;
- C2C/B2C-Vertragssnapshot;
- exakte Preis-/Versand-/Produkt-Snapshots;
- Festpreis-Button „Zahlungspflichtig bestellen“;
- unveränderbarer Vertragsnachweis;
- Notice-and-Action mit Begründung und Einspruch;
- Datenexport-/Lösch-/Retention-Grundlage;
- keine pauschale Aktivierung von Analyse-/Marketingtracking;
- kein produktiver Stripe-/Refund-/Payout-Start im Rahmen von B07.

Diese technische Vorbereitung ersetzt die qualifizierte Rechtsfreigabe nicht.

## 5. Verbindliche B07-Abschlusskriterien

B07 darf erst als **geschlossen** markiert werden, wenn mindestens folgende private, datierte Evidenz vorliegt:

1. schriftliche qualifizierte Rechtsfreigabe für die konkrete DUELVANTA-Marktplatz-/Plattformarchitektur;
2. freigegebene Plattformbedingungen und Verkäuferbedingungen mit eindeutiger Versionszuordnung;
3. freigegebener C2C-/B2C-Vertragsschluss einschließlich Festpreis- und Verhandlungsflow;
4. freigegebene B2C-Widerrufsbelehrung, Musterformular und §-356a-Widerrufsfunktion;
5. bestätigter Inhalt und Zustellweg der Bestellbestätigung auf dauerhaftem Datenträger;
6. freigegebene Online-Marktplatzinformationen einschließlich Ranking und Verkäuferstatus;
7. schriftliche DSA-Einordnung einschließlich Art. 11–18 sowie dokumentierter Entscheidung zu Art. 19/29 und gegebenenfalls Art. 30–32;
8. finale Datenschutzerklärung gegen den realen Release-Verarbeitungsumfang;
9. privates Provider-/DPA-/SCC-/Transferregister mit geklärten Rollen und anwendbaren Garantien;
10. freigegebene Consent-/TDDDG-Matrix;
11. final bestätigte Betreiberangaben werden später aus B09 übernommen, ohne B09 hier vorwegzunehmen.

Die Rechtsfreigabe sollte den geprüften Repository-/Dokumentstand eindeutig referenzieren. Sensible Vertrags- oder Identitätsunterlagen dürfen nicht in das öffentliche Repository eingecheckt werden; im Repository genügt anschließend ein nicht-sensitiver Freigabevermerk mit Datum, Prüfumfang und referenzierter Dokumentversion.

## 6. Stop-Regel

B07 bleibt offen. Es wurden bewusst keine ungeprüften AGB, Verkäuferbedingungen, Widerrufstexte oder Datenschutzformulierungen als vermeintlich finale Rechtsfassung in die Anwendung eingebaut.

Keine neuen Features, keine Produktionsänderung, kein Merge, keine Migration und keine Arbeit an B08–B12.

Ein neues Masterhandout V13 wird **nicht** erstellt, solange B07 nicht nach den obigen Kriterien vollständig und nachweisbar geschlossen ist.
