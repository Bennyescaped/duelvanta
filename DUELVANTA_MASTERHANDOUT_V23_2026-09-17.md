# DUELVANTA – Masterhandout V23

Stand: 17.09.2026. Verbindlicher Übergabestand nach kontrollierter Tausch-Stilllegung.
V23 übernimmt V22 und ersetzt dessen noch offenen technischen Stilllegungsauftrag durch die nachstehenden Ergebnisse. Keine Rechts-, Steuer-, Payment- oder kommerzielle Produktionsfreigabe.

## 1. Produktentscheidung und Ergebnis

**DUELVANTA TRADE = Kaufen + Verkaufen. Tausch entfällt dauerhaft aus dem Release-Scope.**

Auf `marketplace-ux-v1` und in Staging sind Tausch-Einstiegspunkte entfernt und neue Tauschvorgänge serverseitig gesperrt. Historische Daten, Tabellen, alte Migrationen und die separaten Tauschmodule bleiben erhalten.

Bestehende `sale_or_trade`-Inserate behalten ihren Kaufweg. Ihre gespeicherte Historie wird nicht pauschal umgeschrieben; die Oberfläche zeigt Verkauf, und eine ausdrückliche Bearbeitung speichert künftig `sale`. Reine `trade`-Inserate erscheinen nicht mehr im aktiven Marktplatz oder in öffentlichen Angebotsvorschauen. Es wurden keine historischen Inserate gelöscht oder automatisch in Verkäufe umgewandelt.

## 2. Repository und Grenzen

- Repository: `Bennyescaped/duelvanta`
- Ausschließlicher Arbeitsbranch: `marketplace-ux-v1`
- Technischer, vollständig grün geprüfter Commit: `11f693c6320b3fe74d99073e443b1776eb37d08b`
- Vorheriger V22-Stand: `c249eed97a900e50e88e1a5908668d32445ac688`
- PR #5: offen, Draft, nicht gemergt.
- Produktions-main unverändert: `50f88213571be13255bb52eb489cc28cca660001`

Produktion und Production-Supabase wurden nicht verändert. Stripe Live blieb unberührt; keine echten Payments, Refunds oder Payouts. COLLECT, BATTLE, Scanner, Logo, Slogan und globale Navigation wurden nicht geändert.

TRADE-Release-Lock **COMING SOON 2027** einschließlich Owner-Bypass und testbarem Preview bleibt erhalten. Der Sperrtext nennt künftig ausschließlich Kaufen und Verkaufen.

## 3. Erfasste Einstiegspunkte und isolierte Änderungen

| Einstieg / Abhängigkeit | Änderung und Wirkung |
|---|---|
| `trade.html`, `trade-sealed.js`, `trade-shipping-options.js`, `trade.js` | Tauschoptionen entfernt; Single/Graded und Sealed speichern Verkauf. Reine Tausch-Inserate werden ausgeblendet; Tausch-CTAs entfernt. Kauf, Verhandlung, Preis und Versand bleiben verfügbar. |
| `trade-release-gate.js` / Manifest | `trade-c2c-swap.js` und `trade-listing-type-rules.js` werden nicht mehr geladen. Dadurch werden auch der dynamische Tausch-Problemlauf und Tausch-Pickup nicht initialisiert. Dateien bleiben konserviert. |
| `trade-marketplace-ux.js` | Kein Tausch-Tab, keine Tausch-Ansicht und keine erneute Tausch-Dekoration beim Navigationsaufbau. |
| `trade-automation.js` | Keine Swap-Abfragen oder Swap-Aktionskarten; historische Swap-Benachrichtigungen führen nicht in Tauschabläufe. Kauf-/Order-Routing bleibt erhalten. |
| `trade-pickup-messages.js` | Nur Order-Abholchats werden angezeigt/geöffnet; direkter UI-Aufruf mit Swap-Kontext wird verworfen. |
| `trade-b07-reviews.js`, `trade-search-archive.js` | Swap-Bewertungen, Swap-Archiv und Swap-Problemarchiv aus der aktiven Produktoberfläche entfernt. Datenrechte und historische Speicherung bleiben erhalten. |
| `offers-fix.js`, Basis-Angebotsansicht | Alte Nicht-Preisangebote werden in diesen Ansichten ausgefiltert. |
| `trade-b07-share.js`, `api/compliance-message-dispatch.js` | Keine Tausch-Preisbezeichnung; öffentliche Vorschau eines reinen Tausch-Inserats liefert 404. Order-/Compliance-Versand unverändert. |

## 4. Serverseitige Sperren – nur Staging ausgerollt

Bestätigtes Staging-Projekt: `xhmjxrcskfhbovhitdej` (DUELVANTA-STAGING).

Angewendet, im Repository nachvollziehbar:

1. `database/b07-sale-only-release-v1.sql`
   - Entzieht `PUBLIC`, `anon` und `authenticated` die Ausführung der vorhandenen Swap-Mutations-RPCs, einschließlich Proposal/Revision V1 und V2, Bindung, Pickup, Versand und Problemabläufen.
   - Zusätzliche Insert-Trigger auf Swap-Threads, Revisionen und Bestätigungen verhindern neue Vorgänge auch hinter privilegierten RPCs/privaten Hilfsfunktionen.
   - Neue Inserate dürfen nur `sale` sein. Wechsel zurück auf Tausch und Reaktivierung reiner Tausch-Inserate werden gesperrt.
   - Neue Tausch-Angebote sowie neue Legacy-Deals aus Tausch-Inseraten oder Nicht-Preisangeboten werden gesperrt.
   - Historische Datenpflege/Erasure-Updates außerhalb der fachlichen Angebotsfelder bleiben möglich; keine pauschale Schreibsperre auf alle historischen Tabellen.
2. `database/b07-sale-only-notifications-v1.sql`
   - Synchronisation erzeugt weiterhin Order-Abholchat-Benachrichtigungen, aber keine Swap-Benachrichtigungen.
   - Historische Swap-Benachrichtigungen werden bereits vor dem Seitenlimit herausgefiltert, damit sie keine Kaufnachrichten verdrängen.
3. `database/b07-sale-only-public-listings-v1.sql`
   - Öffentliche Angebots-RPC liefert ausschließlich verkaufsfähige Inserate.

Es gibt keinen neuen Nutzer- oder Owner-Schalter zur Reaktivierung von Tausch. Die separat konservierten historischen SQL-Dateien dürfen nicht erneut über die Stilllegung hinweg ausgerollt werden.

**Wichtig für einen späteren Release:** Diese Datenbanksperren wurden nicht in Production eingespielt. Vor einer später autorisierten Produktionsübernahme müssen die additiven Sperren dort koordiniert mit dem Code ausgerollt werden. Dieses Handout autorisiert das nicht.

## 5. Nachweise

### Vollständige CI

`Scanner V16 Check #507 / Run 35257146338` für Commit `11f693c6320b3fe74d99073e443b1776eb37d08b`:

- `validate`: SUCCESS
- `quota_database`: SUCCESS

Der vorausgehende Implementierungslauf #506 war ebenfalls vollständig grün.

Neue/angepasste Regressionen:
- `tests/trade-sale-only-database.sql`: echte isolierte PostgreSQL-Prüfung; neue Tausch-Inserate/-Vorschläge/-Revisionen/-Bindungen und Legacy-Tausch-Deals gesperrt, Verkauf/Preisangebot erlaubt, RPC-Rechte entzogen, Historie erhalten, wiederholtes Anwenden sicher.
- Zusätzlich echte SQL-Prüfung der Order-Abholchat-Benachrichtigung, der idempotenten Synchronisation und der Swap-Filterung vor Pagination.
- `tests/trade-sale-only-test.mjs`: Laufzeitprüfung mit gemischten historischen Antworten; keine Swap-Aktionen, -Benachrichtigungen oder -Chats, Order-Chat weiterhin erreichbar.
- Native Browserregression auf Mobilgerät und Desktop: grün. Einschließlich Verkaufstypen, fehlender Tausch-CTAs, ausgeblendeter alter Tausch-Inserate, Staffelpreisen, Checkout, Bestellnachweisen, Versand, Erhalt und Benachrichtigungen.
- Bestehende Kauf-/Verkauf-, Datenrechte-, PStTG/DAC7-, Payment-Sandbox-, COLLECT-/Scanner- und sonstige CI-Prüfungen sind grün. Historische Swap-Regressionen laufen weiterhin isoliert vor der neuen Stilllegungsprüfung.

### Staging-Datenbank

Direkte zurückgerollte Negativprüfungen bestätigten die Sperre von Thread-, Revisions- und Bestätigungs-Inserts. Kein Swap-Mutations-RPC ist mehr für `anon` oder `authenticated` ausführbar.

Vorher/nachher unverändert: 5 Swap-Threads, 6 Revisionen, 9 Bestätigungen, 10 Inserate, 4 Orders, 4 Abholnachrichten. Keine Testvorgänge dauerhaft neu angelegt. Sicherheits-Advisor geprüft; keine Findings zu den neuen Sperrfunktionen. Bestehende projektweite Advisor-Hinweise wurden nicht als behoben ausgegeben.

### Vercel-Preview

- Deployment: `dpl_5w43zqi1tcAMU5Kmc7K2zMWETJPP`
- Host: `duelvantav5vision-kt8jpn78t-bennyescaped-3783.vercel.app`
- Commit: `11f693c6320b3fe74d99073e443b1776eb37d08b`
- Zustand: READY, Preview, kein Production-Target.
- Alle zwölf geänderten Frontend-Dateien dieses Deployments wurden authentifiziert abgerufen: jeweils HTTP 200 und bytegleich zum geprüften Repository-Stand.
- Runtime-Konfiguration des vorausgehenden identischen Frontend-Deployments bestätigte Staging und enthielt keine Production-Projektzuordnung; zwischen beiden Commits änderten sich ausschließlich SQL/SQL-Tests.

**Abnahmegrenze:** Der Cloud-Browser erreichte die echte Preview-Anmeldeseite; eine neue angemeldete Zwei-Rollen-Abnahme wurde mangels Staging-Anmeldung nicht durchgeführt. Die Mobil-/Desktop-Flows wurden mit isolierten Fixtures getestet, ergänzt durch echten Staging-SQL-Nachweis und den exakten Preview-Dateiabgleich. Dies ist kein behaupteter neuer Live-Kauf- oder Zwei-Rollen-Test.

## 6. Weiterarbeit

Tausch-Stilllegung nicht erneut implementieren oder historische Swap-Infrastruktur vorsorglich löschen. An der Kauf-/Verkaufs-Beta weiterarbeiten; für eine zusätzliche angemeldete Preview-Abnahme zuerst regulär mit einem Staging-Testkonto anmelden.

Kategorie A/B bleiben geschlossen. Kategorie C bleibt extern offen entsprechend V22/V21; keine rechtliche oder steuerliche Freigabe aus dieser technischen Änderung ableiten. Kategorie D bleibt hinsichtlich der bisherigen Abnahme erhalten; Tausch ist dauerhaft aus dem zukünftigen Produktumfang entfernt.

Weiterhin: nur `marketplace-ux-v1`, kein Merge von PR #5, kein main-/Production-Ändern, keine echten Finanztransaktionen, TRADE-Lock erhalten.
