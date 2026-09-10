# Ximilar vs. Gemini: abgeschlossener 16-Foto-Vergleich

**Empfehlung: Ximilar als nächsten KI-Erkennungsweg in den bestehenden V16 integrieren.** In diesem begrenzten Test liefert es die gleiche Nummern-/Sprachquote wie Gemini Flash-Lite, deutlich kürzere Antwortzeiten und nützlichere Set-/Druckkandidaten. Das ist keine allgemeine 100-%-Erkennungsgarantie und kein Vergleich mit allen Gemini-Modellen oder SleeveNode.

## Methode und vollständiger Nachweis

Am 10.09.2026 wurden dieselben 16 unveränderten privaten Originalfotos verwendet: acht Karten, je zwei Winkel, ohne Hüllen oder Slabs. Je Anbieter ein Versuch pro Foto, keine Wiederholung und kein Best-of. Nur der ausgewählte TCG-Typ wurde mitgegeben, keine Sollnummern, Namen, Sprachen oder Varianten. Die Fotos waren bereits Teil der V16-Untersuchung; sie sind kein neuer, unangetasteter Holdout.

Ximilar Business 100K authentifizierte nach dem Tokenwechsel erfolgreich. Getesteter Code: `06ca141d38d50314e6c4cbe2871c4f5f040254a3`, Endpoint `collectibles/v2/tcg_id`, Datensatz `duelvanta-16-photos-20260910-v1-business100k-new-token`. Alle 16 Antworten sind vollständig gesichert; alle sind echte Antworten, keine Cachetreffer. Die zwei früheren HTTP-401-Zugangsprüfungen werden separat aufbewahrt und nicht in die Erkennungsquote eingerechnet.

Nach einer automatischen Browser-Freigabesperre erlaubte der Eigentümer ausdrücklich das erneute Öffnen. Sämtliche Ergebnisse waren gespeichert, einschließlich Nico Robin aus beiden Winkeln. Das Auslesen löste keine weiteren Provideranfragen aus. Der Browser bestätigt jetzt „Ximilar-Schlüssel vorhanden · Fototest geschlossen“.

## Gemessene Ergebnisse

| Messgröße | Ximilar TCG Identification | Gemini 3.5 Flash-Lite |
|---|---:|---:|
| Erfolgreiche Antworten | 16/16 | 16/16 |
| Gedruckte Nummer richtig | 16/16 | 16/16 |
| Sprache richtig | 16/16 | 16/16 |
| Providerzeit, Median | **2,753 s** | 13,704 s |
| Providerzeit, Minimum–Maximum | 2,357–3,141 s | 2,119–44,968 s |
| Vollständige Drucke automatisch unabhängig bestätigt | nicht nachgewiesen | nicht nachgewiesen |

Die Zeitmessung umfasst den serverseitigen Provideraufruf, nicht den Foto-Upload, die Kamera oder den absichtlichen Abstand von 15 Sekunden zwischen Testfotos. Ximilars Median beträgt etwa ein Fünftel des Gemini-Medians in diesem Lauf. Es wurden keine parallelen Lasttests durchgeführt.

| Karte | Nummer / Sprache, beide Winkel | Ximilar-Katalogevidenz |
|---|---|---|
| Retourorden | 074/084 · DE | Backtrack Badge, PBL, Uncommon |
| Rameidon ex | 045/084 · DE | Rampardos ex, PBL, Double Rare |
| Moruda | 091/084 · DE | Dhelmise, PBL, Illustration Rare |
| Memmeon | 021/063 · JP | Sobble / メッソン, M1S; Nenner aus übereinstimmender Provider-OCR |
| Ganzui | OP17-043 · EN | The World's Strongest Warriors, UC |
| Event | OP17-019 · EN | The World's Strongest Warriors, R, Event |
| Sabo | OP04-083 · EN | `OP04-083_R2`, The Best vol.2, SR |
| Nico Robin | ST29-009 · EN | **`ST29-009_P1` in beiden Antworten**, Egghead, C |

Die englischen Pokémon-Namen stammen aus Ximilars Katalog und widersprechen nicht der separat gelesenen Sprache DE/JP. Eine spätere Result-Brücke muss die lokalen Namen und Sprache erhalten.

## Varianten: Vorteil mit klaren Grenzen

Beim Event liefert Ximilar konsistent das richtige Set. Gemini nannte das falsche Set „The Four Emperors“ und wechselte zwischen Parallel und Manga. Bei Nico Robin liefert Ximilar in beiden Winkeln einen spezifischen `_P1`-Druckkandidaten; Gemini ließ die Variante beide Male offen. Der Nico-Robin-Fotovergleich mit der separat gespeicherten Full-Art-Referenz unterstützt diesen Kandidaten. Sabo wird konsistent der Best-vol.2-Ausgabe zugeordnet; das Foto passt visuell zur unabhängig gespeicherten PRB02-Referenz.

Diese Beobachtungen sind **keine vollständig verifizierte Variantenquote**. Ximilar `_R2` und OPTCG `_r3` bezeichnen bei Sabo unterschiedliche Katalog-Namensräume; Suffixe dürfen nicht blind gleichgesetzt werden. Marketplace-Links, genaue Druckzuordnung und Finish sind noch nicht durchgängig unabhängig validiert. Ximilar gibt Finish-Klassen wie „Foil/Holo“ oder „Other Rare/Promo“ aus; damit ist eine genaue Holo-/Reverse-/Textur-Unterscheidung nicht belegt. Seltenheit ist ebenfalls nicht dasselbe wie Druckvariante.

Das vorhandene Scorer-Feld `variantEvidencePresent` zählt nur explizite textliche Variantenfelder und ist hier 0; es erfasst die erhaltenen `_P1`-/`_R2`-Katalogkennungen nicht. Diese Kennungen sind separat in `providerPrintingId` gespeichert und oben ausgewertet. `exactPrintingVerified:0` bedeutet, dass dieser Nachweis nicht erbracht wurde, nicht dass alle Druckkandidaten falsch sind. Provider-Distanzen werden nicht als kalibrierte Trefferprozente ausgegeben. Sämtliche Pilotresultate bleiben `catalogVerified:false` und `importable:false`.

## Datenflusskorrektur ohne neue KI-Anfragen

Die erste Ximilar-Brücke zeigte bei One Piece nur `card_number` (z. B. `043`) und bei Memmeon nur `21`. Die vollständigen Daten waren in derselben Antwort vorhanden: One Piece in `card_id` beziehungsweise `set_code`, Memmeons `021/063` in der Provider-OCR. Die reparierte Brücke liest diese Felder und erhält die originale Druckkennung separat. Ein fehlender Pokémon-Nenner wird nur aus genau einem passenden OCR-Code ergänzt; widersprüchliche Nummern bleiben ein Konflikt.

Der Offline-Scorer hat die unveränderten Rohantworten mit dieser generischen Brücke neu ausgewertet, ohne Sollwerte an den Parser zu geben. Deshalb beweist der Erstlauf allein noch keine vollständige Anzeige aller Nummern in der ursprünglichen Pilot-UI. Die Antwortabbildung ist zusätzlich mit Regressionstests abgesichert. Ein normaler Scanner-Import mit Ximilar ist noch nicht freigeschaltet.

## Verbrauch und Kosten

Ximilars veröffentlichter Tarif nennt 10 Credits pro TCG-Identifikation. Für diese 16 Einzelkarten sind **160 Credits der nominale Ansatz**. Bei vollständiger Nutzung von 100.000 Credits für 59 € entspricht das **0,0059 € pro Scan (0,59 Cent)** beziehungsweise **0,0944 € für 16 Scans**. Das ist eine anteilige Abo-Rechnung; der Monatsbeitrag bleibt 59 €. Die Antworten enthalten keine numerische Credit-Abrechnung, der tatsächliche Kontostand wurde nicht geprüft. Preisabfrage, Slab-Erkennung, Grading und Mehrfacherkennung waren ausgeschaltet. [Ximilar-Preise](https://www.ximilar.com/pricing/)

Gemini lieferte insgesamt 20.224 Eingabe- und 1.670 Ausgabetokens. Mit 0,30 US-Dollar / Million Eingabe- und 2,50 US-Dollar / Million Ausgabetokens ergibt das **0,0102422 US-Dollar für alle 16 Fotos**, rund **0,064 US-Cent pro Scan**. Das ist eine Listenpreisrechnung; Free Tier und tatsächliche Abrechnung wurden nicht geprüft. Es wird keine Währungsumrechnung oder exakte Kostenrelation zwischen Euro und Dollar behauptet. Hosting und Steuern sind nicht enthalten. [Google-Preise](https://ai.google.dev/gemini-api/docs/pricing)

## Nächster begrenzter Entwicklungsschritt

1. Den vorhandenen Ximilar-Adapter mit dem V16-Result verbinden: Nummer, Sprache, Set, Original-Druckkennung und Alternativen erhalten; offene Druck-/Finishfragen sichtbar lassen. Die gesicherten Antworten dienen zunächst als Offline-Regressionen.
2. Vor freien Fotoanfragen den privaten Testzugang durch einen serverseitig authentifizierten, dauerhaft begrenzten Verbrauchspfad mit Idempotenz ersetzen. Der aktuelle Signatur-/Foto-Hash-Pilot ist kein öffentliches Monatskontingent.
3. Den mobilen Abschluss auf zwei klare Aktionen reduzieren: **Nächste Karte** und **Karte ansehen**. Erst bestätigte Katalogtreffer über den bestehenden Importweg übernehmen.
4. Danach ein kurzer gebündelter iPhone-Test. Hüllen, starke Reflexion, unbekannte Karten und Slabs werden erst in einer gesonderten Freigaberunde geprüft; sie sind in diesem Ergebnis nicht abgedeckt.

V16 bleibt die Grundlage. Beide Anbieterpiloten und der normale Vision-Fallback sind geschlossen. Es gab keine Collection-Schreibzugriffe, Auth-/RLS-Änderungen, Veröffentlichung privater Fotos, Schlüssel in Git oder Änderungen an main/V15.8. PR #1 bleibt Draft. Der getestete Lauf (CI 110) und die geschlossene Implementierung (CI 112 einschließlich Mobile-E2E) hatten grünes GitHub CI und Vercel; dieser Abschluss ergänzt nur Dokumentation.
