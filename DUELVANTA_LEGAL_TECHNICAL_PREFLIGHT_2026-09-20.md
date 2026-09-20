# DUELVANTA – Legal Technical Preflight ab V29

Stand: 2026-09-20  
Prüfbranch: `marketplace-ux-v1`  
Prüfbasis vor diesem Dokument: `d6d4653f87eae6f91294da6ac0343f715c6182a7`  
Verbindliche Vorgabe: `DUELVANTA_MASTERHANDOUT_V29_2026-09-20.md`

## 1. Zweck, Grenzen und Beleglage

Dieses Dokument ist ausschließlich eine technische Ist-Aufnahme und Readiness-Prüfung. Es trifft keine Rechtsentscheidung, setzt keine Vertragsschluss- oder Widerrufslogik um und ist keine anwaltliche Bewertung.

Geprüft wurden:

- der vollständige Repository-Stand auf `marketplace-ux-v1`;
- der Remote-Stand von Branch, `main`, PR #5 und GitHub Actions;
- Codepfade für COLLECT, TRADE, BATTLE, Scanner, Nachrichtenversand, Stripe Connect und Spectator Media;
- Supabase-Staging `xhmjxrcskfhbovhitdej` read-only: Schema, Funktionen, RLS/Grants, Storage-Metadaten, Konfiguration und ausschließlich aggregierte Zeilenzahlen;
- Vercel read-only: Projekt- und Deployment-Metadaten.

Nicht geprüft bzw. bewusst nicht ausgeführt wurden:

- Production-Supabase `enifiaqsnqtbzylnfrpi`;
- Stripe Live, echte Payments, Refunds oder Payouts;
- LiveKit-Mehrgeräte-/Media-Test;
- Deployments oder Änderungen an Vercel/Supabase/Stripe;
- eine vollständige Kanzlei-Datei im Repository. Für den Vergleich wurde ausschließlich die vom Nutzer vorgegebene Ziffer 13 verwendet: Inserat unverbindlich → Käufer gibt Angebot über Bestellprozess ab → Verkäufer kann innerhalb von fünf Tagen durch elektronische Auftragsbestätigung oder Zahlungsaufforderung annehmen.

`LEGAL DECISION REQUIRED` bezeichnet in der Vertragsschlussmatrix eine notwendige rechtliche Produktentscheidung. `LEGAL REVIEW REQUIRED` bezeichnet bei Datenschutz/Retention eine nicht technisch entscheidbare rechtliche Prüfung. In Datenbankfeldern vorhandene Texte wie `legal_basis` oder Fristen werden nur als bestehende Konfiguration wiedergegeben, nicht bestätigt.

## 2. Repository-, Preview- und Staging-Stand

| Gegenstand | V29 | Tatsächlicher Stand bei Prüfstart | Abweichung |
|---|---|---|---|
| Entwicklungsbranch | ausschließlich `marketplace-ux-v1` | `marketplace-ux-v1`, sauber, Remote synchron | keine |
| Dokumentations-Head | in V29 noch offen | `d6d4653f87eae6f91294da6ac0343f715c6182a7` (`docs: add V29 legal handoff and spectator media checkpoint`) | V29-Platzhalter ist nun aufgelöst |
| letzter Code-Head | `6076c0f1fb778d8bb06d87f1431521ebb48d1731` | weiterhin letzter Code-Commit unter den zwei Dokumentationscommits | keine |
| `main` | `50f88213571be13255bb52eb489cc28cca660001` | exakt derselbe Head; nicht verändert | keine |
| PR #5 | offen, Draft, unmerged | offen, Draft, Head `d6d4653…`, Base `50f8821…`, GitHub meldet `clean` | keine |
| CI laut V29 | Battle #68 und Scanner #592 erfolgreich auf `6076c0f1…` | zusätzlich Battle #70 und Scanner #594 auf `d6d4653…`, beide erfolgreich | neuerer erfolgreicher Dokumentations-Head |
| Vercel | keine neue Aktion | Projekt `duelvanta_v5_vision`; Preview für `d6d4653…` `READY`, `target=null`; Projekt-Node 24.x | nur read-only festgestellt |
| Spectator Media | Mehrgeräte-Gate pausiert | kein Test ausgeführt; Staging-Konfiguration steht technisch weiterhin auf `media_enabled=true`, Limit 50 | Pause ist organisatorisch, nicht durch den DB-Schalter erzwungen |

Weitere tatsächliche Umgebungsbefunde:

- Der Vercel-Runtime-Config-Endpunkt routet Preview auf Supabase-Staging und Production auf Production-Supabase. TRADE und die meisten neueren Seiten verwenden diese Runtime-Config.
- `collect.html`, `battle.js` und einige ältere Control-Pfade enthalten dagegen fest die Production-Supabase-URL. `battle-spectator.js` sowie die Spectator-Media-Clients adressieren fest Staging. Damit kann ein Preview je nach Seite unterschiedliche Supabase-Projekte verwenden. Das ist ein technischer **GAP** und muss vor jeder späteren End-to-End-Freigabe bereinigt werden; Production wurde in diesem Preflight nicht aufgerufen.
- Der OpenAI-Scanner verifiziert Auth und verbucht Quoten fest gegen Production-Supabase. Zusätzlich ist der Preview-Pfad auf Branch `scanner-v16` begrenzt; auf `marketplace-ux-v1` ist dieser API-Pfad technisch gesperrt. Das ist ein dokumentierter Cross-Environment-**GAP**, keine in diesem Block zu ändernde Funktion.
- Supabase-Staging ist `ACTIVE_HEALTHY`, PostgreSQL 17.6, Region `eu-central-1`. Das sagt nichts über die nicht geprüfte Production-Region aus.

## 3. TRADE – tatsächlicher Vertragsschluss

### 3.1 Gemeinsame Ausgangslage

TRADE ist durch `trade-release-gate.js` in Production für normale Nutzer gesperrt. Preview/Nicht-Production lädt die TRADE-Module; ein Production-Owner-Bypass existiert im Code. Ein aktiver Verkäuferstatus und vollständige Verkäuferdaten werden serverseitig vorausgesetzt. Eine Veröffentlichung erzeugt ein `market_listings`-Inserat; allein durch Ansicht oder Veröffentlichung entsteht kein `market_deals`- oder `market_orders`-Datensatz.

Der technische Einzelvertrag ist ein `market_deals`-Datensatz. Eine `market_orders`-Order ist die nachgelagerte Zahlungs-/Fulfillment-Klammer und kann mehrere Deals derselben Käufer-/Verkäufer-/Versandgruppe bündeln. Der unveränderbare Vertragsnachweis wird pro Deal gespeichert, nicht nur pro Sammelorder.

### 3.2 Festpreisfluss

1. Verkäufer veröffentlicht ein aktives Festpreisinserat.
2. Käufer öffnet `JETZT KAUFEN`. `review_market_checkout` liefert Verkäuferrolle, technische Klassifikation C2C/B2C, Verkäuferpartei, Produkt, Menge, Preis, Versand, Gesamtpreis, Payment-Hinweis und einen Hash des Checkout-Stands.
3. Käufer führt die Aktion `Zahlungspflichtig bestellen` aus.
4. `buy_market_listing_v3` prüft Hash, erwartete Listing-Version, Authentifizierung und Idempotenz und ruft den eigentlichen Kauf auf.
5. Im selben serverseitigen Vorgang wird Bestand reserviert/reduziert und ein `market_deals`-Datensatz mit Status `accepted` und `accepted_at` erzeugt. Das ist der aktuelle technische Vertragsschlusszeitpunkt.
6. Ein Trigger erzeugt oder erweitert die `market_orders`-Order und hängt den Deal als `market_order_items` an.
7. Sobald `order_id` am Deal gesetzt ist, wird ein unveränderbarer `market_contract_snapshots`-Datensatz erzeugt. `contract_formed_at` entspricht `deal.accepted_at`; Text und SHA-256-Prüfsumme werden gespeichert.
8. Gleichzeitig wird eine `order_confirmation` an den Käufer in die private Outbox gestellt. Der Dispatcher versendet sie – nur wenn separat aktiviert – asynchron per Resend.

Nach dem Käuferklick gibt es derzeit keine weitere Annahmehandlung des Verkäufers. Die elektronische Bestellbestätigung dokumentiert den bereits als geschlossen gespeicherten Vertrag; sie wird automatisch erzeugt und ist technisch keine spätere Verkäuferentscheidung.

### 3.3 Preisangebot/Verhandlung

1. Käufer erstellt für ein verhandelbares Inserat über `create_market_offer_v2` ein Preisangebot. Es entstehen noch kein Deal und keine Order.
2. Verkäufer kann dieses Angebot ablehnen oder `accepted` setzen. Die Annahme reserviert die angebotene Menge für zwei Stunden. UI und SQL behandeln sie ausdrücklich noch nicht als Kaufvertrag.
3. Der Käufer öffnet danach einen vollständigen, gehashten Checkout und führt `Zahlungspflichtig bestellen` aus.
4. Erst `checkout_accepted_market_offer_v1` erzeugt den `market_deals`-Datensatz; danach laufen dieselben Order-, Snapshot- und Outbox-Trigger wie beim Festpreis.

Damit liegt die aktuelle Verkäuferaktion vor der abschließenden Käufererklärung. Nach dem Käufer-Checkout gibt es keine zweite Verkäuferannahme.

### 3.4 Order, Payment und vorbereiteter Stripe-Connect-Fluss

- Neue Deals werden automatisch einer neuen oder vorhandenen Combined-Shipping-Order zugeordnet. Eine Order ist deshalb nicht deckungsgleich mit genau einem Vertrag.
- Aktuelle Snapshots tragen `payment_provider=manual_beta`; bestehende Orders können `payment_status=not_required` führen. Der Checkout-Text sagt zugleich, dass die Bestellung eine Zahlungspflicht gegenüber dem Verkäufer begründe.
- Der vorbereitete Stripe-Connect-Fluss beginnt erst an einer schon bestehenden Order: authentifizierter Käufer → `prepare_market_stripe_payment` → Vercel API → Stripe Checkout Session als Direct Charge auf dem Connected Account → Session-Bindung → signierte Connect-Webhooks → normalisierte Payment-/Refund-Ereignisse in Supabase.
- Verkäufer-Onboarding verwendet Stripe Accounts v2 und übermittelt insbesondere Account-E-Mail, Land, Rollen-Displayname und angeforderte Card-Payment-Capability an Stripe.
- Webhooks verlangen Signatur, Connect-Account und passenden Live/Test-Modus. Gespeichert werden Provider-IDs, Beträge, Währung, Status, Zeitpunkte, normalisierte Ereignisdaten und Payload-SHA-256; der vollständige Webhook-Body wird vom Code nicht als eigener Rohdatensatz gespeichert.
- Staging ist tatsächlich konfiguriert mit `provider=stripe_connect`, `charge_model=direct_charge`, `live_mode=false`, `sandbox_enabled=false`, EUR und Plattformgebühr 0. Somit ist auch Sandbox-Payment derzeit deaktiviert. Es wurde kein Stripe-Aufruf ausgeführt.

### 3.5 MATCH/GAP-Matrix gegen Ziffer 13

| Vorgabe/Frage | Technischer Ist-Stand | Einstufung |
|---|---|---|
| Inserat ist unverbindlich | Veröffentlichung/Anzeige allein erzeugt weder Deal noch Order | **MATCH** |
| Käufer durchläuft einen Bestellprozess mit finaler verbindlicher Aktion | Festpreis und angenommenes Preisangebot enden in gehashtem Review plus `Zahlungspflichtig bestellen` | **MATCH** |
| Käuferhandlung ist zunächst nur ein Angebot | Dieselbe Käuferhandlung erzeugt sofort `deal.status=accepted`, Order und `contract_formed_at`; kein offener Annahmezustand bleibt | **GAP** |
| Verkäufer kann nach Käuferangebot annehmen | Beim Festpreis fehlt jede nachgelagerte Verkäuferaktion; beim verhandelten Preis liegt die Verkäufer-Reservierung vor dem finalen Käufer-Checkout | **GAP** |
| Annahmefrist fünf Tage | Kein entsprechender Annahmestatus, Fristtimer, Ablauf oder Nichtannahme-Workflow vorhanden. Die Zwei-Stunden-Reservierung betrifft einen anderen, vorgelagerten Zustand | **GAP** |
| Annahme durch elektronische Auftragsbestätigung | Die `order_confirmation` wird automatisch nach dem gespeicherten Vertragsschluss an den Käufer erzeugt; sie ist keine technisch vom Verkäufer ausgelöste Annahme | **GAP** |
| Annahme durch Zahlungsaufforderung | `manual_beta/not_required`; Stripe ist nachgelagert vorbereitet und in Staging deaktiviert. Keine Verkäufer-Zahlungsaufforderung als Annahmeereignis | **GAP** |
| Welches Ereignis soll künftig Vertragsschluss sein? | Code, UI-Text, Deal-Zeitpunkt, Snapshot, Bestätigung und Payment-Folge hängen derzeit am Käufer-Checkout | **LEGAL DECISION REQUIRED** |
| Wie verhalten sich Preisangebot, Verkäuferreservierung, Fünf-Tage-Frist, Verfügbarkeit und Payment-Autorisierung zueinander? | Aktuelle Zustandsmaschine bildet Ziffer 13 nicht ab; mehrere rechtlich mögliche Zielmodelle würden unterschiedliche Technik erfordern | **LEGAL DECISION REQUIRED** |
| Darf die technische B2C-Klassifikation allein aus `seller_type=trader` folgen? | Käufer-Verbraucherstatus wird im Checkout-Snapshot nicht gesondert nachgewiesen; `b2c` wird ausschließlich aus der Verkäuferart abgeleitet | **LEGAL DECISION REQUIRED** |

Es wurde keine Vertragsschlusslogik geändert.

## 4. Zentrale Widerrufsfunktion – Readiness

### 4.1 Wiederverwendbare Bausteine

| Baustein | Vorhandener Stand | Eignung/Restlücke |
|---|---|---|
| Vertrags-Snapshot | pro Deal unveränderbar; Deal/Order/Listing/Offer, Käufer/Verkäufer, C2C/B2C, Verkäuferpartei, Produkt, Preise, Versand, Zeitpunkt, Text, SHA-256 | sehr gute Zuordnungsbasis; noch kein eigener Vertragstyp für DUELVANTA-Direktverträge |
| Verkäuferstatus | öffentliche Seller-Account-Klassifikation; private Legal-Profile, Deklarationen, Tax-ID-Verschlüsselung und Audit | B2C-Verkäufer kann zum Vertragsschlusszeitpunkt rekonstruiert werden |
| Kontaktinformationen | Auth-E-Mail, Profil-E-Mail, Trader-`public_email`/Telefon im Seller-Profil; Trader-`public_email` wird im Snapshot eingefroren; Betreiberkontakt im Snapshot | private Verkäufer-E-Mail ist nicht im Vertragssnapshot eingefroren; aktuelle Auth-E-Mail kann sich ändern oder im Löschprozess betroffen sein |
| Order-/Payment-Bezug | Deal↔Order↔Order-Item; Stripe-Versuch, PaymentIntent, Refund und Provider-Evidenz vorbereitet | Widerruf darf nicht mit allgemeiner Storno-, Case- oder Refund-Logik gleichgesetzt werden |
| Benachrichtigung | private Outbox mit Dedupe-Key, Locks, maximal acht Versuchen, Fehlerzustand und Resend-ID | zulässige Message-/Recipient-Kinds enthalten noch keinen Widerruf; Versand ist per Feature-Flag deaktivierbar |
| Audit/Evidenz | unveränderbare Vertrags-Snapshots; unveränderbare Delivery-Events; Seller-Audit; Account-Data-Rights-Audit | es gibt noch keinen unveränderbaren Widerrufseingang. In Staging: 8 Snapshots, 8 Outbox-Zeilen, aber 0 Delivery-Events |
| Berechtigungsgrenze | private Tabellen ohne Browsergrants; Teilnehmer lesen Vertragsdokumente nur über prüfende RPC; Dispatcher nur `service_role` | geeignete Basis, aber Intake-/Bestätigungs-/Zuordnungs-RPCs fehlen vollständig |

### 4.2 Dokumentierte Zielarchitektur, noch nicht implementiert

1. **Vertrag widerrufen:** zentraler Einstieg ohne Vorfestlegung, dass jeder Fall gesetzlicher Widerruf ist.
2. **Zuordnungsformular:** Vertragstyp, Order/Deal oder DUELVANTA-Vertragsreferenz, erklärende Person und erreichbarer Rückkanal erfassen. Die serverseitige Zuordnung darf nicht allein auf frei eingegebenen IDs beruhen.
3. **Widerruf bestätigen:** zweite bewusste Aktion auf einem serverseitig erzeugten, kurzlebigen Bestätigungszustand; Eingabestand vor Bestätigung unverändert anzeigen.
4. **Unveränderbarer Eingangsnachweis:** private, append-only Entität mit Request-ID, Vertragsreferenz, erklärender Partei, Zielgegenpartei, Zeitstempeln, Text-/Payload-Version und SHA-256; keine nachträgliche Umschreibung.
5. **Elektronische Eingangsbestätigung:** deduplizierter Outbox-Eintrag an die erklärende Person. Aktuelle Delivery-Events beweisen nur `claimed/sent/failed`; eine Providerannahme ist nicht automatisch ein Nachweis der tatsächlichen Zustellung.
6. **Zuordnung zum richtigen Vertragspartner:** Marketplace-B2C an den zum Vertragsschluss gesnapshotteten gewerblichen Verkäufer, DUELVANTA-Direktvertrag an den Plattformbetreiber. C2C darf technisch nicht als gesetzlicher Verbraucherwiderruf etikettiert oder automatisch in denselben Folgeprozess geleitet werden.

Erforderliche technische Typentrennung:

| Technischer Vertragstyp | Automatische Behandlung |
|---|---|
| `marketplace_b2c` | als eigener Marketplace-Pfad; konkrete Rechtsfolgen erst nach rechtlicher Freigabe |
| `marketplace_c2c` | niemals automatisch als gesetzlicher Verbraucherwiderruf; gegebenenfalls neutraler Kontakt-/Stornoanfragepfad |
| `duelvanta_direct_consumer` | eigener Betreibervertrag mit eigener Referenz und Empfängerzuordnung; derzeit keine Quellentabelle/ID vorhanden |

### 4.3 Offene Entscheidungen und spätere Arbeiten

**LEGAL DECISION REQUIRED:** Anwendungsbereich, Fristbeginn, erforderliche Informationen, Ausschlüsse, Folgen, Empfänger, Umgang mit Teilwiderruf/mehreren Deals pro Order, Minderjährigen-/Vertretungsfälle, Nachweisqualität und Textversionen. Ebenso ist zu entscheiden, ob und wie der Käufer-Verbraucherstatus technisch erhoben oder der Käuferkreis beschränkt wird.

Erst nach dieser Freigabe wären technisch erforderlich:

- neue private Intake-, Confirmation- und Receipt-Entitäten statt Umnutzung von `market_order_cases`;
- explizites `contract_domain`/`contract_type` und eine stabile Gegenpartei-Referenz;
- participant-scoped Create/Confirm/Read-RPCs sowie getrennte interne Bearbeitungsrechte;
- Erweiterung von Outbox-Constraints, Renderer und Delivery-Ereignissen;
- unveränderbare Kontakt-/Routing-Snapshots, insbesondere für C2C und DUELVANTA-Direktverträge;
- getrennte Orchestrierung von Erklärung, Storno, Fulfillment-Stopp, Refund und Fallbearbeitung;
- Tests für Idempotenz, Race Conditions, Mehrfachbestätigung, falsche Order, Account-Löschung und Combined Shipping.

## 5. Datenschutz-/Datenfluss-Inventur

### 5.1 Querschnitt: Vercel und Supabase Auth

| Verarbeitung | Datenarten → Quelle → Zweck | Empfänger/Dienst und Speicherort | Zugriff | Löschung/Retention |
|---|---|---|---|---|
| Vercel Hosting/Functions | HTTP-Anfrage, IP-/Header-/Routing-Metadaten sowie je API Auth-Header und Request-Body → Browser/Provider-Webhooks → Auslieferung, Runtime-Config, Scanner, Dispatcher, Stripe | Vercel-Projekt `duelvanta_v5_vision`; konkrete Function-Region ist im Repo nicht festgelegt. Branch-Preview `d6d4653…` war bereits `READY`, `target=null` | Vercel-Projektzugriff und jeweilige API-Guards; Secrets nur serverseitig erwartet | keine anwendungsseitige Vercel-Log-Retention konfiguriert/feststellbar; Provider-Einstellungen **LEGAL REVIEW REQUIRED** |
| Supabase Auth | E-Mail, Passwort-/Magic-Link-/Reset-/MFA-Vorgänge, User-ID, Session-/Access-Token → Nutzer/Browser → Authentifizierung und Step-up | je nach Seitencode Staging oder Production-Supabase Auth; SDK persistiert Sessions im Browser | Nutzer für eigene Session; serverseitige Tokenprüfung; Owner-Pfade teilweise AAL2 | Sign-out beendet lokale Session; Account-Erasure-Worker kann Auth-Nutzer löschen oder bei Holds sperren. Provider-/Backup-Retention **LEGAL REVIEW REQUIRED** |
| Browserlokal | Supabase-Session, Locale, Aktivitäts-/UI-Zustände und idempotente Checkout-Request-ID → Browser → Session/UX/Race-Schutz | Browser Storage/Memory des Nutzers | derselbe Browser-Origin | teils bei Sign-out/Sessionende, teils ohne zentralen Cleanup; **LEGAL REVIEW REQUIRED** |

### 5.2 COLLECT

| Verarbeitung | Datenarten → Quelle → Zweck | Empfänger/Dienst und Speicherort | Zugriff | Löschung/Retention |
|---|---|---|---|---|
| Collection-Daten | Kartenname, TCG, Set/Nummer, Sprache, Variante, Zustand, Grading/Zertifikat, Menge, Kaufpreis/-datum, Marktpreis, Notiz, Binderposition, Scanquelle/-Konfidenz → Nutzer/Scanner → Sammlungsverwaltung | Supabase PostgreSQL `collection_items`, `collection_folders` | Eigentümer über RLS; bewusst freigegebene Profil-/Collection-Daten über eingeschränkte Public-RPCs | Account-Data-Rights-Workflow sieht Löschung von `user_content` vor; tatsächliche Production-Ausführung nicht geprüft. Keine fachliche Einzelobjekt-TTL |
| Karten-/Profilbilder | Kamera/Dateiauswahl, zugeschnittener Kartenscan, Avatar → Browser → Anzeige/Sammlung/Profil | Supabase Storage, Code-Buckets `collection-cards` und `profile-avatars`; Pfad in PostgreSQL | Eigentümerpfade, signierte URLs bzw. Avatar-Public-URL gemäß Bucket/Policy | Storage soll beim Erasure vor DB-Daten entfernt werden; individuelle Upload-/Entfernpfade vorhanden. In Staging existiert keiner dieser beiden Buckets – dort nur `market-listing-images` |
| OpenAI-Scanner | JPEG bis 1,6 MB, TCG/Scanart, Request-ID → Browserkamera/Datei → Kartenerkennung | Browser → Vercel Function → OpenAI Responses API, Modellkonfiguration `gpt-5.4-mini`, `store:false`; Bild wird im Code nicht serverseitig dauerhaft abgelegt | authentifizierter Nutzer, Quotenreservierung vor Provideraufruf | Response liefert strukturiertes Ergebnis; Quoten-/Kostenledger speichert u. a. Bild-SHA-256, Token, Kosten, Status. `store:false` ersetzt keine Prüfung der Provider-Retention: **LEGAL REVIEW REQUIRED** |
| Scanner-Accounting | User-ID aus Access-Token, Request-ID, Bildhash, TCG/Art, Token-/Kostenschätzung → Vercel Scanner → Quota und Abrechnung | fest Production-Supabase `dv_v16_private`; Vercel-Log enthält Modell/Art/TCG/Token/Kosten/Laufzeit, bei Pending auch Request-ID | Auth-Token plus serverseitiger Accounting-Key | keine automatische Löschlogik im geprüften Pfad festgestellt; **LEGAL REVIEW REQUIRED** |

Wichtiger Ist-GAP: `collect.html` adressiert Production-Supabase fest. Die Staging-Inventur (6 `collection_items`, fehlende COLLECT-Buckets) ist daher keine Aussage über den tatsächlichen Production-Datenbestand oder dessen Policies.

### 5.3 TRADE

| Verarbeitung | Datenarten → Quelle → Zweck | Empfänger/Dienst und Speicherort | Zugriff | Löschung/Retention |
|---|---|---|---|---|
| Listings/Offers/Deals | Karten-/Produktdaten, Preis, Menge, Text, Verkäufer/Käufer, Angebot, Status-/Zeitpunkte → Nutzer → Inserat, Verhandlung, Vertrag | Supabase PostgreSQL public Tabellen mit RLS/RPC-Grenzen | aktive Listings lesbar; Mutationen eigentümer-/teilnehmerbezogen; Deal/Order primär über Security-Definer-RPCs | Draft-/Listing-Aktionen vorhanden; kein allgemeiner Vertragsttl. Staging-Aggregate: 2 Offers, 8 Deals |
| Orders/Fulfillment | Ordernummer, Dealpositionen, Versandart/-kosten, Lieferadresse-Snapshot, Tracking, Abholung, Nachrichten, Fälle, Status → Käufer/Verkäufer/AfterShip → Erfüllung/Nachweis | Supabase PostgreSQL public/private | nur Parteien bzw. privilegierte Dienste/RPCs | Standardadresse separat löschbar; bestehende Order-Snapshots bleiben unverändert. Pickup-/Tracking-Retention nicht vollständig automatisiert; **LEGAL REVIEW REQUIRED** |
| Vertragsnachweis | Parteien, C2C/B2C, Verkäuferstatus/-kontakt, Produkt, Preise, Versand, Zeitpunkt, Bestätigungstext, SHA-256 → Checkout → Beweis/Download | private `market_contract_snapshots`, Staging 8 Datensätze | keine Browser-Tabellenrechte; Teilnehmer-RPC | Update/Delete technisch blockiert. Konfigurierte Regel verlangt manuelle Fristprüfung; rechtliche Dauer **LEGAL REVIEW REQUIRED** |
| Verkäufer-Compliance | Legalname, Anschrift, Unternehmen/Rechtsform, Kontakt, Registerdaten, verschlüsselte Tax-ID, Erklärungen, Status/Audit → Verkäufer/Owner → Onboarding/Klassifikation | public Seller-Status plus private Supabase-Tabellen | Verkäufer über eng begrenzte RPCs; Owner-/Service-Pfade; private Tabellen ohne Browsergrants | Änderungs-/Audit-Historie bleibt; konkrete Aufbewahrung und Löschfolgen **LEGAL REVIEW REQUIRED** |
| Bilder | Angebotsfotos → Verkäufer → Listingdarstellung | privater Supabase-Bucket `market-listing-images`, Staging: 8 MiB, JPEG/PNG/WebP, 3 Objekte | Pfad-Eigentümer-Upload/-Delete; authentifizierter Select laut Policy/signierte URLs | Draft-Abbruch und Bildentfernung löschen Objekte explizit; keine allgemeine TTL. Public-Listing-Renderer signiert derzeit abweichend `collection-cards`: technischer **GAP** |
| Nachrichtenversand | Empfänger-User/E-Mail, Vertragstext oder Notice-Payload, Dedupe-/Versandstatus → DB-Outbox → elektronische Nachricht | Vercel Dispatcher → Resend; Provider-ID/Versuch/Ereignis zurück in Supabase | Claim/Finish nur `service_role`; externer Aufruf mit Dispatcher-Secret; Feature-Flag | max. 8 Versuche, Retry/Lock; kein automatischer Outbox-Cleanup. `claimed/sent/failed`, kein Provider-Delivery-Webhook im geprüften Pfad |
| Stripe Connect | Seller-E-Mail/Land/Rolle, Connected-Account-ID; Order-/Betrag-/Währungs-/Fee-Daten; Session, PaymentIntent, Charge, Refund, Event-IDs und Hash → Nutzer, Supabase, Stripe-Webhooks → Onboarding/Zahlung/Refund | Vercel APIs ↔ Stripe Connect; normalisierte Evidenz in privatem Supabase-Schema | Nutzerauth für Onboarding/Checkout; HMAC-Webhook; Refund-Worker-Secret; Service-Role-RPCs | Provider-Retention und steuerliche Aufbewahrung **LEGAL REVIEW REQUIRED**. Lokale Regeln enthalten nur zu prüfende Konfigurationsangaben; Live und Sandbox sind aktuell aus |
| Account-Datenrechte | Export-/Löschantrag, Challenge, Audit, Holds und Ausführungsplan → Nutzer/Worker → Auskunft/Löschung | private Supabase-Tabellen plus Vercel Erasure-Worker | Nutzer-RPCs; Ausführung nur Worker/Service-Role | Profile/User-Content lösch-/anonymisierbar; Vertrags-, Payment-, PStTG-, Notice- und Pickup-Daten können Holds/manuelle Prüfung auslösen. Eingetragene Rechtsgrundlagen/Fristen sind **LEGAL REVIEW REQUIRED** |

Staging-Berechtigungsbefund: private Schemas besitzen keine `anon`-/`authenticated`-Tabellenrechte. Ein Advisor-Hinweis nennt drei Tabellen ohne RLS (`dv_v16_private.openai_scan_policy`, `public.market_notification_sync_state`, `dv_market_private.seller_tax_identifiers`); gezielte Privilege-Prüfung ergab für alle drei keine Browser-SELECT/INSERT/UPDATE/DELETE-Rechte. Das ist ein Defense-in-Depth-GAP, aber nach den geprüften Grants keine direkte Browserfreigabe.

### 5.4 BATTLE

| Verarbeitung | Datenarten → Quelle → Zweck | Empfänger/Dienst und Speicherort | Zugriff | Löschung/Retention |
|---|---|---|---|---|
| Match/Lobby/Moderation | User-IDs, Anzeigenamen, TCG, Titel/Sichtbarkeit, Invite-Code, Ready-/Status-/Ergebnisdaten, Moderator, Reports/Details/Entscheidung → Spieler/Staff → Match und Safety | Spielerclient fest Production-Supabase PostgreSQL; Staging enthält 12 Matches, wurde aber nicht als Spieler-Runtime verwendet | Matchteilnehmer; öffentliche Lobby-Ausschnitte; Staff rollen-/RPC-begrenzt | keine allgemeine Match-/Report-TTL im geprüften Code; **LEGAL REVIEW REQUIRED** |
| Host↔Gast WebRTC | Kamera+Mikrofon → Spielergerät → Live-Match; SDP/ICE inklusive möglicher Netzwerk-/Geräteparameter → Supabase `battle_signals`; STUN-Anfragen → Google STUN; Medien direkt zum Gegenüber | Medien nicht in Vercel/Supabase gespeichert; Signaling in PostgreSQL/Realtime | nur Matchteilnehmer nach RLS; Gegenpartei empfängt Medien | Tracks werden bei Stop/Leave/Page-Unload beendet. `clear_my_battle_signals` löscht eigene Signale und Signale älter als 1 Tag, aber nur bei RPC-Aufruf; Staging hatte 325 Signale. Keine Aufnahmefunktion |
| Spectator Foundation | Linkgeneration, Grant, User/Session/Tab, Presence-Lease, Matchsnapshot/Zuschauerzahl → Host/Zuschauer → read-only Zugang | fest Supabase-Staging private Schemas/RPCs | authentifiziert, Safety-/Rollenprüfung; Zuschauer ohne Spieler-/Judge-Rechte | Presence-Lease 75 s, Heartbeat 20 s; abgelaufene Presence wird bei Abläufen/RPCs bereinigt. Links/Grants werden bei Rotation/Terminalzuständen entfernt; keine pauschale Historien-TTL |
| Spectator Media Consent | Match/User, Consent-Version/Bool, Zeit, Media-Epoche, Revocation-Grund/Status → beide Spieler/System → Admission und Widerruf | Supabase-Staging private Tabellen; aktuell 2 Consents, 1 Epoch, 3 Revocations | Browser nur über Teilnehmer-RPC; Tabellen ohne Browsergrants | Cascade bei Matchlöschung; Revocation bleibt als persistente Outbox. Weitere Aufbewahrung **LEGAL REVIEW REQUIRED** |
| LiveKit SFU | bereits vorhandene Spieler-Kamera-/Mikrofontracks, pseudonyme Identity mit Match/Epoch/Rolle, Raumteilnahme → Spieler → Live-Zuschauerübertragung | Supabase Edge Broker → separates LiveKit-Cloud-Projekt, Region EU/Frankfurt; 45-s-Token, Raumname aus Match/Epoch | Publisher nur Camera/Microphone; Viewer subscribe-only, kein `getUserMedia`; max. 50 serverseitig | keine dauerhafte Aufnahme in Media V1; Disconnect/Revocation über Reconciler/`RemoveParticipant`. Provider-Logs/-Retention **LEGAL REVIEW REQUIRED** |

Spectator Media bleibt ungeprüft am separaten Mehrgeräte-Gate. `media_enabled=true` und aktive Edge Functions sind kein praktischer Ende-zu-Ende-Nachweis. Der Broker ist ACTIVE v2 mit JWT-Prüfung; Reconciler ACTIVE v5. Es wurde in diesem Preflight weder LiveKit verbunden noch ein Revocation-Lauf ausgelöst.

## 6. Datenstand, Löschung und Berechtigungsgrenzen – Gesamtbefund

**Technisch vorhanden:** RLS/RPC-Teilnehmergrenzen, private Schemas, Service-Role-Dispatcher, AAL2 für ausgewählte Owner-Flows, immutable Vertrags- und Auditobjekte, Storage-Pfadtrennung, Account-Export/Erasure-Planung sowie einzelne explizite Objektlöschungen.

**Technische GAPs:** gemischtes Production-/Staging-Routing; fehlende Staging-Buckets für COLLECT/Avatar; keine zentrale providerübergreifende Retention-Matrix; kein automatischer Cleanup mehrerer Historien-/Auditklassen; aufrufabhängiger Signaling-Cleanup; fehlende Delivery-Webhooks; Storage-Bucket-Mismatch im Public-Listing-Renderer; fehlende Widerrufsdomäne.

**LEGAL REVIEW REQUIRED:** Zwecke, Rollen von Verantwortlichen/Auftragsverarbeitern, Empfängerkategorien, Drittland-/Regionenbewertung, tatsächlich erforderliche Datenminimierung, Rechtsgrundlagen, Informationspflichten, Einwilligungs-/Widerrufstexte, Minderjährigenbezug, Providerverträge sowie jede konkrete Aufbewahrungs- oder Löschfrist. Der Code- oder DB-Text darf hierfür nicht als Freigabe verwendet werden.

## 7. Später notwendige Arbeiten – erst nach Rechtsentscheidung

1. Vertragsschluss-Zielmodell zu Ziffer 13 freigeben und erst danach Deal-/Order-/Snapshot-/Outbox-/Payment-Zeitpunkte als eine konsistente Zustandsmaschine spezifizieren.
2. Käuferstatus und belastbare C2C/B2C/B2B-Abgrenzung entscheiden; vorhandenes `seller_type` allein genügt technisch nicht als Käufernachweis.
3. Zentrale Widerrufsdomäne mit `marketplace_b2c`, `marketplace_c2c` und `duelvanta_direct_consumer` spezifizieren; Erklärung, Storno, Refund und Case getrennt halten.
4. Environment-Routing zentralisieren; Preview darf nicht seitenabhängig Production und Staging mischen. Danach Storage-Buckets und Policies je Umgebung abgleichen.
5. Provider- und Datentyp-spezifische Retention-/Deletion-Matrix rechtlich freigeben und technisch mit überprüfbaren Jobs, Holds und Audits umsetzen.
6. Elektronische Eingangs-/Versandbestätigung um Provider-Delivery-Ereignisse oder eine ausdrücklich freigegebene Nachweisgrenze ergänzen.
7. Erst nach separater Nutzerfreigabe das pausierte Spectator-Media-Mehrgeräte-Gate fortsetzen.

## 8. Reproduzierbare Hauptquellen

- Vertragsschluss/Checkout: `trade-checkout.js`, `trade-offer-details.js`, `trade-offer-checkout.js`, `database/trade-checkout-v1*.sql`, `database/b07-l07-01-offer-reservation-v1.sql`, `database/market-checkout-compliance-v1.sql`.
- Order/Stripe/Dispatcher: `trade-orders.js`, `api/market-stripe-*.js`, `database/market-stripe-*.sql`, `api/compliance-message-dispatch.js`.
- Verkäufer/Datenschutz: `database/market-seller-compliance-v1.sql`, `database/account-data-rights-*.sql`, `api/account-data-erasure.js`.
- COLLECT/OpenAI/Storage: `collect.html`, `scanner-v16-ui.js`, `api/scanner-v16-recognize.js`, `benchmark/scanner-pilot/recognize-server.cjs`, `benchmark/scanner-pilot/openai-server.cjs`.
- BATTLE/Media: `battle.js`, `battle-webrtc.js`, `battle-spectator.js`, `battle-spectator-media-*.js`, `database/battle-spectator-*.sql`, `supabase/functions/battle-spectator-media-reconciler/index.ts` sowie die aktive Staging-Edge-Function `battle-spectator-media-broker` v2.
- Umgebung: `vercel.json`, `api/compliance-message-dispatch.js`, Vercel-Projektmetadaten, GitHub Branch/PR/Actions und die read-only Staging-Abfragen vom 2026-09-20.

## 9. Preflight-Schluss

Der vorhandene Code enthält belastbare technische Bausteine für Snapshots, Routing, Audit und Versand. Er bildet die vorgegebene Annahmesystematik aus Ziffer 13 jedoch derzeit nicht ab. Die zentrale Widerrufsfunktion ist strukturell vorbereitbar, aber ohne neue, ausdrücklich typisierte Intake-/Receipt-Domäne und ohne vorangehende Rechtsentscheidungen nicht implementierungsreif. Die Datenflüsse sind wegen des gemischten Environment-Routings vor einer späteren Produktfreigabe nochmals nach dessen Bereinigung end-to-end zu verifizieren.

In diesem Preflight wurden keine Anwendungscodes, Datenbanken, Providerkonfigurationen, Deployments oder produktiven Systeme verändert.
