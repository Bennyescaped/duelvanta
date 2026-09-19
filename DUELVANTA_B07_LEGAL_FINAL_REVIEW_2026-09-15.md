# DUELVANTA – B07 qualifizierte rechtliche Schlussprüfung

Stand: 15.09.2026  
Vertiefungsprüfung: 15.09.2026  
Status: **OFFEN / BLOCKIERT DURCH QUALIFIZIERTE EXTERNE RECHTSFREIGABE**

Dieses Dokument ist ausschließlich die technische und rechtliche Vorbereitung der in B07 verlangten qualifizierten externen Schlussprüfung. Es ist **keine anwaltliche oder steuerliche Freigabe** und darf nicht als Go-Live-Freigabe verwendet werden.

## 1. Verbindlicher Prüfstand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- B07-Dokumentations-Head vor dieser Vertiefung: `445693549566dff82df5c664aa7a12040a71dcc5`
- letzter technischer Post-V12-Stand: `236934602c20a4131cdf48ed76672bef560bbfe6`
- `main`: `50f88213571be13255bb52eb489cc28cca660001`, unverändert
- PR #5: open, Draft, nicht gemergt; Base `main`, Head `marketplace-ux-v1`
- B01–B06: geschlossen und in B07 nicht erneut auditiert
- B08–B12: nicht begonnen
- Scanner V16 Check #284 / Run-ID `34985488806`: vorhandener Erfolgsnachweis; nicht erneut ausgelöst
- Produktion, Produktions-Supabase, Stripe Live, Domains, `main`, `database/auth-privileged-step-up-v1.sql`, `v-logo.svg` und Slogan: nicht verändert

Maßgeblich sind V12, das dokumentierte Post-V12-Delta und der genannte aktuelle Repository-Stand. Abweichende technische Statusangaben älterer Handouts sind nicht maßgeblich.

## 2. Methode und Einordnung

Die Vertiefung ordnet jeden Punkt ausdrücklich ein:

- **Sicher feststellbare Anforderung:** Der Norminhalt ist für den beschriebenen Fall hinreichend eindeutig. Ob DUELVANTA alle Tatbestandsvoraussetzungen erfüllt, kann dennoch vom finalen Modell abhängen.
- **Geschäftsmodellabhängige Rechtsfrage:** Betreiberrolle, Nutzerkreis, Größe, Vertrags- und Zahlungsfluss oder tatsächliche Datenverarbeitung entscheiden über Anwendbarkeit und Umsetzung.
- **Externe Freigabe:** Eine qualifizierte anwaltliche beziehungsweise steuerliche Entscheidung oder Textfreigabe ist zwingend; dieses Dokument ersetzt sie nicht.

Risikoklassen:

- **R0 – Release-Blocker:** Vertragsschluss oder Plattformbetrieb darf in der betroffenen Konstellation nicht live gehen.
- **R1 – hoch:** erhebliche Abmahn-, Behörden-, Haftungs-, Bußgeld- oder Unwirksamkeitsgefahr; vor Release verbindlich klären.
- **R2 – mittel:** dokumentations- oder prozessbezogener Mangel, der vor Release vollständig erledigt werden muss.

## 3. Ergebnis

B07 kann am 15.09.2026 nicht geschlossen werden. Es fehlt die nach V9/V11/V12 verlangte, auf den konkreten DUELVANTA-Stand bezogene qualifizierte anwaltliche und – für die Steuerpunkte – steuerliche Schlussfreigabe. Zusätzlich bestehen die nachfolgenden realen Freigabelücken.

Die vorhandene Datei `MARKETPLACE_COMPLIANCE_REQUIREMENTS.md` ist eine verbindliche Entwicklungsgrundlage, aber weder Rechtsgutachten noch externe Freigabe.

## 4. Konkrete B07-Befunde

### L07-01 – Verkäufer-/Plattformbedingungen fehlen trotz versionierter Zustimmung

**Risikoklasse:** R0  
**Einordnung:** sichere Anforderungen aus § 305 Abs. 2 BGB und DSA Art. 14; Inhalt, Rollenmodell und Klauselwirksamkeit geschäftsmodellabhängig; externe Text- und Modellfreigabe zwingend.

**Befund:** `seller-onboarding.html` verlangt „Ich akzeptiere die Verkäuferbedingungen“; die Datenbank speichert `seller-beta-2026-09`. Ein erreichbarer, dieser Version eindeutig zugeordneter und freigegebener Bedingungstext fehlt. Die UI sagt zugleich „In der Entwicklungsphase noch kein Vertragsschluss“. Allgemeine Plattformbedingungen mit Betreiber-/Vermittlerrolle, Leistungsumfang, Moderation, Sperren, Beendigung, Beschwerdewegen, Datenzugang und Vertragsrollen fehlen ebenfalls.

**Rechtsgrundlage:** § 305 Abs. 2 BGB verlangt Hinweis, zumutbare Kenntnisnahmemöglichkeit und Einverständnis für die Einbeziehung von AGB. DSA Art. 14 verlangt klare, verständliche, nutzerfreundliche und öffentlich zugängliche Bedingungen zu Beschränkungen und Moderation.

**Notwendige Gegenmaßnahme:** Qualifiziert freigegebene Plattform- und Verkäuferbedingungen erstellen; konkrete Fassung dauerhaft erreichbar verlinken; Versionsinhalt, Geltungszeitraum und Zustimmung beweissicher verbinden. Keine ungeprüften Mustertexte produktiv verwenden.

**Externe Freigabe:** zwingend durch Rechtsanwalt; steuerliche Klauseln zusätzlich durch Steuerberater.

### L07-02 – Verhandlungsangebot kann ohne finalen B2C-Schritt zum bindenden Vertrag werden

**Risikoklasse:** R0  
**Einordnung:** § 312j BGB ist bei einer zahlungspflichtigen Verbraucherbestellung sicher; welche Willenserklärung bereits bindend ist, hängt von der freigegebenen Vertragsarchitektur ab; externe Freigabe zwingend.

**Befund:** Der Käufer sendet über „PREISANGEBOT SENDEN“ ein Angebot. Die UI erklärt, bei Verkäuferannahme entstehe automatisch eine Bestellung. `respond_to_market_offer(...)` erzeugt bei Annahme unmittelbar den Deal. Anders als beim Festpreisflow erhält der Käufer danach keinen finalen Checkout mit den unmittelbar vor der Bestellung erforderlichen Informationen und keiner eindeutigen abschließenden Zahlungspflicht-Erklärung. Der vorhandene Festpreisbutton „Zahlungspflichtig bestellen“ behebt diesen gesonderten Flow nicht.

**Rechtsgrundlage:** § 312j Abs. 2–4 BGB; die Schaltflächenpflicht ist Wirksamkeitsvoraussetzung des Verbrauchervertrags, wenn die Bestellung über eine Schaltfläche erfolgt.

**Notwendige Gegenmaßnahme:** Rechtsanwalt legt verbindlich eine von zwei Architekturen fest: (a) das Käuferangebot selbst wird als vollständige, rechtssichere B2C-Bestellsituation einschließlich Pflichtinformationen und eindeutiger Button-Lösung gestaltet, oder (b) die Verhandlung bleibt unverbindlich und erst ein nachgelagerter vollständiger Checkout enthält die bindende Käufererklärung. Erst danach minimal technisch umsetzen.

**Externe Freigabe:** zwingend; B2C-Verhandlungsflow bis dahin nicht releasefähig.

### L07-03 – Vollständige B2C-Pflichtinformationen fehlen

**Risikoklasse:** R0  
**Einordnung:** Informationspflichten sind sicher; konkrete Pflichtmenge hängt von Ware, Verkäufer, Liefergebiet, Zahlungsmittel und Vertragsmodell ab; externe Freigabe zwingend.

**Befund:** Der Checkout zeigt bereits Vertragspartner, C2C/B2C-Einordnung, Artikel, Preis, Versand und Gesamtsumme. Nicht vollständig und nicht qualifiziert freigegeben sind insbesondere Unternehmeridentität/-anschrift/-kontakt, Liefer- und Zahlungsbedingungen, Liefertermin, Mängelhaftungsrecht, Beschwerdeverfahren, gegebenenfalls Garantien, Laufzeit/Kündigung, digitale Funktionalität sowie sämtliche anwendbaren Verbraucherinformationen. Für die elektronische Bestellung fehlen außerdem freigegebene Informationen zu Vertragsschritten, Vertragstextspeicherung/-zugang, Korrekturmitteln und Vertragssprache.

**Rechtsgrundlage:** Art. 246a § 1 EGBGB, §§ 312d, 312i und 312j BGB sowie Art. 246c EGBGB.

**Notwendige Gegenmaßnahme:** Anwaltliche Pflichtinformationsmatrix je C2C/B2C/B2B-Konstellation und Waren-/Lieferfall; erst danach Checkout, Listing und Bestätigung exakt gegen diese Matrix ergänzen.

**Externe Freigabe:** zwingend.

### L07-04 – Widerrufsbelehrung, Musterformular und elektronische Widerrufsfunktion fehlen

**Risikoklasse:** R0  
**Einordnung:** bei bestehendem B2C-Widerrufsrecht sichere Anforderungen; Ausnahmen, Verantwortlichkeit und Beginn der Frist sind fallabhängig; externe Text-/Prozessfreigabe zwingend.

**Befund:** B2C-Checkout und Vertrags-Snapshot enthalten keine freigegebene Widerrufsbelehrung und kein Muster-Widerrufsformular. Eine einer B2C-Order zugeordnete elektronische Widerrufsfunktion ist nicht vorhanden.

**Rechtsgrundlage:** Art. 246a § 1 Abs. 2 EGBGB und § 356a BGB. Die elektronische Funktion muss erreichbar und hervorgehoben sein, eine eindeutige Erklärung ermöglichen und den Eingang unverzüglich auf dauerhaftem Datenträger bestätigen.

**Notwendige Gegenmaßnahme:** Anwaltlich freigegebene Belehrung, Musterformular, Ausnahme-/Fristenlogik und Verantwortungszuordnung Verkäufer/Plattform; danach §-356a-Prozess einschließlich Eingangsbestätigung minimal technisch umsetzen.

**Externe Freigabe:** zwingend.

### L07-05 – Dauerhafter Datenträger / Vertragsbestätigung nicht releasefähig nachgewiesen

**Risikoklasse:** R0  
**Einordnung:** Pflicht nach § 312f Abs. 2 BGB sicher; zulässiger Zustellweg und Inhalt hängen von Architektur und bereits erteilten Informationen ab; externe Freigabe zwingend.

**Befund:** `market_contract_snapshots` hält einen unveränderbaren Vertragsnachweis vor; eine Outbox für `order_confirmation` existiert. Der Dispatcher ist standardmäßig deaktiviert. Bloße Account-Abrufbarkeit ist nicht als dauerhafter Datenträger qualifiziert abgenommen; Versand, Zugang, Wiederabruf und vollständiger Inhalt sind nicht nachgewiesen.

**Notwendige Gegenmaßnahme:** Rechtsprüfung bestimmt Mindestinhalt und Zustellweg; technische Abnahme muss tatsächliche Ausgabe, unveränderte spätere Zugänglichkeit und Zeitstempel belegen. Keine Aktivierung in B07.

**Externe Freigabe:** zwingend.

### L07-06 – Online-Marktplatzinformationen und Rankingtransparenz sind unvollständig

**Risikoklasse:** R0 für B2C-Marktplatzinformationen, sonst R1  
**Einordnung:** Art. 246d § 1 EGBGB ist für Online-Marktplätze mit Verbrauchern sicher; konkrete Darstellung und Rankingbeschreibung sind modellabhängig; externe Freigabe zwingend.

**Befund:** Verkäufer werden als privat/gewerblich klassifiziert; Checkout zeigt Vertragspartner und C2C/B2C. Sortierungen „Neueste“, „Preis aufsteigend“, „Beste Deals“ sowie „Deal of the Day“ sind vorhanden. Eine leicht zugängliche Beschreibung der Hauptparameter und ihrer relativen Gewichtung fehlt. Ebenfalls nicht final freigegeben sind Unternehmererklärung, Hinweis auf Nichtanwendbarkeit des Verbraucherschutzrechts bei Privatverkäufern, Verteilung vertraglicher Pflichten und Aussage, welche Ansprüche gegen DUELVANTA bestehen oder nicht bestehen.

**Notwendige Gegenmaßnahme:** Rechtsfreigegebene Marketplace-Informationsseite und kontextbezogene Hinweise anhand der realen Algorithmen; keine abstrakten oder unzutreffenden Rankingsangaben.

**Externe Freigabe:** zwingend.

### L07-07 – Käuferstatus und C2C/B2C/B2B-Zuordnung sind nicht rechtlich festgelegt

**Risikoklasse:** R0  
**Einordnung:** Verbraucher-/Unternehmereigenschaft ist tatbestandsabhängig; Zielnutzerkreis und Nachweisverfahren sind Geschäftsmodellentscheidung; externe Freigabe zwingend.

**Befund:** `review_market_checkout(...)` klassifiziert allein nach Verkäuferart: `trader` führt zu `b2c`. Käuferstatus wird nicht erhoben; Plattformbedingungen beschränken die Käuferseite nicht verbindlich auf Verbraucher. Dadurch kann ein geschäftlich handelnder Käufer falsch als Verbraucher behandelt werden; zugleich ist die private/gewerbliche Verkäufer-Selbsterklärung allein noch kein abschließend freigegebener Statusnachweis.

**Notwendige Gegenmaßnahme:** Zielarchitektur rechtlich festlegen: Käufer vertraglich auf Verbraucher beschränken oder Käuferstatus vor Vertragsschluss erfassen und B2B sauber abbilden; Verkäuferstatusprüfung und Änderungs-/Missbrauchsprozess freigeben.

**Externe Freigabe:** zwingend.

### L07-08 – DSA-Rolle, Kontaktstellen, Bedingungen und Meldepflichten sind nicht abgeschlossen

**Risikoklasse:** R0  
**Einordnung:** DSA-Grundpflichten sind bei jeweiliger Dienste-Rolle sicher; Einordnung als Vermittlungs-/Hosting-/Onlineplattformdienst und Größen-Ausnahmen sind geschäftsmodellabhängig; externe Freigabe zwingend.

**Positiver technischer Stand:** Das Notice-and-Action-Schema erfasst Angebotsbezug, Begründung, Melderkontakt, Kategorie, behauptete Rechtsgrundlage, konkrete URL, Belege und Gutgläubigkeitsbestätigung; Entscheidung, Begründung und Einspruch sind vorbereitet. Damit sind wesentliche Eingabeelemente von Art. 16 DSA technisch adressiert.

**Offen:**

- öffentliche Behörden-Kontaktstelle und Kommunikationssprachen nach Art. 11;
- leicht zugängliche Nutzer-Kontaktstelle nach Art. 12;
- Bedingungen nach Art. 14;
- Transparenzbericht nach Art. 15 einschließlich ausdrücklicher Prüfung der dortigen Klein-/Kleinstunternehmensausnahme;
- operativer Prozess für Meldung eines Verdachts auf Straftaten mit Gefahr für Leben oder Sicherheit an Behörden nach Art. 18;
- vollständige rechtliche Abnahme von Art. 16/17 einschließlich Bearbeitung, Begründung, Zustellung und Rechtsbehelfen;
- schriftliche Entscheidung, welche zusätzlichen Onlineplattformpflichten nach Art. 19 beziehungsweise Online-Marktplatzpflichten nach Art. 29 wegen Größe nicht gelten oder insbesondere nach Art. 20–28 beziehungsweise 30–32 gelten.

**Notwendige Gegenmaßnahme:** Rechtsanwalt dokumentiert Dienste-Rolle, Nutzer-/Unternehmensgröße, anwendbare Einzelpflichten und Ausnahmen; daraus eine Verantwortungs- und Prozessmatrix ableiten. Keine pauschale Kleinunternehmensbefreiung annehmen.

**Externe Freigabe:** zwingend.

### L07-09 – P2B-Verordnung für gewerbliche Verkäufer wurde bisher nicht bewertet

**Risikoklasse:** R1  
**Einordnung:** sichere Pflichten bei Anwendbarkeit; ob DUELVANTA ein Online-Vermittlungsdienst im Sinne der Verordnung (EU) 2019/1150 ist und welche Größenausnahmen greifen, ist modellabhängig; externe Freigabe zwingend.

**Befund:** DUELVANTA soll gewerblichen Verkäufern ermöglichen, Verbrauchern Waren anzubieten. Damit ist die P2B-Verordnung ernsthaft einschlägig, wurde in der bisherigen B07-Fassung aber nicht geprüft. Offen sind insbesondere Anforderungen an Bedingungen und deren Änderung, Einschränkung/Sperre/Beendigung, Ranking, differenzierte Behandlung, Datenzugang sowie – abhängig von den Voraussetzungen – internes Beschwerdesystem und Mediatoren.

**Notwendige Gegenmaßnahme:** Anwaltliche Scope-Entscheidung mit artikelgenauer Pflichten-/Ausnahmenmatrix; Verkäuferbedingungen und Prozesse erst auf dieser Grundlage finalisieren.

**Externe Freigabe:** zwingend.

### L07-10 – Datenschutzinformationen und interne DSGVO-Governance sind unvollständig

**Risikoklasse:** R0 für nicht transparent oder ohne tragfähige Grundlage betriebene Verarbeitung, sonst R1  
**Einordnung:** Transparenz-, Rechenschafts- und Schutzpflichten sind sicher; Rollen, Rechtsgrundlagen, Erforderlichkeit und Risiko sind verarbeitungsabhängig; externe Datenschutzfreigabe zwingend.

**Befund:** `datenschutz.html` ist ausdrücklich eine Beta-Fassung. Nicht hinreichend abgedeckt sind Verkäufer-Onboarding mit Geburtsdatum/Privatanschrift/Steuerdaten, Offenlegung im Checkout, Notice-/Appeal-Daten, konkrete Löschfristen, Webcam/Mikrofon/WebRTC, Google-STUN, jsDelivr, KI-Kartenscanner/OpenAI, vollständige Empfänger- und Transferangaben sowie spätere Zahlungen. Zusätzlich fehlen als B07-Evidenz eine belastbare Verantwortlichen-/gemeinsam-Verantwortlichen-/Auftragsverarbeiter-Zuordnung zwischen Plattform und Verkäufern, Verzeichnis von Verarbeitungstätigkeiten, Löschkonzept, Betroffenenrechte-Prozess, Datenschutzverletzungsprozess und eine dokumentierte Prüfung, ob Datenschutz-Folgenabschätzung oder Datenschutzbeauftragter erforderlich sind. Der Nutzerkreis kann Minderjährige umfassen; Alters-/Einwilligungs- und Jugendschutzkonzept ist nicht dokumentiert.

**Rechtsgrundlage:** insbesondere Art. 5 Abs. 2, 6, 8, 13/14, 26, 28, 30, 32–37 und 44 ff. DSGVO.

**Notwendige Gegenmaßnahme:** Tatsächlichen Release-Datenfluss inventarisieren; je Verarbeitung Zweck, Grundlage, Rolle, Empfänger, Frist, Transfer und Risiko entscheiden; interne Nachweise und finale Information getrennt erstellen; Minderjährigen- und DSFA-Entscheidung dokumentieren.

**Externe Freigabe:** zwingend durch qualifizierten Datenschutzrechtsprüfer; Datenschutzbeauftragten-Frage gesondert entscheiden.

### L07-11 – Dienstleisterverträge und Drittlandtransfers sind nicht nachgewiesen

**Risikoklasse:** R0/R1 je Dienst  
**Einordnung:** Art. 28 und 44 ff. DSGVO sind sicher; Dienstleisterrolle und Transferinstrument je Datenfluss abhängig; externe Freigabe zwingend.

**Befund:** Private Nachweise zur wirksamen Supabase-DPA/SCC-Fassung und zum tatsächlich einbezogenen Vercel-Vertrags-/Tarifrahmen liegen B07 nicht vor. Für Google-STUN, jsDelivr und OpenAI fehlen vollständige Rollen-, Subprocessor-, Datenlokalisierungs- und Transferentscheidungen. Stripe bleibt deaktiviert und ist nicht freigegeben.

**Notwendige Gegenmaßnahme:** Außerhalb des öffentlichen Repositorys datiertes Provider-/DPA-/SCC-/Subprocessor-/TIA-Register mit Vertragsstatus, Datenkategorien, Standorten und Transfergrundlage führen und extern prüfen lassen. Keine Tarif- oder Live-Aktivierung in B07.

**Externe Freigabe:** zwingend.

### L07-12 – Consent/TDDDG-Grundansatz ist plausibel, die Endgerätezugriffsmatrix fehlt

**Risikoklasse:** R1  
**Einordnung:** § 25 TDDDG ist sicher; Einwilligungsbedarf hängt von jedem konkreten Speicher-/Auslesevorgang ab; externe Freigabe erforderlich.

**Befund:** Wartelisten-Einwilligung ist nicht vorausgewählt; Analyse-/Marketingcookies werden nicht behauptet; notwendige Auth-/Session-Speicherung ist technisch plausibel. Eine vollständige Matrix aller Browser-/Storage-/SDK-/CDN-/WebRTC-/Scannerzugriffe mit Zweck, Lebensdauer, Anbieter und Einwilligungskategorie fehlt.

**Notwendige Gegenmaßnahme:** Technische Inventur und rechtliche Klassifizierung jedes Zugriffs. Kein pauschales Banner allein aufgrund dieses Befunds; Consent nur dort, wo tatsächlich erforderlich, dann vor Zugriff und widerrufbar.

**Externe Freigabe:** zwingend für die Matrix.

### L07-13 – GPSR-Pflichten für Online-Marktplätze wurden nicht bewertet

**Risikoklasse:** R0/R1  
**Einordnung:** Art. 22 der Verordnung (EU) 2023/988 enthält sichere Pflichten für Anbieter von Online-Marktplätzen; konkrete Einordnung von DUELVANTA, Produktumfang, gebrauchten/vintage Produkten und Verantwortungsverteilung ist modellabhängig; externe Produktsicherheitsfreigabe zwingend.

**Befund:** Über DUELVANTA sollen physische Karten und versiegelte Produkte angeboten und Fernabsatzverträge angebahnt/geschlossen werden. Die bisherige B07-Prüfung enthält keine GPSR-Matrix. Nicht nachgewiesen sind insbesondere Safety-Gate-Registrierung/Kontaktstelle, produkt­sicherheitsbezogene interne Prozesse, die Schnittstellenanforderungen für Pflicht-/Rückverfolgbarkeitsangaben, Reaktion auf Behördenanordnungen und Safety-Gate-Meldungen, Rückruf-/Warnkommunikation sowie stichprobenartige Kontroll- und Schulungsprozesse.

**Notwendige Gegenmaßnahme:** Produktsicherheitsrechtliche Scope- und Rollenprüfung nach Art. 22 GPSR; freigegebene Verkäuferdaten-/Listingpflichten und Notice-/Recall-Prozesse definieren; erst dann minimale technische Lücken umsetzen.

**Externe Freigabe:** zwingend durch Produktsicherheitsrechtler.

### L07-14 – Seit 12.08.2026 geltendes Verpackungsrecht ist nicht abgebildet

**Risikoklasse:** R1  
**Einordnung:** PPWR und VerpackDG sind seit 12.08.2026 anzuwenden; welche Hersteller-/Vertreiber-/Marktplatzpflichten DUELVANTA und seine Verkäufer treffen, hängt von Versand-, Verpackungs- und Rollenmodell ab; externe Freigabe zwingend.

**Befund:** Die bisherige Compliance-Basis verweist noch auf das ältere VerpackG und enthält keine Prüfung der Verordnung (EU) 2025/40 sowie des Verpackungsrecht-Durchführungsgesetzes. Für den geplanten Versand physischer Waren fehlen eine aktuelle Rollenmatrix, Verkäufer-Nachweis-/Sperrlogik und Übergangsentscheidung. § 68 VerpackDG enthält für 2026 konkrete Übergangsvorschriften; eine pauschale Fortführung alter Annahmen ist nicht belastbar.

**Notwendige Gegenmaßnahme:** Aktuelle PPWR-/VerpackDG-Prüfung durch spezialisierten Rechtsberater; erforderliche Registrierungs-, Systembeteiligungs-, Nachweis-, Plattform- und Versandpflichten pro Verkäufer-/Versandfall festlegen. Keine technische Umsetzung ohne diese Vorgabe.

**Externe Freigabe:** zwingend.

### L07-15 – BFSG-Anwendbarkeit und mögliche Kleinstunternehmensausnahme sind nicht belegt

**Risikoklasse:** R0/R1  
**Einordnung:** Dienstleistungen im elektronischen Geschäftsverkehr fallen seit 28.06.2025 grundsätzlich in § 1 Abs. 3 Nr. 5 BFSG; § 3 Abs. 3 BFSG nimmt Kleinstunternehmen, die Dienstleistungen anbieten/erbringen, aus. Ob die Ausnahme tatsächlich greift, erfordert belastbare Unternehmensdaten und Rollenprüfung.

**Befund:** Es gibt weder eine dokumentierte Größen-/Anwendbarkeitsentscheidung noch – falls anwendbar – Konformitäts-/Barrierefreiheitsinformation und Abnahme gegen BFSG/BFSGV. Technische Zugänglichkeit wurde in B07 nicht vollständig geprüft und darf nicht aus Designmerkmalen vermutet werden.

**Notwendige Gegenmaßnahme:** Betreibergröße mit Stichtag und Nachweisen feststellen; rechtliche Scope-Entscheidung dokumentieren. Falls keine Ausnahme greift, externe Accessibility-/Rechtsprüfung und Erfüllung der BFSG/BFSGV-Anforderungen vor Release.

**Externe Freigabe:** zwingend für Scope; bei Anwendbarkeit zusätzlich fachliche Barrierefreiheitsprüfung.

### L07-16 – Steuerliche Plattformpflichten sind nur technisch vorbereitet, nicht freigegeben

**Risikoklasse:** R0  
**Einordnung:** PStTG- und umsatzsteuerliche Pflichten sind bei jeweiliger Tatbestandslage sicher; Plattformrolle, Transaktionen, Vergütung, Auslandssachverhalte und Ausnahmen sind steuerlich modellabhängig; qualifizierte Steuerfreigabe zwingend.

**Positiver Stand:** Die PStTG-SQL-Logik behandelt nur weniger als 30 Warenverkäufe **und** weniger als 2.000 EUR Vergütung als Ausnahme. Genau 30 Vorgänge oder genau 2.000 EUR werden korrekt nicht als Freistellung behandelt. Im `manual_beta`-Modus wird bei bloßem Vertragsschluss keine Vergütung fingiert; Zahlung/Gutschrift ist gesondert vorgesehen.

**Offen:** Die Export-/Evidenzstruktur ersetzt weder BZSt-Registrierung noch Sorgfalts-, Melde-, Verkäuferinformations- und zehnjährige Aufzeichnungspflichten. Außerdem fehlen steuerliche Entscheidungen zu §§ 22f/25e UStG und gegebenenfalls § 3 Abs. 3a UStG, Gebühren-/Rechnungs-/Umsatzsteuermodell, grenzüberschreitenden Fällen und Plattformhaftung.

**Rechtsgrundlage:** PStTG insbesondere §§ 4, 5, 13–16 und 24; UStG insbesondere §§ 3 Abs. 3a, 22f und 25e.

**Notwendige Gegenmaßnahme:** Steuerberater erstellt Scope-, Registrierungs-, Due-Diligence-, Reporting-, Aufbewahrungs-, Umsatzsteuer- und Rechnungsprozessentscheidung anhand des finalen Geld-/Vertragsflusses. Kein Stripe Live und keine echten Zahlungen in B07.

**Externe Freigabe:** zwingend durch Steuerberater; bei Zahlungsdiensteabgrenzung zusätzlich Rechtsanwalt.

### L07-17 – Zahlungsdienste-/ZAG- und Abrechnungsmodell bleibt vor Livebetrieb ungeklärt

**Risikoklasse:** R0  
**Einordnung:** Lizenz-/Ausnahmetatbestände hängen vom tatsächlichen Besitz, Empfang, Weiterleitung und wirtschaftlichen Zugriff auf Kundengelder ab; Stripe Connect allein entscheidet die Rechtslage nicht.

**Befund:** `MARKETPLACE_COMPLIANCE_REQUIREMENTS.md` sieht später Stripe Connect/direct charges vor, aktuell aber ausdrücklich `manual_beta`. Es gibt keine qualifizierte Freigabe des finalen Zahlungsflusses, der Plattformgebühr, Refund-/Chargeback-Verantwortung, Rechnungsstellung, Seller-of-record-/Merchant-of-record-Abgrenzung oder ZAG-Ausnahme.

**Notwendige Gegenmaßnahme:** Vor jeder Live-Zahlung diagrammierten End-to-End-Geldfluss einschließlich Vertragsparteien, Gebühren, Refunds, Disputes und Auszahlungen durch Zahlungsdiensteanwalt und Steuerberater freigeben lassen. B07 aktiviert nichts.

**Externe Freigabe:** zwingend.

### L07-18 – Verbraucherstreitbeilegungsinformationen fehlen als Scope-Entscheidung

**Risikoklasse:** R1  
**Einordnung:** § 36 VSBG ist bei den jeweiligen Voraussetzungen sicher; Beschäftigtenausnahme, Teilnahmebereitschaft/-pflicht und zuständige Stelle hängen vom Betreiber ab. § 37 VSBG greift nach einer nicht beigelegten Verbraucherstreitigkeit unabhängig von einer bloßen Websitegestaltung.

**Befund:** Keine dokumentierte VSBG-Entscheidung und keine freigegebene Information in Website/AGB. Die Ausnahme des § 36 Abs. 3 betrifft nur § 36 Abs. 1 Nr. 1 und setzt höchstens zehn Beschäftigte am 31.12. des Vorjahres voraus; sie darf nicht pauschal angenommen werden.

**Notwendige Gegenmaßnahme:** Rechtsanwalt dokumentiert Betreibergröße, Teilnahmeentscheidung/-pflicht, zuständige Schlichtungsstelle und Texte/Prozess nach §§ 36/37 VSBG.

**Externe Freigabe:** zwingend.

### L07-19 – Preis-, Deal- und Marktpreisbehauptungen sind nicht rechtlich/inhaltlich abgenommen

**Risikoklasse:** R1  
**Einordnung:** Irreführende Preis-/Vorteilsangaben sind nach § 5 UWG sicher unzulässig; PAngV-Anforderungen hängen von Unternehmerrolle und konkreter Preiswerbung ab; Datenherkunft/-lizenz ist gesondert modellabhängig.

**Befund:** „Beste Deals“ und „Deal of the Day“ beruhen auf Abweichungen von gespeichertem Marktpreis. Herkunft, Aktualität, Repräsentativität, Aktualisierungszeitpunkt und Nutzungsrechte dieser Referenzdaten sind für Nutzer und B07 nicht dokumentiert. Dadurch kann ein objektiver besonderer Preisvorteil suggeriert werden, der nicht belastbar nachgewiesen ist.

**Notwendige Gegenmaßnahme:** Datenquelle/Lizenz und Berechnung dokumentieren; rechtlich freigegebene Bezeichnung und Transparenzhinweise festlegen; falls nicht belastbar, entsprechende Vorteilsaussagen vor Release deaktivieren oder neutralisieren. Keine Änderung in B07 ohne Vorgabe.

**Externe Freigabe:** zwingend für Werbe-/Preisrecht und Datenlizenz.

### L07-20 – Impressum und Betreiberrolle sind nur vorläufig

**Risikoklasse:** R0/R1  
**Einordnung:** § 5 DDG verlangt je nach Betreiberstatus bestimmte ständig verfügbare Angaben; endgültige Angaben hängen von Rechtsform, Register, Vertretung, USt-ID und Aufsicht ab.

**Befund:** `impressum.html` enthält Name, ladungsfähige Anschrift und E-Mail als Basis. Finale Rechtsform-/Register-/Vertretungs-/USt-ID-/Aufsichtsangaben und die konsistente Betreiber-/Vermittlerrolle können erst mit belegtem Betreiberstatus finalisiert werden.

**Notwendige Gegenmaßnahme:** B09 nicht vorziehen. Vor Release reale Betreiberunterlagen anwaltlich/steuerlich abgleichen und exakt in Impressum, Bedingungen, Datenschutz und Checkout übernehmen.

**Externe Freigabe:** zwingend; keine erfundenen Angaben.

## 5. Keine festgestellte technische Regression

Die B07-Vertiefung hat keinen konkreten Beweis einer Regression in B01–B06 ergeben. Insbesondere bleiben als geeignete, aber nicht rechtsfreigebende Grundlagen bestehen:

- Verkäuferklassifikation `private` / `trader` und geschützte Händler-/Steuerdaten;
- serverseitige Verkaufsfreigabe und C2C/B2C-Vertragssnapshot;
- exakte Preis-/Versand-/Produkt-Snapshots;
- Festpreisbutton „Zahlungspflichtig bestellen“;
- unveränderbarer Vertragsnachweis und vorbereitete Bestätigungs-Outbox;
- Notice-and-Action mit strukturiertem Hinweis, Entscheidung und Einspruch;
- PStTG-Schwellenlogik für weniger als 30 Vorgänge und weniger als 2.000 EUR;
- kein produktiver Stripe-/Refund-/Payout-Betrieb.

Darum wurden weder CI #284 noch Preview/Login erneut ausgeführt und keine technische Datei geändert.

## 6. Verbindliches externes Freigabepaket

B07 darf erst geschlossen werden, wenn mindestens folgende private, datierte und auf einen eindeutigen Repository-/Dokumentstand bezogene Evidenz vorliegt:

1. anwaltlich freigegebenes Betreiber-/Vermittler-, Nutzer-, Vertrags- und Zahlungsmodell einschließlich C2C/B2C/B2B;
2. freigegebene Plattform-/Verkäuferbedingungen mit wirksamer Einbeziehung und Versionierung;
3. freigegebener Festpreis- und Verhandlungsvertragsschluss mit vollständigen Pflichtinformationen;
4. freigegebene Widerrufsunterlagen, elektronische Widerrufsfunktion und Bestätigung auf dauerhaftem Datenträger;
5. freigegebene Online-Marktplatz- und Rankinginformationen;
6. artikelgenaue DSA- und P2B-Rollen-/Pflichten-/Ausnahmenmatrix;
7. GPSR- sowie PPWR/VerpackDG-Rollen- und Prozessfreigabe;
8. BFSG-Scope-/Ausnahmenentscheidung und bei Anwendbarkeit geprüfte Barrierefreiheit;
9. finale DSGVO-/TDDDG-Datenfluss-, Rollen-, Rechtsgrundlagen-, Aufbewahrungs-, Minderjährigen-, DSFA- und Consent-Entscheidung samt Datenschutzerklärung;
10. privates Provider-/DPA-/SCC-/Subprocessor-/Transferregister;
11. steuerliche Freigabe zu PStTG, UStG, Gebühren, Rechnungen, Reporting und Aufbewahrung;
12. zahlungsdienste-/ZAG-rechtliche Freigabe vor jeder Live-Zahlung;
13. VSBG-, Preiswerbe-/Datenlizenz- und finale Impressumsfreigabe;
14. Nachweis, dass alle aus den Freigaben resultierenden zwingenden minimalen Korrekturen umgesetzt und gegen denselben Stand abgenommen wurden.

Sensible Vertrags-, Steuer- oder Identitätsunterlagen gehören nicht in das öffentliche Repository. Im Repository genügt später ein nicht-sensitiver Freigabevermerk mit Datum, Prüferqualifikation, Umfang und eindeutig referenzierten Dokument-/Commitversionen.

## 7. Offizielle Primärquellen (Prüfstand 15.09.2026)

- BGB: §§ 305, 312d, 312f, 312i, 312j, 356a – https://www.gesetze-im-internet.de/bgb/
- EGBGB: Art. 246a, 246c, 246d – https://www.gesetze-im-internet.de/bgbeg/
- Digital Services Act, Verordnung (EU) 2022/2065 – https://eur-lex.europa.eu/eli/reg/2022/2065/oj?locale=de
- P2B-Verordnung (EU) 2019/1150 – https://eur-lex.europa.eu/eli/reg/2019/1150/oj?locale=de
- DSGVO, Verordnung (EU) 2016/679 – https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de
- TDDDG – https://www.gesetze-im-internet.de/tdddg/
- Produktsicherheitsverordnung (EU) 2023/988 – https://eur-lex.europa.eu/eli/reg/2023/988/oj?locale=de
- Verpackungsverordnung (EU) 2025/40 – https://eur-lex.europa.eu/eli/reg/2025/40/oj?locale=de
- VerpackDG – https://www.gesetze-im-internet.de/verpackdg/
- BFSG und BFSGV – https://www.gesetze-im-internet.de/bfsg/ und https://www.gesetze-im-internet.de/bfsgv/
- PStTG – https://www.gesetze-im-internet.de/psttg/
- UStG – https://www.gesetze-im-internet.de/ustg_1980/
- VSBG – https://www.gesetze-im-internet.de/vsbg/
- DDG – https://www.gesetze-im-internet.de/ddg/
- UWG und PAngV – https://www.gesetze-im-internet.de/uwg_2004/ und https://www.gesetze-im-internet.de/pangv_2022/

Die Quellenliste dokumentiert Normgrundlagen, nicht deren Subsumtion oder Freigabe für DUELVANTA.

## 8. Stop-Regel

**B07 bleibt OFFEN / BLOCKIERT.** Eine KI-Prüfung ist keine qualifizierte externe Rechtsfreigabe.

Es wurden keine ungeprüften AGB, Verkäuferbedingungen, Widerrufs- oder Datenschutztexte als finale Rechtsfassung eingebaut. Keine neuen Features, keine Produktionsänderung, kein Merge, keine Migration, kein Stripe Live, keine echten Payments/Refunds/Payouts, keine Domain-Promotion und keine Arbeit an B08–B12.

Ein Masterhandout V13 mit dem Status „B07 abgeschlossen“ darf nicht erstellt werden, solange das vollständige externe Freigabepaket und die daraus folgenden Nachweise fehlen.
