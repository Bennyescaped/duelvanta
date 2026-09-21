# DUELVANTA – Kanzlei-SOLL/IST-Abgleich ab V31

Stand: 2026-09-21  
Repository: `Bennyescaped/duelvanta`  
Branch: ausschließlich `marketplace-ux-v1`  
Geprüfter Ausgangs-Head: `74c4fa8c2412b23e20088387b7f57c11453da096`  
Ausgangsdokumente:
- `DUELVANTA_MASTERHANDOUT_V31_2026-09-21.md`
- `DUELVANTA_LEGAL_TECHNICAL_PREFLIGHT_2026-09-20.md`
- individuelle E-Mail-Antwort von Rechtsanwalt Arndt J. Nagel, vom Nutzer am 2026-09-21 bereitgestellt

## 1. Zweck und harte Grenzen

Dieses Dokument trennt:
1. konkrete Aussage der Kanzlei,
2. Empfehlung/Option der Kanzlei,
3. offene Rückfrage,
4. tatsächlichen technischen DUELVANTA-Stand.

Es ist keine eigene Rechtsfreigabe. Es setzt keine offene Rechtsentscheidung als Produktentscheidung um.

Unverändert:
- `main`
- Production
- Production-Supabase
- Stripe Live
- abgeschlossene COLLECT-F1–F3-/Mobile-Abnahmen
- abgeschlossene BATTLE-Spectator-Media-Staging-Abnahme
- Scanner-Release-Gate

In diesem Block wurden bis zur vollständigen Bewertung keine Anwendungscodes, Datenbankschemata oder Providerkonfigurationen verändert.

## 2. Baseline

Zum Prüfstart:
- `marketplace-ux-v1 = 74c4fa8c2412b23e20088387b7f57c11453da096`
- `main = 50f88213571be13255bb52eb489cc28cca660001`
- PR #5 offen, Draft, unmerged
- Supabase-Staging `xhmjxrcskfhbovhitdej`: `ACTIVE_HEALTHY`, Region `eu-central-1`, PostgreSQL 17.6.1.166

V31 ersetzt die inzwischen überholten Preflight-Befunde zum früher gemischten Environment-Routing und zum damals noch offenen Spectator-Media-Mehrgeräte-Test.

## 3. Gesamtmatrix

| Bereich | Kanzlei-SOLL / Aussage | Aktueller DUELVANTA-IST | Einstufung |
|---|---|---|---|
| Inserat / Vertragsschluss | Inserat nach Generator-AGB unverbindlich; Käufer gibt Angebot ab; Verkäufer darf binnen maximal fünf Tagen annehmen | Inserat allein erzeugt keinen Deal/Order | **MATCH** für Inserat |
| Fünf-Tage-Frist | Kanzlei stellt klar: fünf Tage sind nur Maximalfrist; frühere Annahme ist möglich | Kein Annahmefenster vorhanden; Vertrag wird bereits beim Käufer-Checkout gespeichert | **GAP / RÜCKFRAGE ERFORDERLICH** |
| Sofortige Zahlungsaufforderung | Kanzlei nennt sofortige Zahlungsaufforderung als Beispiel zulässiger früher Annahme | Stripe-Zahlungsanforderung ist technisch nachgelagert an bereits bestehendem Deal/Order/Snapshot | **GAP / RÜCKFRAGE ERFORDERLICH** |
| Festpreis-Checkout | Käuferhandlung soll nach aktuellem AGB-Modell zunächst Angebot sein, sofern nicht zugleich wirksame Verkäuferannahme erfolgt | `buy_market_listing_v1/v2/v3` erzeugt sofort `deal.status=accepted`, `accepted_at`, Order und Vertragssnapshot | **TECHNISCHE ÄNDERUNG ERFORDERLICH NACH RECHTSENTSCHEIDUNG** |
| Preisangebote | Zielmodell nicht gesondert beantwortet | Verkäufer akzeptiert Preisangebot vor finalem Käufer-Checkout; dies reserviert 2 h und ist ausdrücklich noch kein Vertrag; Vertrag entsteht erst beim Käufer-Checkout | **GAP / RÜCKFRAGE ERFORDERLICH** |
| Vertragssnapshot | Vertragsschlusszeitpunkt muss dem rechtlich gewählten Annahmeereignis entsprechen | `contract_formed_at = deal.accepted_at` am Käufer-Checkout | **TECHNISCHE ÄNDERUNG ERFORDERLICH NACH RECHTSENTSCHEIDUNG** |
| Order-Bestätigung | Annahme kann laut AGB durch elektronische Auftragsbestätigung erfolgen | `order_confirmation` wird automatisch erst nach bereits gespeichertem Vertrag erzeugt | **GAP / RÜCKFRAGE ERFORDERLICH** |
| Stripe Connect | spätere Zahlungsabwicklung über Stripe Connect vorgesehen | Sandboxfundament vorbereitet, aber deaktiviert; Live aus; Payment erst nach bestehender Order | **MATCH als technische Vorbereitung**, Annahmeereignis offen |
| Privat vs. gewerblich | Verarbeitungen und Rechtsgrundlagen sollen explizit getrennt beschrieben werden | getrennte `seller_type`-Logik sowie private Legal-/Tax-Profile vorhanden | **MATCH technisch / DATENSCHUTZTEXT-GAP** |
| Verkäuferdaten an Käufer | private Verkäufer reduziert; gewerbliche Verkäufer mit Unternehmens-/Registerinformationen | Checkout-Snapshot gibt bei privaten Verkäufern Name + Vertragsanschrift aus, aber keine Business-/Register-/öffentlichen Kontaktfelder; Trader erhalten zusätzliche Business-/Register-/Kontaktfelder | **WEITGEHEND MATCH technisch / TEXT-GAP** |
| B2C/C2C | Kanzlei-Antwort legt keine Käuferstatuslogik fest | `b2c` wird allein aus `seller_type='trader'` abgeleitet; Käufer-Verbraucherstatus wird nicht erhoben | **RÜCKFRAGE ERFORDERLICH** |
| Zentraler Widerruf | in dieser Kanzlei-E-Mail nicht beantwortet | keine zentrale gesetzliche Widerrufsdomäne; `withdraw_my_market_offer` ist nur Rücknahme eines Preisangebots | **RÜCKFRAGE ERFORDERLICH** |
| Inseratsdaten / C-492/23 | Kanzlei verlangt eigenen Datenschutzabsatz sowie Vorab-Screening sensibler Daten und Identitäts-/Einwilligungsprüfung | Publish prüft Produktdaten/Fotomenge, aber kein PII-/Art.-9-Screening in Text/Bildern und keinen entsprechenden Consent-/Identitätsnachweis | **TECHNISCHE ÄNDERUNG ERFORDERLICH; AUSGESTALTUNG OFFEN** |
| Zahlungsdienstleister | Empfängerkategorie ausdrücklich nennen | Stripe-Connect-Pfade vorhanden, derzeit nicht live | **MATCH technisch / TEXT-GAP** |
| Logistikpartner | Empfängerkategorie ausdrücklich nennen | AfterShip-Preview-Pfad übermittelt Trackingnummer, Order-ID/Ordernummer und Sprache; keine Lieferadresse im geprüften Payload | **MATCH technisch / TEXT-GAP** |
| Lieferadress-Snapshot | eigener Zweck + eigene Speicherdauer transparent beschreiben | Defaultadresse wird in `market_order_shipping_addresses` kopiert; Verkäuferzugriff zustandsbegrenzt und protokolliert; Snapshot bleibt von Profiländerungen getrennt | **MATCH technisch / TEXT- UND RETENTION-GAP** |
| beschränkte Käuferdaten an Verkäufer | nur erforderliche Daten für Vertragsabwicklung | Verkäufer kann Order-Lieferadresse nur in relevanten Orderzuständen lesen; Zugriff wird geloggt | **MATCH technisch / TEXT-GAP** |
| Notice & Action Art. 16 DSA | eigener Verarbeitungszweck, Melder + gemeldete Person transparent machen | `listing_notices`, Events, Appeals, Owner-Entscheidung vorhanden | **MATCH technisch / TEXT-GAP** |
| Art. 18 DSA | Verdachtsfälle mit Lebens-/Sicherheitsgefahr an zuständige Strafverfolgung melden; Empfänger/Zweck transparent | kein eigenständiger Art.-18-Workflow, keine Behördenrouting-/Evidenzdomäne gefunden | **TECHNISCHE ÄNDERUNG ERFORDERLICH; PROZESS OFFEN** |
| PStTG/DAC7 Datensatz | Identitäts-, Steuer-, Transaktions-, Vergütungs-/Gebührendaten und ggf. Finanzkonto-Kennung melden | Tax-Ledger, Seller-Legal-/Tax-Daten und Exportdataset vorhanden; Finanzkonto-Kennung wird im eigenen Dataset nicht geführt | **TEILWEISE MATCH / RÜCKFRAGE ERFORDERLICH** |
| PStTG Meldung an BZSt | jährlich spätestens 31. Januar | Export-/Dataset-Funktionen vorhanden; kein BZSt-Übermittlungsweg/Scheduler im aktuellen Repo/Staging gefunden | **TECHNISCHE ÄNDERUNG ERFORDERLICH; MELDEKANAL OFFEN** |
| PStTG Aufbewahrung | Kanzlei-E-Mail fand keine spezielle Frist und verwies auf allgemeine Fristen | Account-Erasure besitzt bereits PStTG-Holds | **RÜCKFRAGE / RECHTSQUELLE GEGENPRÜFEN** |
| HGB-Fristen | Kanzlei nennt 6/8/10 Jahre nach Datenkategorie | bestehende Retention-Holds sind nicht als vollständige 1:1-Kategorienmatrix zu diesen Fristen modelliert | **TECHNISCHE ÄNDERUNG NACH RETENTION-MATRIX** |
| Supabase | Backend/DB/Storage und Vertragsabwicklungsdienste in Datenschutz abbilden | Auth, PostgreSQL, Storage und Backend werden tatsächlich genutzt; Staging ist `eu-central-1` | **MATCH technisch / DATENSCHUTZTEXT-GAP** |
| private COLLECT-Daten | ausdrücklich transparent machen | `collection_items`, Binder, Preis-/Kaufdaten etc. nutzerbezogen vorhanden | **MATCH technisch / TEXT-GAP** |
| Kartenbilder in Supabase | Speicherung/Löschung transparent machen | Bild wird bei Kartenspeicherung in `collection-cards` gespeichert; Pfad in `collection_items`; signierte URLs | **MATCH technisch / TEXT- UND RETENTION-GAP** |
| OpenAI-Kartenanalyse | Bildübermittlung an OpenAI transparent machen | V16 sendet JPEG als Base64 an `/v1/responses`, `store:false` | **MATCH technisch / TEXT-GAP** |
| OpenAI-Retention | Kanzlei liefert keine konkrete Providerfrist | `store:false` verhindert nicht automatisch jede Provider-Retention; Providerbedingungen sind separat zu berücksichtigen | **RÜCKFRAGE/PROVIDERKONFIGURATION** |
| Scanner-Accounting | Speicherung/Löschung transparent machen | `dv_v16_private.openai_scan_reservation` enthält u.a. user_id, request_id, image_sha256, Token/Kosten; Account-Erasure umfasst diese Tabellen derzeit nicht explizit | **TECHNISCHER RETENTION-/ERASURE-GAP NACH RECHTSGRUNDLAGE** |
| BATTLE WebRTC P2P | Kamera-/Audioverarbeitung transparent machen | Kamera/Mikrofon lokal; SDP/ICE in Supabase; P2P über WebRTC; Google-STUN konfiguriert | **MATCH technisch / DATENSCHUTZTEXT-GAP** |
| LiveKit Zuschauer-Media | Anbieter, Zweck, Daten, Empfänger, AVV/DPA klären | Spielertracks werden zusätzlich an LiveKit SFU publiziert; Zuschauer receive-only; kein Egress/Recording-Pfad in DUELVANTA | **TECHNIK BEKANNT / PROVIDER- UND RECHTSPRÜFUNG OFFEN** |
| LiveKit DPA / Region / Subprozessoren | Kanzlei fordert Prüfung | nicht aus Repository beweisbar; Account-/Vertragskonfiguration muss separat verifiziert werden | **RÜCKFRAGE/OPERATIVE VERIFIKATION** |
| BATTLE Aufzeichnung | aktuelle Konzeption ohne serverseitige Aufzeichnung | kein LiveKit-Egress-/Recording-Aufruf im geprüften Code | **MATCH** |
| LiveKit Consent/Widerruf | Kanzlei gibt keine Rechtsgrundlage frei | technische Consent-/Revocation-Mechanik ist funktional auf Staging abgenommen | **TECHNISCH MATCH / RECHTSGRUNDLAGE OFFEN** |

## 4. Vertragsschluss – Detailbefund

### 4.1 Festpreis

Aktueller Pfad:
1. Listing aktiv.
2. `review_market_checkout` erzeugt Checkout-Review und Hash.
3. Käufer klickt „Zahlungspflichtig bestellen“.
4. `buy_market_listing_v3` → `buy_market_listing_v2` → `buy_market_listing_v1`.
5. `market_deals`: sofort `status='accepted'`, `accepted_at=now()`.
6. Trigger erzeugt/ergänzt Order.
7. Trigger erzeugt unveränderbaren Vertragssnapshot mit `contract_formed_at=accepted_at`.
8. Automatische `order_confirmation` wird in die Outbox gestellt.
9. PStTG-Ledger erhält `contract_formed`.

Damit ist die Bestätigung derzeit Beleg eines bereits gespeicherten Vertragsschlusses und keine nachgelagerte Verkäuferannahme.

Die Kanzlei hat nur bestätigt, dass fünf Tage eine Maximalfrist sind und eine frühere Annahme – z.B. durch sofortige Zahlungsaufforderung – möglich ist. Sie hat nicht festgelegt, ob DUELVANTA:
- eine Verkäuferbestätigung verlangen muss,
- eine automatisierte Zahlungsaufforderung dem Verkäufer zurechnen darf,
- oder einen anderen Annahmemechanismus verwenden soll.

Folge: keine Vertragsschluss-Implementierung ohne diese Festlegung.

### 4.2 Preisangebote

Aktuell:
1. Käufer sendet Preisangebot.
2. Verkäufer setzt `accepted`; 2-h-Reservierung.
3. SQL-Kommentar stellt ausdrücklich klar: noch kein Vertrag.
4. Käufer führt danach Checkout aus.
5. Erst dieser Checkout erzeugt Deal/Order/Vertragssnapshot.

Dieses Modell bildet die Generator-AGB-Sequenz „Käuferangebot → spätere Verkäuferannahme“ nicht ab, weil die Verkäuferaktion vor dem finalen Checkout liegt.

Auch hier ist eine Rechtsentscheidung nötig, bevor Zustände geändert werden.

## 5. Datenschutz TRADE

### 5.1 Verkäufer privat/trader

Technische Trennung ist vorhanden:
- öffentliche Seller-Klassifikation,
- private Legal-Profile,
- verschlüsselte Tax-IDs,
- zusätzliche Trader-Felder.

`market_checkout_seller_party` gibt:
- privat: Vertragsname + Anschrift, keine Business-/Register-/öffentlichen Kontaktfelder;
- trader: zusätzlich Firmenname, Rechtsform, Vertreter, öffentliche E-Mail/Telefon, Registerdaten.

Die Kanzlei verlangt vor allem eine explizite Trennung in der Datenschutzerklärung. Dafür liegt kein freigegebener individueller Text vor.

### 5.2 Inserats-Screening

Neuer technischer Befund aus der Kanzlei-Antwort:
- Freitextfelder und Bilder können veröffentlicht werden.
- Publish prüft derzeit weder sensible personenbezogene Daten noch die Identität/Einwilligung einer gegebenenfalls abgebildeten betroffenen Person.

Das ist ein echter neuer Legal-Tech-GAP.

Nicht eigenständig festgelegt werden:
- welche Kategorien exakt automatisch blockiert werden,
- ob Gesicht/Namensschild/Adresse auf Karten-/Produktfotos erfasst werden,
- wie „Inserent ist betroffene Person“ technisch bewiesen werden soll,
- wie ausdrückliche Einwilligung nachgewiesen wird,
- welche Fälle automatisch abgelehnt vs. manuell geprüft werden,
- Aufbewahrung des Prüf-/Consent-Nachweises.

### 5.3 Notice & Action / Art. 18 DSA

Art. 16:
- bestehender Intake, Status, Entscheidung, Einspruch und Audit sind technisch vorhanden.

Art. 18:
- eigener Eskalations-/Behördenpfad fehlt.
- Ein technischer Workflow darf erst gebaut werden, wenn Empfängerfindung, Staff-Berechtigung, Mindestdaten, Evidenz, Audit und Retention festgelegt sind.

## 6. PStTG / DAC7

Vorhanden:
- Seller-Identität,
- Geburtsdatum,
- Anschrift,
- Tax-ID-Referenzen,
- USt-/Registerinformationen,
- Contract-/Remuneration-/Fee-Ledger,
- Quartals-/Jahresaggregation,
- Export-Snapshots.

Nicht vorhanden bzw. nicht abschließend:
- kein BZSt-Übermittlungsclient/-workflow gefunden;
- kein Scheduler für die gesetzliche 31.-Januar-Meldung;
- Finanzkonto-Kennung ist nicht Bestandteil des eigenen Exportdatasets;
- bei Stripe Connect ist zu klären, welche Finanzkonto-Information DUELVANTA/Stripe tatsächlich verfügbar ist und wer sie für die Meldung bereitstellt.

### 6.1 Wichtige Gegenprüfung zur Kanzlei-E-Mail

Die E-Mail sagt, zu einer speziellen PStTG-Aufbewahrungsfrist sei in den herangezogenen Quellen nichts Konkretes gefunden worden.

Die aktuell geltende Fassung des PStTG enthält jedoch in **§ 24 Abs. 3 PStTG** eine ausdrückliche Aufbewahrungspflicht:
- dort bezeichnete Aufzeichnungen: zehn Jahre;
- Fristbeginn mit Ablauf des Kalenderjahres der Erstellung;
- bestimmte Aufzeichnungen sind danach zu löschen.

Daher darf die Retention nicht allein aus den allgemeinen HGB-Fristen modelliert werden.

Die bereits vorhandenen DUELVANTA-PStTG-Holds sind in ihrer Richtung plausibel, müssen aber 1:1 gegen die Kategorien und Friststarts aus § 24 PStTG sowie ergänzende HGB/AO-Pflichten geprüft werden.

## 7. COLLECT / OpenAI / Supabase

### 7.1 Tatsächlicher Datenfluss

OpenAI-V16:
1. Browser erzeugt Karten-JPEG.
2. API validiert Bild, bildet SHA-256 und reserviert Quota/Accounting.
3. JPEG wird an OpenAI Responses API gesendet.
4. Request setzt `store:false`.
5. Antwort wird strukturiert verarbeitet.
6. Rohbild wird im DUELVANTA-API-Code nicht als eigener Serverdatensatz gespeichert.
7. Wenn Nutzer Karte speichert, wird das Bild separat in Supabase Storage `collection-cards` gespeichert.

Scanner-Accounting speichert jedoch u.a.:
- Nutzer-ID,
- Request-ID,
- Bild-SHA-256,
- TCG/Scanart,
- Token-/Kostenwerte,
- Zeitpunkte.

Der bestehende Account-Erasure-Pfad erfasst diese `dv_v16_private`-Datensätze nicht ausdrücklich.

### 7.2 Rechts-/Textstatus

Kanzlei:
- OpenAI bereits im Generator.
- Supabase-Konfiguration „Datenverarbeitung zur Vertragsabwicklung / Dienste für die Vertragsabwicklung“ ist einschlägig.
- individuelle Anpassung des Standardtexts ist nicht im Paket enthalten;
- eigene Änderungen werden bei API-Updates überschrieben.

Folge:
- Supabase-Konfiguration im Generator ist eine konkrete operative Maßnahme.
- Für private Collection, Bilder, OpenAI-Bildanalyse, Storage und konkrete Löschlogik liegt kein haftungsübernommener individueller Kanzleitext vor.
- Keine selbst erfundene Datenschutzklausel in diesem Block.

## 8. BATTLE / LiveKit / WebRTC

### 8.1 Tatsächlicher Datenfluss

Spieler-P2P:
- Browserzugriff Kamera + Mikrofon;
- WebRTC;
- Google-STUN ist in `battle-webrtc.js` konfiguriert;
- SDP/ICE werden als `battle_signals` in Supabase verarbeitet;
- `clear_my_battle_signals` löscht eigene Signale und zusätzlich Signale >1 Tag bei RPC-Aufruf.

Spectator Media:
- bereits vorhandene Kamera-/Mikrofontracks werden zusätzlich über LiveKit Cloud publiziert;
- Viewer ist receive-only;
- Broker erzeugt 45-s-Token mit pseudonymisierter Match/Epoch/Rollen-Identity;
- kein Egress-/Recording-Pfad in DUELVANTA;
- Consent/Revocation und RemoveParticipant funktional auf Staging abgenommen.

### 8.2 Noch extern zu verifizieren

Kanzlei verlangt:
- Notwendigkeit,
- AVV/DPA,
- personenbezogene Daten,
- Zweck,
- Betreiber,
- Empfänger.

Repository kann nicht beweisen:
- ob der LiveKit-DPA accountseitig wirksam akzeptiert ist,
- tatsächliche Account-Data-Region,
- Observability-Einstellungen,
- Subprozessorenstand,
- ob Media-Transport-Region-Pinning aktiv ist.

Keine Behauptung „sämtliche Live-Medien bleiben in Frankfurt“, solange diese Account-Einstellungen nicht verifiziert sind.

## 9. Zentrale Widerrufsfunktion

Die individuelle Kanzlei-Antwort beantwortet diesen Punkt nicht.

Der technische Preflight bleibt daher maßgeblich:
- keine zentrale gesetzliche Widerrufsfunktion implementieren;
- `marketplace_b2c`, `marketplace_c2c` und künftige DUELVANTA-Direktverträge nicht ohne Rechtsentscheidung vermischen;
- Erklärung, Storno, Refund und Fallbearbeitung getrennt modellieren.

Status: **LEGAL DECISION REQUIRED**.

## 10. Minimal priorisierter Umsetzungsplan

### P0 – vor jedem Vertragsschluss-Umbau: vier präzise Kanzlei-Klärungen

1. **Festpreis:** Darf bei DUELVANTA die unmittelbar nach Käufer-Checkout automatisch erzeugte Stripe-Connect-Zahlungsaufforderung als Annahme des Verkäufer-Käuferangebots gelten, oder muss der Verkäufer selbst nochmals aktiv bestätigen?
2. **Preisangebot:** Welches Ereignis soll bei bereits vom Verkäufer akzeptiertem Preisvorschlag den Vertrag schließen: Verkäuferannahme des Preisvorschlags, späterer Käufer-Checkout oder erneute Verkäuferannahme nach Checkout?
3. **B2C-Klassifikation:** Reicht für Verbraucherpflichten die Händlerstellung des Verkäufers plus zugelassener Käuferkreis aus, oder muss DUELVANTA den Verbraucher-/Unternehmerstatus des Käufers ausdrücklich erheben?
4. **Widerruf:** Welche Marketplace-Verträge müssen die zentrale elektronische Widerrufsfunktion erhalten und wer ist jeweils Erklärungsempfänger?

Ohne diese vier Antworten kein Vertragsschluss-/Widerrufscode.

### P1 – konkrete Datenschutz-/Compliance-Arbeit

Nach fachlicher Ausgestaltung:
- Pre-Publication-Screening für sensible Inseratsdaten + manueller Review/Consent-Evidenz.
- Art.-18-DSA-Eskalationsworkflow.
- PStTG-BZSt-Meldeweg und Terminsteuerung.
- PStTG-Finanzkonto-Datenquelle mit Stripe/Connect klären.
- provider-/datentypgenaue Retention-Matrix, insbesondere § 24 PStTG und HGB/AO.
- Scanner-Accounting in Export/Erasure/Retention einordnen.

### P2 – Rechtstext-/Providerkonfiguration

- IT-Recht-Generator: Supabase als Vertragsabwicklungs-/Backenddienst konfigurieren.
- TRADE-Datenschutzerklärung um die von der Kanzlei konkret genannten Kategorien ergänzen – aber nur über freigegebenen Generator-/Kanzleitext oder ausdrücklich verantwortete Individualfassung.
- LiveKit-DPA, Subprozessoren, Data Region, Observability und Media-Routing accountseitig verifizieren.
- Google-STUN als zusätzlichen BATTLE-Empfänger/Datenfluss in Datenschutzprüfung aufnehmen.
- OpenAI-Retention-/DPA-Konfiguration für den konkreten API-Account dokumentieren.

## 11. Implementierungsentscheidung dieses Blocks

**Kein Anwendungscode und keine Datenbankmigration werden in diesem Abschlussblock vorgenommen.**

Begründung:
- Das wichtigste Produktmodell – Vertragsschluss – wurde von der Kanzlei nicht eindeutig auf ein technisches Ereignis festgelegt.
- Für Inserats-Screening und Art.-18-DSA ist die Pflicht erkennbar, die technische Ausgestaltung aber noch nicht belastbar spezifiziert.
- Für PStTG fehlen Meldekanal-/Finanzkonto-/Retentiondetails.
- Für COLLECT und BATTLE fehlen individuelle Rechtstexte bzw. Account-/Provider-Nachweise.
- Eine Implementierung jetzt würde notwendige Legal-/Produktentscheidungen eigenständig erfinden.

Zulässig und sinnvoll ist ausschließlich die Dokumentation des Abgleichs sowie die gezielte Rückfrage an die Kanzlei.

## 12. Externe Rechtsquellen-Gegenprüfung

Nur zur Plausibilisierung der Kanzlei-Antwort, ohne eigene Rechtsfreigabe:
- EuGH, C-492/23, Russmedia Digital / Inform Media Press, Urteil 02.12.2025: Vorab-Maßnahmen bei sensiblen Daten in Marktplatzanzeigen.
- DSA Art. 16 und Art. 18.
- PStTG § 5, § 13, § 14, § 17, § 22 und insbesondere § 24.
- HGB § 257.

## 13. Abschlussstatus

- vollständiger Kanzlei-SOLL/IST-Abgleich: **ABGESCHLOSSEN**
- Vertragsschluss-Zielmodell: **RÜCKFRAGE ERFORDERLICH**
- zentrale Widerrufsfunktion: **RÜCKFRAGE ERFORDERLICH**
- TRADE-Datenschutz: **konkrete Textanforderungen bekannt, Rechtstextumsetzung offen**
- Inserats-Screening: **TECHNISCHER GAP, Ausgestaltung offen**
- Notice & Action Art. 16: **technisch vorhanden**
- Art. 18 DSA: **technischer GAP**
- PStTG-Ledger/Export: **teilweise vorhanden**
- BZSt-Meldeweg: **technischer GAP**
- PStTG-Retention: **§ 24 PStTG zwingend in Zielmatrix aufnehmen**
- COLLECT/OpenAI/Supabase: **Datenfluss geklärt, Datenschutztext/Retention offen**
- BATTLE/LiveKit/WebRTC: **Datenfluss geklärt, Provider-/DPA-/Rechtstextprüfung offen**
- Code-/DB-Implementierung in diesem Block: **STOP**
- Production-/Legal-/Release-Freigabe: **NICHT ERTEILT**
