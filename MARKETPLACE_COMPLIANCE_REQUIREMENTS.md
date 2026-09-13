# DUELVANTA Marketplace Compliance Requirements

Stand: 13.09.2026

Betreiberziel: Benjamin Fritz – DUELVANTA, Einzelunternehmen

Status: Verbindliche Entwicklungsgrundlage; kein Ersatz für die anwaltliche und steuerliche Schlussprüfung vor dem kommerziellen Start.

## 1. Unveränderliche Projektgrenzen

- DUELVANTA vermittelt Verträge zwischen Verkäufer und Käufer. DUELVANTA ist nicht automatisch Verkäufer der angebotenen Ware.
- Verkäufer können privat oder unternehmerisch handeln. Der Status wird nicht aus Anzeigename, Umsatz oder Selbstdarstellung abgeleitet, sondern in einem eigenen Onboarding erfasst.
- Die Vertrags- und Informationspflichten richten sich nach der konkreten Verkäufer-/Käufer-Konstellation. Ein B2C-Ablauf darf nicht pauschal auf C2C übertragen werden.
- Zahlungsdienste und Auszahlungen werden später ausschließlich über einen zugelassenen Marketplace-Zahlungsdienstleister umgesetzt. DUELVANTA nimmt keine Kundengelder auf einem eigenen Konto entgegen und bezeichnet seine Leistung nicht als Escrow oder Treuhand.
- `payment_provider = manual_beta` bleibt bis zur gesonderten Zahlungsintegration bestehen. Es werden keine ausgeführten Zahlungen, Auszahlungen oder Erstattungen behauptet.
- Der Review-Entwurf für Stripe Connect verwendet ausschließlich deaktivierte Testmodus-Grenzen und Direct Charges im Verkäuferkonto. Eine Sandbox- oder Produktivaktivierung ist damit nicht freigegeben.
- Das originale `v-logo.svg` sowie der Slogan `COLLECT. TRADE. BATTLE.` bleiben unverändert.
- Scanner, COLLECT, BATTLE und bestehende stabile Handelsfunktionen werden außerhalb eines nachgewiesenen Fehlers nicht verändert.
- Entwicklung, Migrationen und Tests bleiben bis zur Gesamtfreigabe außerhalb der Produktion. Keine echten Käufe, E-Mails oder Zahlungen zu Testzwecken.

## 2. Rollen- und Vertragsmodell

| Rolle | Bedeutung | Öffentliche Kennzeichnung | Checkout-Folge |
|---|---|---|---|
| Plattformbetreiber | Benjamin Fritz – DUELVANTA | Impressum und Plattforminformationen | Vermittler; eigene Gebührenrechnung an Unternehmer nur nach anwendbarem Steuerrecht |
| Privater Verkäufer | natürliche Person, die nicht als Unternehmer handelt | „Privater Verkäufer“ | C2C-Regeln; kein gesetzliches Unternehmer-Widerrufsrecht vortäuschen |
| Gewerblicher Verkäufer | Unternehmer im Sinne des konkreten Angebots | „Gewerblicher Verkäufer“ und erforderliche Anbieterinformationen | B2C-Pflichten, sofern Käufer Verbraucher ist |
| Käufer | angemeldeter Nutzer | nicht öffentlich als Verbraucher/Unternehmer klassifiziert | vor Vertragsschluss erforderliche Erklärung nur soweit notwendig |
| Owner/Staff | interne Moderations- und Prüfrolle | bestehende Rollen bleiben erhalten | keine automatische Händler- oder Steuerrolle |

Ein Nutzer darf seine technische Rolle (`owner`, `admin`, `moderator`, `player`) nicht durch das Verkäufer-Onboarding verändern. Verkäuferstatus, Prüfstatus und interne Moderation sind getrennte Achsen.

## 3. Verbindliche Anforderungsmatrix

| ID | Priorität | Anforderung | UI / Verhalten | Daten / Sicherheit | Abnahme |
|---|---:|---|---|---|---|
| SELL-01 | P0 | Verkäuferart erfassen | Einmalige Auswahl „Privat“ oder „Gewerblich“ mit verständlichen Folgen | eigener Verkäuferdatensatz; keine Berechtigung in `user_metadata` | normaler Nutzer kann nur den eigenen Entwurf lesen/ändern |
| SELL-02 | P0 | Verkauf erst nach vollständigem Onboarding | klarer Fortschritt und genau eine nächste Aktion | serverseitige Verkaufsfreigabe; Frontend allein genügt nicht | unvollständiger/suspendierter Verkäufer kann kein Inserat aktivieren |
| SELL-03 | P0 | Bestehende Beta-Nutzer nicht falsch klassifizieren | Bestandsnutzer erhalten „Einstufung erforderlich“ | Migration setzt `unclassified/legacy_beta`, nie automatisch „privat“ | vorhandene Listings/Daten bleiben unverändert |
| SELL-04 | P0 | Öffentliche Verkäuferkennzeichnung | Angebotskarte und Detailansicht zeigen Privat/Gewerblich | ausschließlich freigegebene öffentliche Projektion | fremde Nutzer sehen keine privaten Steuer-/Identitätsdaten |
| SELL-05 | P0 | Gewerbliche Anbieterinformationen | rechtliche Angaben über kompakten Link/Abschnitt erreichbar | Veröffentlichung nur für geprüfte, aktive Händlerdaten | Angaben sind einem konkreten Verkäufer zugeordnet und versioniert |
| SELL-06 | P1 | Erklärungen versionieren | AGB-/Verkäuferbedingungen nicht vorausgewählt | Version, Zeitpunkt und Zweck protokollieren | erneute Zustimmung nur bei relevanter neuer Version |
| TAX-01 | P0 | PStTG/DAC7 von Beginn an messbar | keine wiederholte Eingabe pro Inserat | unveränderbare Transaktions-/Vergütungsgrundlage pro Meldejahr und Quartal | exakt 30 Vorgänge oder exakt 2.000 EUR werden nicht als Freistellung behandelt |
| TAX-02 | P1 | Meldeexport vorbereiten | nur Owner/autorisiertes Backend | CSV/JSON aus verifizierten Daten und Transaktionsereignissen | kein direkter Browserzugriff auf Steuerdaten |
| LIST-01 | P0 | Schnelles Inserieren erhalten | Produktdaten automatisch; Preis, Menge und Versand im Vordergrund | serverseitige Validierung der Verkaufsfreigabe | optionalen Angaben bleiben eingeklappt und funktional |
| LIST-02 | P0 | Wesentliche Produktmerkmale | Karte/Produkt, Variante, Zustand, Sprache, Menge und Preis eindeutig | Snapshot bei Bestellung; spätere Listing-Änderung ändert Altbestellung nicht | Käufer sieht vor Abschluss die tatsächlich bestellte Variante/Menge |
| LIST-03 | P0 | Rechtswidrige Angebote melden | „Produkt/Verstoß melden“ leicht erreichbar | Notice-Datensatz, Empfang, Status, Entscheidung und Begründung | Melder und Verkäufer erhalten nur jeweils zulässige Informationen |
| CHECK-01 | P0 | Vertragspartner eindeutig | Verkäuferstatus und Vertragspartner unmittelbar vor Abschluss | Verkäufer-/Betreiber- und Angebots-Snapshot | spätere Profiländerung verändert keine abgeschlossene Bestellung |
| CHECK-02 | P0 | Gesamtpreis transparent | Warenwert, Versand, sonstige Kosten und Gesamtbetrag | serverseitig berechnete Beträge | keine leeren Versandkosten als 0,00 EUR darstellen |
| CHECK-03 | P0 | Button-Lösung für B2C | exakt „Zahlungspflichtig bestellen“ | Abschluss nur nach gültiger serverseitiger Prüfung | Pflichtinformationen unmittelbar vor dem Button hervorgehoben |
| CHECK-04 | P0 | C2C nicht als B2C ausgeben | Hinweis „Privatverkauf“ ohne erfundenes Widerrufsrecht | Verkäuferart-Snapshot | Status bleibt in Bestellbestätigung nachvollziehbar |
| CHECK-05 | P0 | Lieferadresse schützen | nur Käufer und zuständiger Verkäufer im laufenden Auftrag | bestehender Adress-Snapshot und Zugriffsnachweis bleiben erhalten | Adressänderung überschreibt keine alte Order |
| ORDER-01 | P0 | Bestellbestätigung auf dauerhaftem Datenträger | klare Zusammenfassung nach Vertragsschluss | Dokumentversion/Versandstatus protokollieren | Inhalt entspricht dem unveränderbaren Checkout-Snapshot |
| ORDER-02 | P1 | Rechnungsketten korrekt trennen | Produktbeleg und Plattformgebühr nicht vermischen | Rechnung nur im Namen des Händlers bei wirksamer Vereinbarung | private Verkäufer erzeugen keine Umsatzsteuerrechnung |
| ORDER-03 | P1 | Aufbewahrung und Löschung nach Datenart | Nutzer sieht Folgen einer Kontolöschung | kein pauschales Alles-oder-nichts; Fristen je Dokumenttyp | Buchungsbelege grundsätzlich 8 Jahre, bestimmte Bücher 10 Jahre; längere Sperrfristen möglich |
| PAY-01 | P1 | Marketplace-Zahlungsanbieter | erst nach Checkout-Abnahme, zunächst Sandbox | Provider-KYC, Payment- und Payout-IDs serverseitig | keine geheimen Schlüssel im Browser/Repository |
| PAY-02 | P1 | Gebühren konfigurierbar | Gebühr vor Verkäuferfreigabe transparent | Provision, Fixgebühr und Steuer getrennt; keine pauschale 19-%-Annahme | Rundung und grenzüberschreitende Fälle geprüft |
| PAY-03 | P1 | Storno, Problem und Refund | je Status nur eine klare nächste Aktion | idempotente Provider-Aufrufe; Audit-Log | Wiederholung erzeugt keine Doppelzahlung/-erstattung |
| SEC-01 | P0 | RLS und minimale Rechte | keine sichtbare Auswirkung | alle exponierten Tabellen mit RLS; Eigentumsprüfung; private Schemas ohne Browser-Grant | anonyme/fremde Zugriffe negativ getestet |
| SEC-02 | P0 | Sensible Verkäuferdaten trennen | Nutzer sieht nur eigenes Onboarding | Steuer-, Geburts-, Identitäts- und Bankdaten nie in `profiles` oder Listings | öffentliche API liefert ausschließlich freigegebene Offenlegungsfelder |
| SEC-03 | P1 | Starke Authentisierung | MFA für sensible Änderungen und Händlerzugriff | AAL2-Prüfung serverseitig; Wiederherstellungscodes über Auth-Anbieter | IBAN/Steuer-/Identitätsänderung ohne AAL2 blockiert |
| PRIV-01 | P0 | Datenschutz durch Datenminimierung | Pflichtfelder nur passend zu Verkäuferart/Phase | Zweck, Rechtsgrundlage, Frist und Zugriff je Feld dokumentiert | private Verkäufer müssen keine gewerblichen Registerfelder ausfüllen |
| CONSENT-01 | P1 | Consent nur bei Bedarf | Ablehnen und Akzeptieren gleichwertig; jederzeit änderbar | nicht notwendige Skripte vor Einwilligung blockiert | ohne Zustimmung keine Marketing-/Analyseanfrage |

## 4. Aktueller Stand und Lücken

Bereits vorhanden und zu erhalten:

- Festpreis und Verhandlungsbasis, Mengen und Staffelpreise.
- Bestellungen, Angebote, Versandprofile, Combined Shipping und Order-Aktionen.
- geschützte Standard-Lieferadresse und unveränderliche Adress-Snapshots.
- Benachrichtigungen, Storno-/Problemvorbereitung und `manual_beta`.
- mobile Marketplace-Vereinfachung im Review-Branch.

Noch nicht vorhanden:

- produktiver Zahlungsanbieter, Rechnungs- und Gebührenlogik.

Im Review-Branch umgesetzt, aber noch nicht produktiv aktiviert:

- Verkäuferart, Onboardingstatus, getrennte private Rechtsdaten und geprüfte Händleroffenlegung.
- serverseitige Verkaufsfreigabe mit sicher deaktiviertem Rollout-Schalter.
- Notice-and-Action-Verfahren: öffentliches elektronisches Meldeformular, privater Eingang, Vorgangsbestätigung, menschliche Owner-Prüfung, begründete Entscheidung, Verkäuferinformation, Einsprüche beider Seiten und unveränderbarer Audit-Verlauf.
- unveränderbare C2C/B2C-Vertragssnapshots, Bestellbestätigung und standardmäßig deaktivierter Nachrichten-Dispatcher.
- PStTG/DAC7-Ereignisledger sowie prüfbarer Jahres-/Quartalsexport; Vertragsbildung zählt unter `manual_beta` nicht als Vergütung.
- eigener JSON-Datenexport, Löschblocker, sofortige Verarbeitungssperre und ein standardmäßig deaktivierter Lösch-Worker für Storage/Auth. Gesetzlich oder vertraglich gebundene Daten werden kategorienbezogen gesperrt; Fristen mit Einzelfallprüfung bleiben vor Produktivstart rechtlich zu bestätigen.
- standardmäßig deaktiviertes Stripe-Connect-Sandboxfundament für Direct Charges: Accounts-v2-Testkonto mit vollem Stripe-Dashboard und Stripe-gehostetem Onboarding, private Provider-Kennungen, synchronisierter `account.updated`-Status, serverseitige Betrags-/Gebühren-Snapshots, signierte und idempotente Webhooks, PStTG-Zahlungs-/Refund-Korrekturen sowie strikt getrennte Belegketten. Teilrefunds, Verkäuferrechnungen ohne Berechtigung und ungeklärte Gebührensteuer werden blockiert.

## 5. Umsetzungsreihenfolge

1. Verkäuferkonto, private Händlerdaten und sichere RPC-Grenzen.
2. Onboarding-Oberfläche mit Bestandsnutzer-Migration ohne Zwangsklassifikation.
3. Verkäuferkennzeichnung und öffentliche Händleroffenlegung.
4. serverseitige Sperre neuer/aktiver Inserate bei fehlender Freigabe.
5. Notice-and-Action-Verfahren.
6. unveränderbarer B2C/C2C-Checkout-Snapshot und Bestellbestätigung.
7. PStTG/DAC7-Ereignisledger und Export.
8. Löschung, Aufbewahrung und Datenexport.
9. Payment-Sandbox, Gebühren, Rechnungen und Refunds.
10. Gesamtprüfung, reale Abnahme, Rechts-/Steuerprüfung und erst danach Produktion.

## 6. Rechtsquellen für die Implementierung

- § 14 GewO – Gewerbeanzeige bei Betriebsbeginn.
- § 5 DDG – Anbieterinformationen des Plattformbetreibers.
- §§ 312d, 312f und 312j BGB sowie Art. 246a EGBGB – Fernabsatzinformationen, Bestätigung und Button-Lösung.
- PStTG, insbesondere §§ 4, 13 sowie 17 ff. – Anbieterdefinition, Melde- und Sorgfaltspflichten.
- Verordnung (EU) 2022/2065, insbesondere Art. 16, 17, 19–21 sowie 29–32 – Notice-and-Action, Begründungen, Einspruch und Plattformpflichten.
- DSGVO, insbesondere Art. 5, 6, 12–22, 25 und 32.
- § 25 TDDDG – Endeinrichtungszugriffe und Einwilligung.
- ZAG und die Bedingungen des später gewählten regulierten Zahlungsdienstleisters.
- §§ 14, 14b UStG sowie § 147 AO – Rechnungen und Aufbewahrung.

Bei Widersprüchen zwischen diesem Dokument und zwingendem, später geändertem Recht gilt die zum Umsetzungszeitpunkt geprüfte Rechtslage. Änderungen werden mit Quelle und Datum in diesem Dokument nachgeführt.
