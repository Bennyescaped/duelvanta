# DUELVANTA – MASTERHANDOUT V33

Stand: **22.09.2026** · Verbindlicher Entwicklungsbranch: `marketplace-ux-v1`

**Schritte 1, 3 und 4 sind im jeweils dokumentierten Umfang technisch abgeschlossen. Schritt 2 ist technisch abgeschlossen; sein angemeldeter Preview-Nachtest ist im vorhandenen Datenzustand TEIL-PASS / REST BLOCKIERT, ohne beobachteten FAIL. Die Legal-Migration bleibt unangewandt, der Legal-Guard bleibt geschlossen, Stripe bleibt deaktiviert. Als Nächstes ausschließlich Schritt 5 – Widerruf fertigstellen. Keine Rechts-, Gesamt-, Migrations- oder Produktionsfreigabe.**

## 1. Verbindlichkeit und Arbeitsgrenzen

V33 ersetzt V32 als konsolidierten Fortsetzungsstand. Bei widersprüchlichen Statusangaben gilt V33 vor V32 und vor älteren Zwischenberichten. Die Detailberichte der einzelnen Schritte bleiben für ihren ausdrücklich geprüften Umfang maßgeblich.

Repository: `Bennyescaped/duelvanta`.

DUELVANTA bleibt **COLLECT. TRADE. BATTLE.** TRADE bleibt Kauf/Verkauf; Tausch/Swap wird nicht wieder eingeführt.

Vor weiterer Arbeit:

1. V33 vollständig lesen.
2. Tatsächlichen Remote-Head von `marketplace-ux-v1` prüfen.
3. Vorhandene Arbeitskopien und unversionierte Dateien zuerst inventarisieren/sichern.
4. Abweichungen einordnen; kein Reset, Force-Push oder Branchwechsel.
5. Ausschließlich auf `marketplace-ux-v1` veröffentlichen.
6. PR #5 bleibt Draft und unmerged.

Unverändert verboten bzw. außerhalb des aktuellen Blocks:

- `main` verändern oder mergen,
- Production oder Production-Supabase verändern,
- Legal-Migration auf Staging anwenden,
- Schema-Freigabemarker setzen,
- Stripe Sandbox oder Live aktivieren,
- echte Payments, Refunds, Payouts oder E-Mails,
- manueller Vercel-Deploy,
- Secrets, Tokens, OTPs oder Sitzungscookies anfordern/committen,
- Schutzmechanismen zum Testen abschalten,
- alte Codex-/`work`-Arbeitskopien ungeprüft über den Branch pushen,
- den alten Transport-Patch erneut anwenden,
- abgeschlossene COLLECT-/BATTLE-Abnahmen ohne neuen reproduzierbaren Befund wieder aufrollen.

## 2. Verifizierte Git-/PR-/Deployment-Basis vor V33

| Kennung | Bedeutung |
|---|---|
| `0b1154515357aa94cb9769dfd8ba57636d8cd8ee` | Tatsächlicher Remote-Head vor Erstellung von V33; Dokumentation Schritt 4 |
| `826eb4ad866974bcf682796bcdfd51746e3218fc` | CI-geprüfter technischer Schritt-4-Endstand |
| `be6bd495c897a782d459ba571449e5bb33fef62d` | Dokumentationsstand nach Schritt 3 |
| `2cab1572eec0e8a83e423c8633dcb57fc14ffa2b` | CI-geprüfter technischer Schritt-3-Endstand |
| `6ed31d7c9b9c9076968d5220bee236a21ca9cc3e` | CI-geprüfter technischer Schritt-2-Endstand |
| `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` | Technischer Schritt-1-Endstand |
| `50f88213571be13255bb52eb489cc28cca660001` | Erneut verifizierter unveränderter `main`-Head |
| PR #5 | Offen, Draft, unmerged; Basis `main` |
| Staging-Project-Ref | `xhmjxrcskfhbovhitdej` |
| Production-Project-Ref, nur Negativgrenze | `enifiaqsnqtbzylnfrpi` |

Der V33-Commit ergänzt ausschließlich Dokumentation. Der technische Stand darunter bleibt `826eb4ad…`; spätere Dokumentationscommits dürfen nicht als neue technische Abnahme ausgegeben werden.

### 2.1 Aktuelle technische Preview zu Schritt 4

| Merkmal | Stand |
|---|---|
| Vercel Deployment | `dpl_3FpFvwqJqKKBniJJyqKBXWrYp4c9` |
| Host | `duelvantav5vision-kvujrxk1e-bennyescaped-3783.vercel.app` |
| Zustand | READY |
| Quelle | git |
| Branch | `marketplace-ux-v1` |
| Quell-SHA | exakt `826eb4ad866974bcf682796bcdfd51746e3218fc` |
| Target | `null`, keine Production-Bereitstellung |

Das ist ein Build-/Auslieferungsnachweis. Die neue Vertragslogik ist auf Staging weiterhin nicht aktiviert, weil die Legal-Migration bewusst unangewandt bleibt.

## 3. Gesamtstatus Legal-Schritte

| Schritt | Stand | Fortsetzungsgrenze |
|---|---|---|
| 1 – Kompatibilitätsschutz | **VERÖFFENTLICHT + CI PASS + angemeldeter Read-only-Preview-Nachtest PASS** | Abgeschlossen im definierten Umfang |
| 2 – bestehenden Privatkäuferzugang wiederverwenden | **TECHNISCH + CI PASS; Preview TEIL-PASS / REST BLOCKIERT** | Kein beobachteter FAIL; praktische Annahmebutton-Prüfung mangels aktivem Angebot nicht möglich |
| 3 – Preisangebotsmodell | **VERÖFFENTLICHT + vollständige CI PASS** | Technisch abgeschlossen; Migration weiter unangewandt |
| 4 – Festpreisablauf absichern | **VERÖFFENTLICHT + vollständige CI PASS + echte PostgreSQL-Parallelität PASS** | Technisch abgeschlossen; Migration weiter unangewandt |
| 5 – Widerruf fertigstellen | **NICHT BEGONNEN** | Jetzt einziger Entwicklungsauftrag |
| 6 – Gesamtmigration kontrolliert auf Staging übernehmen | **NICHT BEGONNEN / GESPERRT** | Erst nach Abnahme der vorherigen Blöcke und separatem Übernahmeentscheid |

## 4. Schritt 1 – Guard und bestehende Lesepfade

Der Schritt-1-Guard bleibt Version `1.1` und standardmäßig geschlossen. Er prüft weiterhin lesend eine versionierte Legal-Schema-Kompatibilität. Fehlende Funktionen, Teilantworten, Fehler oder Timeout schalten nicht frei.

Der angemeldete Schritt-1-Preview-Nachtest ist vollständig PASS:

- feste Preview erreichbar,
- autorisierte DUELVANTA-Staging-Sitzung,
- real beobachteter Supabase-Request gegen `xhmjxrcskfhbovhitdej.supabase.co`,
- fehlendes Legal-Schema bleibt fail-closed,
- bestehende Testbestellung lesbar,
- bestehender Bestellnachweis lesbar,
- Profil lädt,
- unfreigegebene neue Käuferstatusfunktion blieb gesperrt.

Referenz: `DUELVANTA_LEGAL_SCHRITT1_PREVIEW_NACHTEST_2026-09-22.md`.

Wichtig: Der Schritt-2-Kandidat entfernte die zusätzliche Käuferprofiltabelle und ihren Getter wieder. Der Guard darf deshalb nicht allein durch Anwendung der jetzigen Migration als automatisch kompatibel betrachtet werden. Eine später kontrollierte Schema-Readiness-Lösung bleibt vor Schritt 6 gesondert zu prüfen. Keinen Marker nur zum Öffnen des Guards erfinden.

## 5. Schritt 2 – bestehender Privatkäuferzugang

Der zusätzliche Geschäftskäuferpfad des früheren Entwurfs wurde entfernt. Der unangewandte Kandidat verwendet wieder die bereits vorhandene private Käuferberechtigung einschließlich:

- Volljährigkeit,
- Deutschland,
- bestehender ausdrücklicher Privatkäuferbestätigung,
- Account-/Sicherheits-/Schließungs-/Verarbeitungssperren.

Unterstützte neue Vertragsklassen bleiben im aktuellen Release-Scope:

- privater Verkäufer + privater Verbraucher → C2C,
- gewerblicher Verkäufer + privater Verbraucher → B2C.

B2B/C2B wurden aus diesem Kandidaten entfernt. Historische Vertragssnapshots werden nicht rückwirkend umklassifiziert.

Profilseitig wurde die doppelte Auswahl „privat / geschäftlich kaufen“ entfernt.

### 5.1 Angemeldeter Schritt-2-Preview-Nachtest

Nachgewiesen PASS:

- normales Profil ohne doppelte Käuferwahl,
- bestehende Bestellung lesbar,
- bestehender Bestellnachweis erreichbar,
- Staging in den erfassten Netzwerkzielen,
- Legal-Guard `schema-unavailable` / `available=false`,
- vorhandener `#sendOffer` tatsächlich deaktiviert.

BLOCKIERT mangels geeignetem vorhandenen Testzustand:

- praktischer Annahmebutton eines offenen eingegangenen Angebots,
- weitere im untersuchten DOM nicht vorhandene neue Vertragsaktionsbuttons.

Die Angebotsansicht zeigte „Keine aktiven Vorgänge“. Es wurde richtigerweise **kein neues Angebot nur für diesen Read-only-Nachweis erzeugt**. Diese Lücke ist kein reproduzierter Fehler. Spätere Schritt-3-/4-CI darf nicht rückwirkend als manueller Preview-Beleg für diesen fehlenden Einzelzustand umetikettiert werden.

Referenzen:

- `DUELVANTA_LEGAL_SCHRITT2_PRIVATKAEUFER_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT2_PREVIEW_NACHTEST_2026-09-22.md`

## 6. Schritt 3 – Preisangebotsmodell

Technischer Endstand: `2cab1572eec0e8a83e423c8633dcb57fc14ffa2b`.

Das neue Preisangebotsmodell friert vor dem verbindlichen Käuferangebot serverseitig insbesondere ein:

- Verkäufer/Seller-Rolle,
- Produkt,
- Menge,
- angebotenen Warenwert,
- Versandart und Versandkosten,
- Gesamtpreis,
- Währung,
- Käuferstatus / C2C-B2C-Klassifikation,
- Listing-Version,
- Hash des Angebotsreviews.

Browserpfad für neue Angebote: `create_market_offer_v3`.

Der ältere unreviewte Browserpfad `create_market_offer_v2` wird im Kandidaten für Browserrollen widerrufen.

Vertragsschluss bei Preisangeboten:

- Käufer sendet das verbindliche Angebot.
- Verkäuferannahme ist das einzige vertragsschließende Ereignis dieses Pfads.
- Die Annahme nutzt den eingefrorenen Käuferangebots-Snapshot.
- Kein zweiter vertragsschließender Checkout.
- Replay erzeugt keinen zweiten Deal / keine zweite Order.
- Ältere offene Angebote ohne vollständigen neuen Snapshot werden fail-closed nicht mit einem Annahmebutton freigegeben.

CI:

- Scanner #661: SUCCESS.
- Battle #137: SUCCESS.
- Isolierter Datenbanktest bestätigt stale-review-Sperre, eingefrorenen Gesamtpreis/Versand und genau einen Deal/Order bei Replay.

Referenz: `DUELVANTA_LEGAL_SCHRITT3_PREISANGEBOTE_2026-09-22.md`.

## 7. Schritt 4 – Festpreisablauf

Technischer Endstand: `826eb4ad866974bcf682796bcdfd51746e3218fc`.

Der Festpreispfad bindet den vorbereiteten Vorgang nun durchgehend an:

- vollständigen `contract_review_snapshot`,
- Checkout-Hash,
- ursprüngliche Listing-Version,
- Menge,
- Warenwert,
- Versand,
- Gesamtbetrag in Cent,
- Plattformgebühr in Cent,
- Stripe-Connected-Account-Snapshot,
- Test-/Live-Modus-Snapshot,
- Käuferstatus,
- Seller-/Product-/Fulfillment-Snapshot.

Eine wiederverwendete `request_key` muss zum ursprünglichen Listing, zur Menge, zum Review-Hash und zur ursprünglichen Listing-Version passen.

### 7.1 Unbekannte Stripe-/DB-Antworten

Bei unklarem Ergebnis werden Provider-Session und Reservierung nicht mehr vorschnell destruktiv aufgelöst.

Explizite Zustände:

- `fixed_checkout_outcome_unknown` → HTTP 503, retryable, Vertrag nicht sicher nachgewiesen,
- `fixed_checkout_payment_recovery_unknown` → Vertrag bereits nachgewiesen, Providerzustand nicht sicher lesbar,
- `contract_formed_payment_processing` → Vertrag besteht, Session abgeschlossen/verarbeitet,
- `contract_formed_payment_retry_required` → Vertrag besteht, ursprüngliche Session nicht mehr verwendbar.

Wiederholung verwendet dieselbe Request-ID und Stripe-Idempotenzbindung. Eine Transportunsicherheit darf keinen zweiten Festpreiskauf erzeugen.

### 7.2 Echte PostgreSQL-Parallelität

Scanner #667 führte einen neuen Test mit echten getrennten PostgreSQL-17-Verbindungen aus.

PASS:

- gleiche Request-ID parallel → ein Vorgang, zweiter Replay,
- zwei Käufer um letztes Stück → kein Overselling,
- zwei Service-Role-Annahmen → genau ein Deal, eine Order, ein Payment Attempt, eine Allocation,
- nach Prepare veränderte Listing-/Versand-/Gebührenwerte überschreiben den eingefrorenen Vertrag nicht,
- Request-Key mit anderem Review-Hash wird abgewiesen.

CI-Umgebung: PostgreSQL 17.11, `read committed`.

Artefakt: `trade-fixed-price-postgres-evidence`, ID `10710804474`.

### 7.3 Vollständige CI

Scanner V16 Check #667, Run `35764186692`: **SUCCESS**

- `validate` Job `106869434924`: SUCCESS
- `collect_f3_database` Job `106869434510`: SUCCESS
- `quota_database` Job `106869435043`: SUCCESS

Battle WebRTC Check #143, Run `35764186676`: **SUCCESS**

- `battle_webrtc` Job `106869435260`: SUCCESS
- `spectator_database` Job `106869434849`: SUCCESS

Im erfolgreichen Validate-Lauf bestanden weiterhin die Guard-, Profil-, Bestelllese-, Private-Buyer-, Step-3-, Stripe-, TRADE-UI-, Mobile-/Desktop- und Chromium-Regressionspakete. Die UI-Selbsttests endeten mit:

`ALL UI TESTS PASSED — mocks only, no live transaction.`

Referenz: `DUELVANTA_LEGAL_SCHRITT4_FESTPREIS_2026-09-22.md`.

## 8. Datenbank- und Staging-Stand strikt trennen

Datei:

`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`

ist weiterhin ein **unangewandter Kandidat**.

Nicht erfolgt:

- keine Migration auf Staging,
- kein Legal-Schema-Freigabemarker,
- keine Freischaltung neuer Vertragsaktionen,
- keine Stripe-Sandbox-Aktivierung,
- keine Stripe-Live-Aktivierung.

Der reale Staging-Browserstand hat im Schritt-1-Nachtest den fehlenden Legal-RPC mit 404 gezeigt; im Schritt-2-Nachtest blieb der Guard `schema-unavailable` und `available=false`.

Die erfolgreichen SQL-/PostgreSQL-Tests verwenden isolierte Testumgebungen und sind **kein Beweis, dass die neue Migration auf Staging aktiv ist**.

Keine technische Preview-Bereitschaft, Fixture oder CI als Staging-Schemafreigabe ausgeben.

## 9. Mitgeteilte Kanzlei-Zielvorgaben – technische Arbeitsgrundlage

Diese Punkte stammen aus den im Projekt dokumentierten Kanzlei-Antworten bzw. nachgereichten Antworten und werden als technische Zielvorgaben behandelt, nicht als eigenständige neue Rechtsfreigabe durch die Entwicklung.

| Thema | Verbindliche technische Arbeitsrichtung |
|---|---|
| Festpreis | Käufer gibt Kaufangebot ab; die unmittelbar erzeugte automatisierte Zahlungsaufforderung bildet die vorgesehene Verkäuferannahme. Kein zusätzlicher manueller Verkäuferklick. |
| Preisangebot | Käuferangebot ist verbindlich; Vertrag entsteht bei Verkäuferannahme. Zahlung folgt danach und ist kein zweiter Vertragsschluss. |
| Käuferstatus | Bestehenden privaten Käuferzugang wiederverwenden; keine unnötige zusätzliche Geschäfts-Käuferlogik. |
| Widerruf B2C-Warenvertrag | Erklärung muss dem jeweiligen Händler/Verkäufer des Warenvertrags zugeordnet werden. |
| Eigener Plattformvertrag | Falls für einen eigenen DUELVANTA-Plattformvertrag ein Widerrufspfad besteht, ist DUELVANTA der Empfänger dieses eigenen Vertrags – nicht der Warenhändler. Vertragsdomänen nicht vermischen. |
| Rückabwicklung | Widerrufserklärung, Storno und Refund fachlich/technisch getrennt behandeln. |
| Bestätigung | Erklärung, Eingang und erforderliche Bestätigung/Zustellung nachvollziehbar und dauerhaft dokumentieren. |
| Datenschutz | Supabase/Backend/Storage und LiveKit bleiben gesonderte Datenschutz-/Anbieterfragen; keine Textfreigabe aus Techniktests ableiten. |

Individuelle Rechts-/Datenschutztexte nicht frei erfinden und nicht allein aufgrund einer technischen Implementierung als anwaltlich freigegeben bezeichnen.

## 10. Schritt 5 – jetzt einziger Entwicklungsauftrag

**Ziel: Widerruf technisch fertigstellen, ohne Schritt 6 oder Rückabwicklung vorwegzunehmen.**

### 10.1 Vorhandener Kandidat – zuerst inventarisieren, nicht blind übernehmen

Der unangewandte Migrationskandidat enthält bereits:

- `market_contract_snapshots.withdrawal_eligible`,
- `dv_market_private.market_withdrawal_drafts`,
- `dv_market_private.market_withdrawals`,
- unveränderbare Widerrufsnachweise,
- `get_my_market_withdrawable_contracts()`,
- `prepare_market_withdrawal_v1(...)`,
- `confirm_market_withdrawal_v1(...)`,
- Outbox-Kinds `withdrawal_receipt` und `withdrawal_notice`,
- Käuferbestätigung an eine Bestätigungsadresse,
- Verkäuferbenachrichtigung an den im Vertragssnapshot gespeicherten Händlerkontakt,
- ausdrücklich **keine automatische Storno-/Refund-Ausführung**.

Der aktuelle Kandidat verwendet für diese Datensätze `contract_domain='marketplace_b2c'`. Vor einer Änderung genau prüfen, ob diese Domain-Grenze den tatsächlichen Warenvertrag korrekt und ausschließlich abbildet. Keine Plattformvertragslogik hineininterpretieren, wenn sie nicht tatsächlich implementiert ist.

Auch `trade-orders.js`, Guard/Loader und bestehende Bestell-/Browsertests auf die tatsächliche Widerrufs-UI und deren Fail-closed-Verhalten prüfen.

### 10.2 Pflichtprüfungen für Schritt 5

Der Schritt ist erst technisch abgeschlossen, wenn mindestens folgende Punkte mit Evidenz geprüft sind:

1. **Vertragsbezug**
   - Widerruf kann nur auf den konkreten unveränderbaren B2C-Vertragssnapshot bezogen werden.
   - C2C und nicht berechtigte Verträge bleiben gesperrt.
   - Vertragspartner/Produkt/Order/Zeitpunkt stammen aus dem eingefrorenen Vertragsstand.

2. **Empfänger / Vertragsdomäne**
   - Warenvertrag-B2C: Erklärung an den im Snapshot enthaltenen Händler/Verkäufer.
   - Eigene DUELVANTA-Verträge nicht mit dem Warenvertrag vermischen.
   - Keine automatische Annahme, dass jede Kontonutzung derselbe widerrufliche Vertrag ist.

3. **Erklärung**
   - Nutzer sieht eindeutig, welchen Vertrag er widerruft.
   - Bestätigungsaktion erzeugt genau eine unveränderbare Erklärung.
   - Replay/Mehrfachklick erzeugt keine zweite Erklärung.

4. **Eingangs-/Bestätigungsnachweis**
   - eingegangene Erklärung erhält stabilen Zeitpunkt und Hash,
   - Käufer erhält einen nachvollziehbaren Beleg,
   - Händler erhält die korrekte Mitteilung für den Warenvertrag,
   - Outbox/Dedupe-Grenzen verhindern Doppelzustellung auf technischer Ebene,
   - reale E-Mail-Zustellung bleibt deaktiviert, solange der Dispatcher nicht separat freigegeben wird.

5. **Datenrechte**
   - prüfen, ob Widerrufsdaten in eigenem Datenexport, Löschblockern/Retention und Verarbeitungssperren konsistent berücksichtigt werden,
   - nichts automatisch löschen, wofür der Kandidat einen rechtlichen/vertraglichen Aufbewahrungsgrund benötigt,
   - keine neue Aufbewahrungsfrist erfinden.

6. **Rückabwicklung strikt getrennt**
   - Widerruf darf nicht automatisch als Storno, Refund, Auszahlungskorrektur oder Warenrückgabe behandelt werden.
   - Bestehende Stripe-/Order-Zustände nicht stillschweigend verändern.
   - Falls spätere Rückabwicklung nötig ist, als separaten Folgeprozess dokumentieren.

7. **Berechtigungen / Datenschutz**
   - Browser darf private Widerrufstabellen nicht direkt lesen/schreiben.
   - RPCs müssen auf den angemeldeten Käufer und seinen Vertrag begrenzt bleiben.
   - Verkäufer darf keine fremden Käufer-Widerrufsdaten auslesen.
   - Service-/Dispatcher-Rechte separat halten.

8. **Tests**
   - SQL-/Rollenfixtures für berechtigt/unberechtigt, C2C/B2C, fremder Vertrag, Replay, abgelaufener Draft und unveränderbaren Nachweis,
   - Browser-/DOM-Prüfung der tatsächlichen UI,
   - bestehende Step-1–4-Regressionen vollständig grün,
   - keine Provider-/E-Mail-Aufrufe in Tests.

### 10.3 Schritt-5-Ausstiegskriterium

Nur wenn der begrenzte Widerrufsblock technisch vollständig geprüft ist:

**Schritt 5 = veröffentlicht + CI PASS.**

Danach noch **nicht automatisch** Migration anwenden. Schritt 6 bleibt ein eigener, ausdrücklich freizugebender Block.

## 11. Schritt 6 bleibt gesperrt

Die kontrollierte Gesamtmigration auf Staging darf erst nach Abschluss und Dokumentation von Schritt 5 begonnen werden.

Vor einer späteren Übernahme müssen unter anderem gesondert geprüft werden:

- exakte Migrationsquelle / Hash,
- vollständige Rollen- und Grant-Differenz,
- Readiness-/Guard-Lösung,
- Migration gegen ausschließlich Staging,
- synthetische Integrationsabnahme,
- keine Production-Verbindung,
- keine Stripe-Live-Aktivierung,
- klarer Rollback-/Abbruchpunkt.

Keine Anwendung der Migration als Nebenwirkung eines Schritt-5-Tests.

## 12. COLLECT, BATTLE und Scanner – nicht erneut öffnen

### COLLECT

F1–F3/Mobile bleiben im dokumentierten Umfang abgeschlossen. Schritt-4-CI-Wiederholungen sind nur Regressionsevidenz und keine neue Produktabnahme.

### BATTLE / Spectator Media

Der dokumentierte Mehrgeräteumfang bleibt abgeschlossen:

- Host/Gast P2P,
- separater read-only Zuschauer,
- Bild/Ton beider Spieler,
- Consent/Widerruf,
- RemoveParticipant/Disconnect,
- erneute Media-Epoche nach Zustimmung,
- konfigurierte Beta-Grenze `max_viewers_per_match=50`.

50 ist das konfigurierte Beta-Limit, **kein Lasttestnachweis**.

### Scanner

Das Scanner-Release-Gate bleibt separat. Erfolgreiche Scanner-V16-CI auf `marketplace-ux-v1` ist keine Scanner-Produktionsfreigabe und darf das bestehende Branch-/Release-Gate nicht nebenbei ändern.

## 13. Dauerhafte Schutz- und Prozessregeln

- GitHub-/Vercel-Verbindungen tatsächlich verwenden, wenn verfügbar; nicht aus früheren Toolproblemen auf heutige Unverfügbarkeit schließen.
- TinyFish ist für diesen Entwicklungsblock nicht erforderlich und soll keinen Fortschritt blockieren.
- Bei einem reproduzierbaren Fehler zuerst konkreten Befund isolieren.
- Nur fachlich betroffenen Code/Test korrigieren.
- Keine Testabschaltung, um CI grün zu bekommen.
- Build READY ersetzt keine Funktionsabnahme.
- Fixture-PASS ersetzt keinen angemeldeten Nachweis, wenn ausdrücklich ein realer Preview-Nachweis verlangt wird.
- Keine Gesamtfreigabe aus einem Einzeltest ableiten.
- Der spätere gesonderte Codex-/Gesamtreview vor Live bleibt weiterhin vorgesehen.

## 14. Verbindliche Referenzen

Zuerst V33, danach bei Bedarf die Detailberichte:

1. `DUELVANTA_MASTERHANDOUT_V33_2026-09-22.md`
2. `DUELVANTA_LEGAL_SCHRITT4_FESTPREIS_2026-09-22.md`
3. `DUELVANTA_LEGAL_SCHRITT3_PREISANGEBOTE_2026-09-22.md`
4. `DUELVANTA_LEGAL_SCHRITT2_PRIVATKAEUFER_2026-09-22.md`
5. `DUELVANTA_LEGAL_SCHRITT2_PREVIEW_NACHTEST_2026-09-22.md`
6. `DUELVANTA_LEGAL_SCHRITT1_PREVIEW_NACHTEST_2026-09-22.md`
7. `DUELVANTA_LEGAL_SCHRITT1_VEROEFFENTLICHUNG_CI_2026-09-22.md`
8. `DUELVANTA_MASTERHANDOUT_V32_2026-09-22.md` nur als historische Vorgängerversion bei Bedarf.

Bei Widerspruch zwischen V33 und älteren Statusformulierungen gilt V33.

## 15. Übergabe an den nächsten Chat

Der nächste Chat soll **nicht** Schritt 1–4 wiederholen und **nicht** sofort die Migration anwenden.

Erster Auftrag:

1. V33 und den Schritt-4-Bericht vollständig aus `marketplace-ux-v1` lesen.
2. Tatsächlichen Remote-Head prüfen und Abweichungen einordnen.
3. Vorhandene Arbeitskopien zuerst inventarisieren/sichern.
4. Dann ausschließlich **Schritt 5 – Widerruf fertigstellen** bearbeiten.
5. Zuerst den vorhandenen Widerrufspfad vollständig inventarisieren:
   - Migration,
   - `trade-orders.js`,
   - Legal-Guard/Loader,
   - Message-Outbox/Dispatcher,
   - Datenrechte/Export/Löschblocker,
   - vorhandene Tests.
6. Empfänger-/Vertragsdomäne, Erklärung, Eingangsnachweis, Bestätigung/Zustellung, Replay/Unveränderbarkeit und Datenrechte technisch konsistent ausrichten.
7. Storno/Refund strikt getrennt lassen.
8. Migration unangewandt und Stripe deaktiviert lassen.
9. CI vollständig ausführen und tatsächliche Ergebnisse dokumentieren.
10. Schritt 6 nicht beginnen.

**Kein manueller Preview- oder Transaktionstest mit neuen Daten ist zu Beginn von Schritt 5 erforderlich. Erst technische Inventur, begrenzter Patch und CI.**
