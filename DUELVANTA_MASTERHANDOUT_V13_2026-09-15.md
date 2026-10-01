# DUELVANTA – Masterhandout V13

Stand: 15.09.2026, nach vertiefter B07-Prüfung und Festlegung der budgetschonenden Weiterarbeit im Chat.

Status: **B07 OFFEN / BLOCKIERT – interne Vorbereitung wird fortgesetzt**

Dieses Handout ist der aktuelle verbindliche Übergabestand. Es ergänzt V12 und das Post-V12-Delta. Bei widersprechenden Status-, Head-, CI- oder Preview-Angaben gilt V13. Die ausführlichen Rechtsbefunde stehen weiterhin in `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md`.

V13 erklärt B07 ausdrücklich **nicht** für abgeschlossen. Es dokumentiert ausschließlich die weitere Bearbeitung innerhalb von B07 und den gestuften Umgang mit externen Beratungskosten.

## 1. Verbindlicher Repository-Stand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- B07-Vertiefungsstand vor Erstellung dieses Handouts: `e2b28d2c433300873dbd1e3d13afbfd20fb525b7`
- dessen Parent / erster B07-Dokumentationsstand: `445693549566dff82df5c664aa7a12040a71dcc5`
- letzter technischer Post-V12-Stand: `236934602c20a4131cdf48ed76672bef560bbfe6`
- Produktions-`main`: `50f88213571be13255bb52eb489cc28cca660001`, unverändert
- PR #5: open, Draft, nicht gemergt
- PR Base: `main`
- PR Head: `marketplace-ux-v1`

Der Commit `e2b28d2...` vertieft ausschließlich die B07-Prüfdokumentation. Seit `236934602...` wurden keine technischen Produktdateien verändert.

## 2. Verbindlicher technischer Nachweis

Der technische Stand `236934602c20a4131cdf48ed76672bef560bbfe6` wurde vor B07 vollständig geprüft.

- Scanner V16 Check #284
- Run-ID: `34985488806`
- `validate`: success
- `quota_database`: success
- gesamter Workflow: success

Festes geprüftes Preview:

- Deployment: `dpl_2Y8P9ZgZniuLZ2dA9fj8e6zbGVop`
- Preview: https://duelvantav5vision-esnj6mr53-bennyescaped-3783.vercel.app
- Login: https://duelvantav5vision-esnj6mr53-bennyescaped-3783.vercel.app/login.html
- Preview-Supabase: `xhmjxrcskfhbovhitdej`
- Produktions-Supabase: `enifiaqsnqtbzylnfrpi`

Preview und Produktion bleiben strikt getrennt. CI #284, Preview und Login werden ohne konkreten technischen B07-Befund nicht erneut geprüft.

## 3. Blockstatus

- B01: geschlossen
- B02: geschlossen
- B03: geschlossen
- B04: geschlossen
- B05: geschlossen
- B06: geschlossen
- B07: **offen / blockiert durch qualifizierte externe Schlussfreigabe**
- B08–B12: **nicht beginnen**

B01–B06 werden nicht erneut auditiert oder verändert, außer ein konkreter B07-Befund beweist eine echte Regression. Die B07-Vertiefung hat keine solche Regression festgestellt.

## 4. Verbindliche B07-Grundlage

Vor jeder weiteren Arbeit vollständig berücksichtigen:

1. `DUELVANTA_MASTERHANDOUT_V12_2026-09-15.md`
2. dieses `DUELVANTA_MASTERHANDOUT_V13_2026-09-15.md`
3. `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md`
4. `MARKETPLACE_COMPLIANCE_REQUIREMENTS.md`
5. den technischen Post-V12-Stand `236934602...`

Die Compliance-Requirements sind Entwicklungsgrundlage, aber kein Rechtsgutachten und keine anwaltliche oder steuerliche Freigabe.

## 5. B07 – verbindlicher Zweck

B07 ist ausschließlich die qualifizierte rechtliche Schlussprüfung beziehungsweise deren vollständige Vorbereitung. Keine neuen Produktfeatures und keine allgemeine Weiterentwicklung.

Innerhalb von B07 darf im Chat:

- jeder dokumentierte Rechtsbefund einzeln untersucht werden;
- der tatsächliche DUELVANTA-Ablauf gegen aktuelle Primärquellen geprüft werden;
- zwischen sicherer gesetzlicher Anforderung, Geschäftsmodellfrage und externem Freigabepunkt getrennt werden;
- der Betreiber zu notwendigen Produkt-/Geschäftsmodellentscheidungen geführt werden;
- ein vollständiges, prüffertiges Anwalt-/Steuerberaterpaket erstellt werden;
- eine minimal notwendige technische Korrektur exakt beschrieben werden, wenn sie aus einem belastbaren Befund folgt;
- nach externer Vorgabe eine ausdrücklich freigegebene minimale B07-Korrektur umgesetzt und nachgewiesen werden.

Nicht zulässig:

- Rechtsfreigabe durch KI simulieren;
- ungeprüfte Rechtstexte als final bezeichnen;
- B07 allein aufgrund interner oder KI-gestützter Prüfung schließen;
- technische Features bauen, um einen offenen Rechtsbefund scheinbar zu erledigen;
- B08–B12 vorziehen.

## 6. Aktueller B07-Befund

Die vertiefte Prüfung ist vollständig dokumentiert in `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md` und enthält 20 strukturierte Befunde mit Risikoklasse, Einordnung, Gegenmaßnahme und externem Freigabebedarf.

Besondere R0-/R1-Schwerpunkte:

1. fehlende freigegebene Plattform- und Verkäuferbedingungen trotz versionierter Zustimmung;
2. rechtlich kritischer Verhandlungsflow, bei dem Verkäuferannahme ohne finalen Käufercheckout zum Deal führen kann;
3. unvollständige B2C-Pflichtinformationen;
4. fehlende Widerrufsbelehrung, Musterformular und elektronische Widerrufsfunktion;
5. nicht nachgewiesener dauerhafter Datenträger / tatsächlicher Bestätigungsweg;
6. unvollständige Online-Marktplatz- und Rankinginformationen;
7. ungeklärter Käuferstatus und C2C/B2C/B2B-Zuordnung;
8. offene DSA-Rolle und Pflichten einschließlich Kontaktstellen, Bedingungen, Art. 15/18 und Größenausnahmen;
9. ungeprüfte P2B-Anwendbarkeit für gewerbliche Verkäufer;
10. unvollständige Datenschutzinformationen und interne DSGVO-Governance;
11. fehlende private DPA-/SCC-/Subprocessor-/Transfernachweise;
12. fehlende vollständige TDDDG-/Endgerätezugriffsmatrix;
13. ungeklärte GPSR-Pflichten für den Online-Marktplatz;
14. nicht abgebildetes aktuelles PPWR-/VerpackDG-Regime seit 12.08.2026;
15. ungeklärte BFSG-Anwendbarkeit beziehungsweise Kleinstunternehmensausnahme;
16. nicht steuerlich freigegebene PStTG-/UStG-/Reporting-/Rechnungsprozesse;
17. ungeklärtes ZAG-/Stripe-/Gebühren-/Refund-Modell vor Livezahlungen;
18. fehlende VSBG-Scope-Entscheidung;
19. nicht abgenommene Deal-/Marktpreis-/Werbeaussagen und Datenlizenz;
20. nur vorläufiges Impressum und noch nicht endgültig belegte Betreiberrolle.

Positive technische Grundlagen bleiben erhalten, ersetzen die Freigabe aber nicht: private/gewerbliche Verkäuferklassifikation, serverseitige Händlerfreigabe, C2C/B2C-Snapshots, Festpreisbutton „Zahlungspflichtig bestellen“, Notice-and-Action, Vertrags-Outbox, PStTG-Schwellenlogik und deaktivierter produktiver Zahlungsbetrieb.

## 7. Neue verbindliche Budget- und Bearbeitungsentscheidung

Der Betreiber hat klargestellt, dass eine sofortige vollständige externe Prüfung im zuvor grob geschätzten Umfang von mehreren Tausend Euro nicht einkalkuliert und aktuell wirtschaftlich nicht tragbar ist.

Das Projekt wird deshalb **nicht aufgegeben**. Stattdessen gilt:

### Phase A – vollständige interne B07-Vorbereitung im Chat

- Jeder Befund wird nacheinander bis zur externen Entscheidungsreife ausgearbeitet.
- Offene Geschäftsmodellentscheidungen werden zuerst geklärt.
- Rechtsquellen, tatsächlicher Code-/UI-Ablauf, Risiko, vorgeschlagene Lösung und konkrete Fragen werden gebündelt.
- Rechtstext- und Prozessentwürfe dürfen als ausdrücklich ungeprüfte Arbeitsentwürfe vorbereitet werden.
- Ziel ist ein kompaktes Paket, damit externe Berater nicht das Projekt von Grund auf rekonstruieren müssen.
- Phase A erteilt keine Rechtsfreigabe und ändert den B07-Status nicht.

### Phase B – begrenzte anwaltliche Kernprüfung

Erst nach Abschluss von Phase A wird ein Festpreisangebot für die aktuell releasekritischen Kernthemen eingeholt:

- Betreiber-/Vermittlerrolle;
- Plattform-/Verkäuferbedingungen;
- C2C/B2C/B2B-Zielmodell;
- Festpreis- und Verhandlungsvertragsschluss;
- B2C-Pflichtinformationen und Widerruf;
- DSA/P2B-Kernscope;
- für den konkreten Release zwingende GPSR-/Datenschutzpunkte.

Interner, unverbindlicher Zielkorridor für die Anfrage: ungefähr `1.000–2.500 EUR netto`. Das ist keine Preiszusage und keine Annahme, dass ein qualifizierter Prüfer diesen Umfang zu diesem Preis übernimmt. Beauftragt wird nichts ohne ausdrückliche Entscheidung des Betreibers.

### Phase C – Steuerprüfung unmittelbar vor entgeltlichem Betrieb

PStTG, UStG, Gebühren-/Rechnungsmodell und Plattformhaftung werden als gesondertes kompaktes Steuerpaket vorbereitet. Externe steuerliche Prüfung erfolgt erst, wenn das tatsächliche entgeltliche Modell feststeht und bevor entsprechende Livevorgänge aktiviert werden.

Interner, unverbindlicher Zielkorridor: ungefähr `300–800 EUR netto`. Keine Beauftragung ohne ausdrückliche Entscheidung.

### Phase D – Zahlungsdiensteprüfung unmittelbar vor Stripe Live

ZAG-/Stripe-Connect-, Gebühren-, Refund-, Chargeback- und Auszahlungseinordnung wird erst anhand des finalen End-to-End-Geldflusses extern geprüft. Bis dahin bleibt `manual_beta`; Stripe Live, echte Payments, Refunds und Payouts bleiben verboten.

### Laufende Rechtstexte

Ein späterer Standard-Rechtstext-/Updateanbieter kann als Ergänzung geprüft werden. Ein AGB-Generator oder monatliches Schutzpaket ersetzt jedoch nicht automatisch die individuelle Prüfung des DUELVANTA-Multi-Seller-Modells.

## 8. Wichtige Abgrenzung für die Weiterarbeit im Chat

- Die KI kann recherchieren, prüfen, strukturieren, Entwürfe erstellen, Widersprüche finden und technische Gegenmaßnahmen vorbereiten.
- Der Betreiber kann Geschäftsmodellentscheidungen treffen und technische Arbeiten autorisieren.
- Weder KI-Ausgabe noch Betreiberentscheidung ist die in B07 verlangte qualifizierte externe Rechts- oder Steuerfreigabe.
- Extern erledigt ist ein Punkt erst, wenn eine dafür qualifizierte Person die konkrete DUELVANTA-Fassung schriftlich geprüft/freigegeben hat und zwingende Korrekturen nachweisbar umgesetzt sind.
- Eine allgemeine gesetzliche Pflicht zu einem „Anwaltszertifikat“ wird nicht behauptet. Die externe Schlussfreigabe ist das verbindliche DUELVANTA-Release-Gate zur Risikokontrolle.

Wenn externe Beratung vorerst nicht finanzierbar ist, darf DUELVANTA als nichtkommerzieller Entwicklungs-/geschlossener Betastand ohne echte Käufe, Gebühren, Zahlungen, Refunds oder Payouts vorbereitet bleiben. Das erlaubt nicht, B07 geschlossen zu nennen oder die bestehenden Verbote zu umgehen.

## 9. Nächster Arbeitsauftrag im Chat

Die nächste Sitzung arbeitet ausschließlich innerhalb von B07 und beginnt mit **L07-01**.

Reihenfolge:

1. Betreiber-/Vermittlerrolle und konkreten Leistungsumfang von DUELVANTA festlegen.
2. Vertragsbeziehungen Plattform–Verkäufer, Plattform–Käufer und Verkäufer–Käufer exakt abbilden.
3. Privatverkäufer, gewerbliche Verkäufer und Käuferstatus festlegen.
4. Daraus Anforderungen an Plattform-/Verkäuferbedingungen ableiten.
5. Einen klar als ungeprüft gekennzeichneten Entscheidungs- und Fragenkatalog für die spätere externe Freigabe erstellen.
6. B07-Dokumentation nur aktualisieren, wenn ein neuer belastbarer Befund, eine Betreiberentscheidung oder externe Evidenz entsteht.

Nach L07-01 werden die Befunde in Abhängigkeitsreihenfolge weiterbearbeitet; nicht mechanisch nur nach Nummer, wenn eine vorgelagerte Modellentscheidung mehrere Folgepunkte bestimmt.

## 10. Unveränderte Stop-Regeln

- kein Merge;
- `main` nicht verändern;
- keine Produktionsmigration;
- Produktions-Supabase `enifiaqsnqtbzylnfrpi` nicht verändern;
- Preview-Supabase und Produktion strikt trennen;
- kein Stripe Live;
- keine echten Payments;
- keine Refunds oder Payouts aktivieren;
- keine Domain-Promotion;
- PR #5 Draft lassen;
- `database/auth-privileged-step-up-v1.sql` bleibt REVIEW ONLY;
- `v-logo.svg` niemals verändern;
- Slogan bleibt exakt `COLLECT. TRADE. BATTLE.`;
- keine unnötigen CI-, Deployment-, Browser- oder Login-Wiederholungen;
- B08–B12 nicht beginnen.

## 11. B07-Abschlussregel

B07 darf ausschließlich geschlossen werden, wenn:

1. die qualifizierte externe rechtliche Schlussfreigabe für den tatsächlich vorgesehenen Releaseumfang dokumentiert ist;
2. die qualifizierte steuerliche Freigabe für die tatsächlich aktivierten steuerrelevanten Abläufe dokumentiert ist;
3. alle daraus folgenden zwingenden B07-Korrekturen umgesetzt und nachgewiesen sind;
4. die Freigaben konkrete Dokument-/Versions-/Commitstände referenzieren.

Solange das nicht erfüllt ist:

**B07 = OFFEN / BLOCKIERT**  
**B08–B12 = NICHT BEGINNEN**

V13 ist deshalb ein Handout zur fortgesetzten B07-Bearbeitung und ausdrücklich **kein Handout „B07 abgeschlossen“**.

## 12. Compact Development Mode

- kurze, konkrete Fortschrittsmeldungen;
- keine Wiederholung bewiesener B01–B06-Prüfungen;
- keine unveränderten Testschleifen;
- keine unnötigen Deployments;
- Primärquellen bevorzugen;
- offene Rechtsfrage niemals als sichere Freigabe darstellen;
- Kosten vermeiden, indem externe Prüfer erst ein vollständig vorbereitetes, eng abgegrenztes Paket erhalten.

