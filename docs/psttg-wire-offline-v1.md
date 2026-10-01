# V116 sendefreier Fachserializer-/Receiptparser-Kandidat

Private Offline-Implementierung unter `tests/psttg_wire/`, ausgeführt durch
`python tests/psttg-wire-test.py` (Python 3.12, lxml 6.1.1). Kein App-Import,
HTTP-Client, öffentlicher Einstieg, Scheduler, Worker oder neuer SQL-Vertrag.
Das Anwendungsframework und alle fünf PStTG-SQL-Dateien bleiben unverändert.

## Bindung und geschlossene Eingänge

`SourcePack` bindet vollständige kontrollierte synthetische Quellenfassungen,
Betreiber, Personen/Konten, Ereigniswerte und Entscheidungen. `decode` verweigert
zusätzliche/fehlende Felder und Typumwandlungen. Limits: höchstens 100 Positionen,
1000 Elemente pro Eingangsarray, 4 MiB XML/ZIP/entpackte Bytes, 40000 XML-Knoten,
Tiefe unter 32. Überschreitungen werden abgewiesen, niemals abgeschnitten.

`EditionBook` ist ausdrücklich ein flüchtiges Testmodell, kein dauerhafter
Datenbankcommit. Eine Fassung bindet kanonische Originalquellenbytes, Operator,
Jahr, vollständige geordnete Positionen, typisierte Dokumentreferenzen, Regel-
und Schemastand, Erstellungszeit und erzeugte XML-Bytes. Wiederholung derselben
Fassung liefert dieselben Bytes; Konflikte überschreiben nichts. Neue Quellen
benötigen eine neue Revision. Erstlieferungen müssen sämtliche bekannten
Positionen enthalten; Ergänzungen genau die noch nicht angenommenen Positionen.
Korrekturen nutzen eine explizite vollständige Änderungsmenge und jüngste
angenommene gleichartige Referenzen. Der gesamte ReportableSeller wird ersetzt.

Der Serializer schreibt reine DPI_OECD-Ausgabe. Kein DIP-Sendecontainer.
Der erneute Parse vergleicht vollständige expandierte Namen, Attribute, Werte,
Reihenfolge und sämtliche DocRefIds mit der aus dem typisierten Modell erzeugten
Projektion. Ein schemafähiges, aber zusätzliches oder geändertes Feld scheitert
am separaten geschlossenen Geschäftsregel-/Projektionsvergleich.

## F01–F32 / X01–X09

| IDs | Tatsächliche Abbildung |
|---|---|
| F01–F05 | Operator.legal_name/address/tax_ids/registration/platform_names; inländische Registrierungs-Nichtanwendbarkeit explizit; Name, TIN, Address und PlatformBusinessName |
| F06 | Jahr, GOODS_SALE, ReportingPeriod und SaleOfGoods |
| F07 | position_ref/content_revision/predecessor_ref intern; amtliche Referenzkette separat |
| F08 | Profil, gepinntes Katalogcommitment, RULES; DPI root version 1.0 |
| F09 | Delivery.message_ref und typisierte Operator-/Seller-DocSpec, stf-Kinder |
| F10 | DE/DE im Fachformat; ausschließlich TEST-Synthetic-Korrelation mit getrenntem Kunden-/Kanal-/Versuchsbezug |
| F11 | person_ref und vollständige seller_ids, nur natural_person; Bestandsabgleich auf doppelte/fehlende Personen/Konten |
| F12–F15 | Namensfelder, verlustfreie freie Straßenzeilen plus City/PostCode, Länder, geprüftes Geburtsdatum |
| F16 | TIN-Wert, Aussteller und interne Art/Zuteilungs-/Prioritätsbelege; W-ID, IdNr, Steuernummer und ausländische TIN getrennt |
| F17 | belegter Nichtvergabe-Testfall und vollständiger BirthPlace; keine leere TIN als unbekanntes Wissen |
| F18–F19 | tatsächlicher VAT-Wert oder expliziter Abwesenheitsbeleg; geordnete Ansässigkeitsmenge mit EU-Bezug |
| F20–F21 | qualifizierte Finanzkonten, AccountHolderName und belegte verlustfreie OtherInfo-Projektion; DE-Ausnahme separat |
| F22 | GVS geschlossen ausgeschlossen; keine XML-Testcodes |
| F23 | eligibility/assessment/cutoff/completeness/account/activity/financial decisions intern |
| F24–F28 | vier Quartale; exakte Integer-Centereignisse; EUR pro Geldfeld; ConsQ/NumbQ/FeesQ/TaxQ; Gebührenkomponenten summiert |
| F29 | Kontrollgleichung je Ereignis und Jahreskontrollen; nichtintegrale Quartalsfelder Reject; keine Floats/Rundung |
| F30 | Zahlungs-/Korrektur-/Quellzeiten, Originalperiode und Timestamp getrennt; Vollrefund referenziert Original und behält dessen Periode |
| F31 | konkrete Eventwerte samt ID/Key/Version/Snapshot/Allocation/Source/Evidence, vollständiges Ereignisinventar |
| F32 | ausschließlich geschlossene synthetic_test/TEST/Fixture-Provenienz; keine reale Herkunftsbehauptung |
| X01–X04 | SendingEntityIN an Betreiberkennung gebunden; DPI; DPI401/402; stabile Erstellungszeit |
| X05–X08 | Operator-DocSpec; OECD304-Sitzadresse; belegte ResCountryCode/VAT und false AssumedReporting, Nexus ausgeschlossen; ein DPIBody |
| X09 | Fachformat bewusst ohne Versandhülle; DIP-Version 2.0 und DAC7 werden ausschließlich im kontrollierten Receipt-/NN-Kontext geprüft |

M01 bleibt offen: Centquellen bleiben unverändert; nur je Quartalsfeld exakt
ganzzahlige EUR sind erlaubt. Zwei Centquellen dürfen ohne Rundung zu einem
ganzen EUR-Wert summieren. Tätigkeitszählung und Herkunft sind kontrollierte
synthetische Eingangsbelege, keine reale PStTG-Prüfung.

## Schemas und Quelldifferenzen

Acht Originaldateien mit Namespace, originalem Mitgliedspfad und SHA256 im
`schemas/catalog.json`. Katalogcommitment zusätzlich im Code gepinnt. Alle
Imports/includes werden vor Kompilierung auf Namespace, exakten Dateinamen und
Hash geprüft; Resolver kennt ausschließlich diese Dateien. DTD/Entities,
Remote-Schemahinweise, äußere Processing Instructions und unbekannte Tags werden
nicht als gültige Fachausgabe angenommen. Kein amtliches XSD geändert.

D01 DPI/DAC7 getrennt; D02 TaxQ; D03 AccountHolderName/exakte Namen;
D04 messageinformations nicht implementiert (kein Client); D05 echte NN-Enums;
D06 keine Portalprobe; D07 Bytepin statt Datumsglättung; D08 lokaler DSM-Katalog;
D09 keine OpenAPI-Generierung/ungeprüften amtlichen Beispielorakel;
D10 kein testdata-Aufruf; D11 keine Authimplementierung.

NN unterstützt ausschließlich das sendefreie Zweidateiprofil metadaten.xml und
daten.xml. anhang.zip, weitere/nestende Archive, doppelte Pfade und Symlinks
werden geschlossen abgewiesen. Das ist eine bewusste Profilgrenze, keine
Behauptung, dass der allgemeine NN-Kanal keine Anlagen kennt.

## Receipt und native Testgrenze

`ReceiptBook` bindet eine vorregistrierte synthetische Gegenstellenfassung an
Inputbytes/Versuch/Transfernummer/Ticket/Response/Item/Kunde/Message/NN-Kennungen.
Getrennte Typidentitäten können nicht still auf einen anderen Versuch zeigen.
Finales korreliertes DIP OK darf ohne DSM akzeptieren. Teilablehnung benötigt
eindeutige vollständige RecordError-Zuordnung; File-/Operatorfehler verhindern
jede Annahmeaussage. Widerspruch/unbekannte Referenz bleibt unresolved/conflict.
HTTP-Schritterfolg oder fehlende Quittung ist UNKNOWN und erzeugt keinen Versuch.
Gleiche Identität mit anderen Bytes bleibt konfliktbehaftet; beide Bytes bleiben
im Testjournal erhalten. NN-Metadaten/ZIP/Fachbytes werden separat gehasht.
Stand-alone DSM ohne finalen DIP-Kontext erzeugt keine spekulative Annahme.

Die zusätzliche `--wire`-Prüfung in `psttg-v2-connection-test.mjs --native --wire`
verwendet das bestehende SIMULATED-Ingressformat und die vorhandene UnitTestPeer-
Gegenstelle. Eine opaque Testreferenz bindet die separat vollständig gehashten
Offline-Receiptbytes. Sie prüft Rollback, unabhängige PG17-Sicht vor/nach Commit,
identischen Replay, Konflikterhalt/Stop und keine zweite simulierte Wirkung.
**Kein nativer Speicheradapter für den neuen Fachkörper oder reale Behördenbytes.**
Der Vier-Felder-V114-Vertrag bleibt unverändert; neue Fachtests ersetzen ihn nicht.
Keine PATCH-Quittung, keine Produktpfadannahme. Die neue Python-Prüfung beansprucht
keinen nativen Commitnachweis.

W01–W10/W13: Offline-XSD-/Geschäftsregel-/Referenztests mit benannten Fällen.
W11: getrennte Offline-Bytekonflikte und native V114-Gegenstelle.
W12 ausdrücklich OPEN (M02–M04). W14: bytegleiche SQL-/Produktquellen plus
bestehende native Rechte-/C-/L1-/K5-/V2-Regressionskette im unveränderten CI-Aufbau.

M02 Signaturprüffolge, M03 Betreiber-/M2M-Zugang, M04 echter Kanal und M05 reale
Quellen-/Pflicht-/Kontenbindung bleiben OPEN. OECD3 ändert ausschließlich das
flüchtige synthetische Referenzbuch; keine Datenlöschung, Holdfreigabe oder
Endbelege. Provisionsrechnungen und Steuerdaten-/Schwellen-/Mitwirkungsprozess
separat OPEN; maximal 4 % Verkäufergesamtgebühr einschließlich Stripe.
