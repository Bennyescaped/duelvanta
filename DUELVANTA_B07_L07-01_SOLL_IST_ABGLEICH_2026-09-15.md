# DUELVANTA – B07 / L07-01 Soll-Ist-Abgleich

Stand: 15.09.2026  
Grundlage: `DUELVANTA_MASTERHANDOUT_V14_2026-09-15.md`, zentraler Prüfkatalog und L07-01/01–/53.  
Repository-Basis vor diesem Dokument: `024f22f12cb51ac5023b8f6eae94621252ea826c` auf `marketplace-ux-v1`.

## Zweck

Dieses Dokument ist die verpflichtende Phase-1-/Phase-2-Bestandsaufnahme aus V14. Es ist **keine externe Rechts-, Steuer- oder Paymentfreigabe** und aktiviert nichts in Produktion.

Kategorien:

- **A** – bereits korrekt vorhanden
- **B** – sichere technische Anpassung innerhalb des beschlossenen Geschäftsmodells möglich
- **C** – technisch möglich, aber vor Aktivierung externe Rechts-/Steuer-/Paymentfreigabe erforderlich
- **D** – widersprüchlich/unklar; neue Fachentscheidung erforderlich

Ergebnis: **kein D-Befund**. Die L07-01-Entscheidungen reichen für die technische Abgrenzung aus.

## Vollständige klassifizierte Änderungsliste

### 1. Seller-Onboarding
- **B** – `seller-onboarding.html` und zugehörige Eingaben erlauben derzeit DE/AT/CH; Release 1 muss technisch auf DE begrenzt werden.
- **A** – Verkäuferart privat/gewerblich, 18+-Prüfung, Identitäts-/Adressdaten und versionierte Verkäuferbedingungen sind als Onboarding-Grundlage vorhanden.
- **C** – externe Identitäts-/Providerfreigaben und produktive Aktivierung des Seller-Enforcements bleiben freigabepflichtig.

### 2. Verkäuferstatus / Identität
- **A** – Verkäuferstatus wird serverseitig geführt; private/gewerbliche Verkäufer können in der UX kenntlich gemacht werden.
- **B** – serverseitige Länderprüfung muss für Release 1 von allgemeinem ISO-Code auf DE-only begrenzt werden.

### 3. `trade-checkout.js`
- **A** – Festpreis-Checkout besitzt Review-Schritt und finale, bindende Käuferaktion `Zahlungspflichtig bestellen`; Verkäuferrolle/-klassifizierung wird im Checkout dargestellt.
- **C** – der aktuelle Zahlungsbezug ist noch Beta-/Sandbox-orientiert; ein echter integrierter Zahlungsschluss darf erst nach externer Paymentfreigabe aktiviert werden.

### 4. `trade-payment-flow.js`
- **A** – die UX trennt Beta von Stripe-Connect und behauptet im nicht aktivierten Zustand keine echte Zahlung/Auszahlung.
- **C** – echte Zahlung, Auszahlung, Erstattung und reale Providerfreigabe bleiben deaktiviert/freigabepflichtig.

### 5. Preisvorschlag / Verhandlung
- **B** – die Annahme eines Preisvorschlags erzeugt heute bereits einen `market_deal` und reserviert ohne definierte 2-Stunden-Ablauflogik. Soll: Annahme ist **noch kein Vertrag**, sondern 2 Stunden exklusive Checkout-Reservierung für den Käufer; bei Ablauf automatische Freigabe.
- **B** – bestehende UX-Texte wie `DEAL RESERVIERT`/automatischer Order-Bezug müssen an dieses Modell angepasst werden.

### 6. Festpreisvertragsschluss
- **A** – serverseitige Zeilensperre (`FOR UPDATE`) schützt den Festpreiskauf vor parallelem Doppelverkauf; finaler Käufer-Checkout benötigt keine erneute Verkäuferbestätigung.
- **C** – tatsächlicher Vertragsschluss in Verbindung mit realer integrierter Zahlung bleibt bis zur externen Freigabe des Payment-/Vertragsmodells nicht produktiv zu aktivieren.

### 7. Warenkorb-/Bestellbündelung je Verkäufer
- **A** – bestehende Order-/Shipping-Architektur bündelt Vorgänge je Verkäufer und unterstützt kombinierten Versand.

### 8. Versandarten / 25-EUR-Trackinggrenze
- **B** – die verbindliche Grenze fehlt: bis einschließlich 25 EUR Warenwert darf ungetrackt angeboten werden, Käufer muss Tracking wählen können; über 25 EUR muss Tracking technisch erzwungen werden. Risikoregeln dürfen Tracking auch darunter erzwingen.
- **B** – DE-only muss auch für Liefer-/Versandadressen gelten; aktuelle Profile erlauben DE/AT/CH.

### 9. 3-Werktage-Versandfrist
- **B** – es existiert kein belastbarer serverseitiger Fristzustand ab bestätigter Zahlung bzw. bei bindendem C2C-Tausch. Frist-/Fälligkeitslogik und UX-Hinweis fehlen.

### 10. Zustellstatus + 72-Stunden-Abschluss
- **B** – vorhandene Erhaltsbestätigung schließt Vorgänge unmittelbar; der beschlossene technische 72-Stunden-Ablauf ab nachgewiesener Zustellung ohne Problemfall fehlt.
- **C** – tatsächliche Auszahlung/Freigabe von Geld nach diesem Status bleibt Payment-freigabepflichtig.

### 11. Käuferbestätigung `Erhalten – alles in Ordnung`
- **B** – vorhandene generische `ERHALT BESTÄTIGEN`-Aktion muss semantisch und serverseitig als aktive Bestätigung `Erhalten – alles in Ordnung` mit eindeutigem Abschlusszeitpunkt geführt werden.
- **C** – daraus folgende reale vorzeitige Auszahlung bleibt deaktiviert, bis Payment extern freigegeben ist.

### 12. Persönliche Abholung
- **B** – Abholung läuft derzeit über generisches Versand-/Erhalt-Markieren. Es fehlen einmaliger Übergabe-/QR-Code, beidseitige Bestätigung und auditierbarer Übergabenachweis.
- **C** – reale unmittelbare Auszahlung nach erfolgreicher beidseitiger Abholung bleibt Payment-freigabepflichtig.

### 13. C2C-Tausch
- **B** – der bestehende generische Dealflow bildet keinen vollständigen Waren-gegen-Waren-Tausch mit exakt beidseitig final bestätigtem Tauschset ab. Erforderlich sind gemeinsamer Finalzustand, Neu-Bestätigung nach Änderung und Start der 3-Werktage-Frist erst danach.

### 14. Problemfall- / Nachweisfristen
- **A** – Problemfälle sind transaktions-/orderbezogen und unterstützen Stellungnahmen.
- **B** – 7-Tage-Nachweis-/Antwortfrist fehlt; ebenso die besondere C2C-Regel, dass bei ungetracktem Versand bis 25 EUR ein Nicht-Erhalt frühestens nach 14 Tagen gemeldet/entschieden werden darf.

### 15. Transaktionsbezogene Auszahlungssperre
- **A** – bestehende Problem-/Stornologik blockiert den betroffenen Order-/Deal-Kontext statt pauschal das gesamte Verkäuferkonto.
- **C** – tatsächliche Provider-Auszahlungssperre/-freigabe bleibt Payment-freigabepflichtig.

### 16. Verkäuferstorno + Stornogebühr
- **B** – der allgemeine Stornoanfragepfad ist für einen Verkäufer nach bindendem/bezahlt bestätigtem Kauf zu permissiv und muss an die beschlossene eingeschränkte Verkäuferstorno-Logik angepasst werden.
- **C** – die vorgesehene 4-%-Stornogebühr darf ohne externe Rechts-/Steuer-/Paymentfreigabe weder berechnet noch eingezogen werden.

### 17. Verkäufer-Sanktionsleiter
- **C** – der beschlossene 90-/14-/60-/180-Tage-Sanktionsmechanismus ist nicht als vollständige Zustandsmaschine vorhanden. Er kann technisch vorbereitet werden, darf wegen der extern zu prüfenden Sperr-/Moderationsfolgen aber nicht produktiv aktiviert werden.

### 18. Bedingungen-Versionierung / erneute Zustimmung
- **A** – Annahmeversion und Zeitpunkt werden bereits gespeichert bzw. in Vertrags-Snapshots referenziert.
- **C** – die verpflichtende Neuakzeptanz bei materiellen Änderungen ist noch kein zentraler Funktions-Gate. Sie darf erst mit extern freigegebenen Fassungen/Versionswechseln aktiviert werden.

### 19. Kommunikation / Anti-Circumvention
- **B** – freie Angebots-/Listingtexte besitzen derzeit keinen ausreichend klaren Guard gegen öffentliche Kontakt-, externe Zahlungs- oder Umgehungsdaten. Vor Vertragsschluss ist ein technischer Guard innerhalb der vorhandenen Eingabepfade erforderlich.
- **B** – nach Bindung dürfen nur die für Versand/Abholung notwendigen Daten über die vorgesehenen geschützten Orderpfade sichtbar sein; öffentliche Seller-Metadaten dürfen dies nicht ersetzen.

### 20. Bewertungen / Blind Review
- **A** – bestehender Legacy-Flow erlaubt Bewertungen erst nach abgeschlossenem Deal und bindet sie an einen Deal.
- **B** – bestehende UX nutzt `positiv/neutral/negativ` statt 5 Sterne; 30-Tage-Frist, Blind-Publish (beide sofort / eine Seite nach 30 Tagen), Unveränderbarkeit der Sterne und Meldbarkeit/Moderation sind nicht vollständig als neues Modell implementiert.

### 21. Share / öffentliche Listing-URLs / Metadaten
- **B** – es fehlt ein vollständiger Release-1-Sharepfad mit öffentlicher Listing-URL, Native Share, Copy-Fallback, datensparsamen Open-Graph-Metadaten und Instagram-tauglicher Story-Karte. `trade.html` selbst ist auth-gebunden und `noindex,nofollow`, daher nicht als öffentlicher Listing-Endpunkt geeignet.

### 22. Deutschland-only / 18+ / registriertes Konto
- **A** – zentrale TRADE-/Checkout-Pfade setzen eine angemeldete Session voraus; Seller-Onboarding erzwingt 18+ serverseitig.
- **B** – Deutschland-only ist nicht konsistent durchgesetzt (Seller- und Shipping-Pfade erlauben aktuell weitere Länder).
- **B** – eine explizite 18+-Freigabe für Käufer vor TRADE-Nutzung ist nicht als gleichwertiger serverseitiger Eligibility-Gate erkennbar und muss ergänzt werden.
- **C** – weitergehende externe Alters-/Identitätsverifikation über die beschlossene technische Eligibility hinaus bleibt freigabepflichtig.

## Phase-3-Reihenfolge für sichere B-Korrekturen

Minimal-invasiv und ohne Produktionswirkung:

1. zentrale B07-Eligibility-/DE-only-Grenzen und Anti-Circumvention-Guards;
2. Preisvorschlag als 2h Checkout-Reservierung statt Deal/Vertrag;
3. Trackinggrenze, Versandfrist und Delivery-/72h-Zustände;
4. persönliche Abholung mit beidseitigem Einmalnachweis;
5. C2C-Tausch-Finalisierung;
6. Problem-/Nachweisfristen und Verkäuferstorno-Grenze;
7. 5-Sterne-/Blind-Review;
8. Share-/Public-Listing-Pfad.

Kategorie-C-Punkte werden in dieser B07-Arbeit nicht aktiviert. `main`, Produktion, produktives Supabase und Stripe Live bleiben unverändert; PR #5 bleibt Draft.