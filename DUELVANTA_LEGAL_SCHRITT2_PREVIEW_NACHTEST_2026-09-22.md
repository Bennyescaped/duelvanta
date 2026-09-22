# DUELVANTA – Legal Schritt 2: angemeldeter Preview-Nachtest

Prüfdatum: **22.09.2026**. Repository: `Bennyescaped/duelvanta`. Branch: `marketplace-ux-v1`.

**Status: manuell erhobene Profil-, Bestell-, Nachweis-, Staging- und Guard-Befunde PASS im unten abgegrenzten Umfang. Die praktische Prüfung des Annahmebuttons ist mangels geeigneter aktiver Angebote BLOCKIERT. Weitere nicht vorhandene Aktionsbuttons sind nicht praktisch nachgewiesen. Kein vollständiges Preview-PASS und kein beobachteter FAIL. Schritt 3 wurde nicht begonnen.**

Dieser Nachtrag ergänzt den Status „Preview offen“ aus `DUELVANTA_LEGAL_SCHRITT2_PRIVATKAEUFER_2026-09-22.md`. V32 und die dortigen Arbeits-/Freigabegrenzen bleiben bestehen. Die früheren Schritt-1-Screenshots werden nicht als Nachweis für Schritt 2 verwendet.

## 1. Quellstand und Zugriff

| Merkmal | Nachweis |
|---|---|
| Remote-Head vor diesem Dokumentationscommit | `7085c33af55d4df0814ecbb2269c3061e3b4d4c6`, erneut über GitHub gelesen; keine Abweichung zum erwarteten Schritt-2-Bericht |
| Technischer Quellcommit der geprüften Preview | `6ed31d7c9b9c9076968d5220bee236a21ca9cc3e` |
| Festes Deployment | `dpl_4pLcvd4917tie4UDAasZA2A1Q3rH` |
| Fester Host | `duelvantav5vision-5r81q7fcp-bennyescaped-3783.vercel.app` |
| Vercel-Metadaten | Erneut gelesen: READY, source=git, target=null, Branch marketplace-ux-v1, exakt der obige Quellcommit |
| Projekt / Team | `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd` / `team_VHCwSwfBWANJvmS3qdkpJ0dK` |
| Staging | `xhmjxrcskfhbovhitdej` |
| main / PR #5 vor Dokumentation | `50f88213571be13255bb52eb489cc28cca660001`; PR offen, Draft, unmerged |

Der Nutzer bediente seinen angemeldeten Browser mit einem bestehenden autorisierten Testverkäuferkonto. Die Anwendung war erreichbar; Vercel-Zugang und DUELVANTA-Nutzersitzung sind damit praktisch belegt, nicht durch eine behauptete übernommene Toolsitzung. TinyFish wurde nicht eingesetzt. Keine Passwörter, OTPs, Cookies, Schlüssel oder Sitzungstokens wurden angefordert oder in diesen Bericht übernommen.

Die sichtbaren Screenshots wurden am 22.09.2026 zwischen 15:09 und 15:41 laut lokalen Dateinamen aufgenommen. Die zwei Konsolenausgaben nennen `2026-09-22T13:33:48.003Z` und `2026-09-22T13:38:46.953Z`. Das sind Browserzeitangaben, keine unabhängig beglaubigten Serverzeitstempel.

## 2. PASS / FAIL / BLOCKIERT

| Prüfschritt | Ergebnis | Konkrete Evidenz und Grenze |
|---|---|---|
| Festes Preview-Deployment / angemeldeter Zugriff | PASS | E03 zeigt den festen Host in der Adressleiste und die Bestellansicht; E05/E06 bestätigen denselben Host und Umgebung `preview`. Vercel-Metadaten ordnen den Quellcommit zu. Kein byteweiser Vergleich sämtlicher ausgelieferter Assets. |
| Normales Profil / Entfernung der doppelten Käuferwahl | PASS, Sichtprüfung | E01: auf „Account & Sicherheit“ folgt direkt „Private Standard-Lieferadresse“. Kontodaten und Empfängername werden angezeigt; an der bisherigen Stelle fehlt die zusätzliche Käuferstatusauswahl samt Speicherbutton. Keine Profiländerung geprüft. |
| Bestehende Bestellung lesbar | PASS | E03: `DV-260915-000007`, vorhandene synthetische Testposition, 1,00 EUR Warenwert plus 2,00 EUR Versand, insgesamt 3,00 EUR, Status offen. Keine neue Bestellung. |
| Bestehender Bestellnachweis erreichbar | PASS, Abruf/Sichtprüfung | E04: Dialog „Unveränderbare Bestellbestätigung“, 1 Vertragsnachweis, `checkout-contract-v1`, Hinweis auf gespeicherte SHA-256-Prüfsumme. Kein Download, keine Neuberechnung oder Vorher-Nachher-Prüfung des Vertragsnachweis-Hashes. |
| Staging-Konfiguration und beobachtete Netzwerkziele | PASS, erfasster Browserumfang | E05/E06: Konfiguration auf `xhmjxrcskfhbovhitdej.supabase.co`; zuerst 78, danach 98 Resource-Timing-Einträge zu diesem Host. Unter den vier ausgegebenen Hosts kein Production-Supabase. Dies ist keine vollständige Netzwerk-/Server-Auditierung. |
| Legal-Sperrhinweis / Laufzeitstatus | PASS | E02/E03/E07: Sperrhinweis sichtbar. E05/E06: Guard-Version `1.1`, Status `schema-unavailable`, `available=false`. Die Ursache der Schema-Inkompatibilität wurde in diesem Schritt nicht durch einen neuen RPC-Detailabruf bestimmt. |
| Vorhandener Angebots-Sendebutton | PASS, DOM-Zustand | E05/E06: `#sendOffer` jeweils 1 vorhanden, 1 mit `:disabled`. Kein Klick oder künstlicher Eventdispatch; daraus kein neuer Nachweis sämtlicher Handler-/Servergrenzen. |
| Annahmebutton eines offenen eingegangenen Angebots | BLOCKIERT | E06: `[data-accept-offer]` 0 vorhanden. E07 bestätigt die Preisangebotsansicht mit „Keine aktiven Vorgänge. Abgeschlossene Einträge findest du im Archiv.“ Im geprüften Konto fehlt damit ein geeigneter aktiver Angebotszustand. Keine Aussage über andere Konten oder den gesamten Datenbankbestand. |
| Weitere neue Vertragsaktionsbuttons | BLOCKIERT, praktische Evidenz fehlt | E05/E06: die unten benannten weiteren Aktionsselektoren sind im untersuchten DOM nicht vorhanden. Abwesenheit ist weder ein bestandener Deaktivierungstest noch ein Fehler. Keine Testdaten oder Dialoge künstlich injiziert. |

**Gesamtstatus des erhobenen Nachtests: TEIL-PASS / REST BLOCKIERT.** Die Annahmebutton-Lücke ist eine Testdaten-/Nachweislücke, kein reproduzierter Anwendungsfehler. Es gibt keinen Grund für einen Codefix allein wegen dieser Leermeldung.

## 3. Konsolenbefunde im Detail

Die vom Nutzer ausgeführte IIFE liest nur Host/Pfad, ausgewählte nicht geheime Konfigurationswerte, Guard-Status, vorhandene `performance.getEntriesByType('resource')`-Einträge und `document.querySelectorAll` / `matches(':disabled')`. Sie erzeugt keine Anfrage, ruft keinen RPC auf, schreibt keinen Speicher und löst keine Klicks aus. Vor dem Lesen verlangt sie den festen Host, `/trade.html` und den obersten Browserkontext. Es wurden keine Sessionobjekte, Request-Header oder vollständigen Ressourcen-URLs ausgegeben.

Die zweite Messung erfolgte nach der Navigation zu Preisangeboten. Die Hostliste enthielt weiterhin nur den festen Preview-Host (42 Einträge), `cdn.jsdelivr.net` (1), `vercel.live` (3) und den Staging-Supabase-Host (98). Die Zahlen sind Ressourcenpuffer-Zähler, keine Zählung von Bestellungen, erfolgreichen Datenbankabfragen oder sämtlichen Verbindungen. Insbesondere werden damit andere Seitenstarts, WebSocket-Nachrichten und serverseitige Aufrufe nicht vollständig erfasst.

Nicht vorhandene neue Aktionsselektoren in beiden Tabellen: `#dvBuyNow`, `[data-accept-offer]`, `[data-checkout-offer]`, `[data-o-stripe]`, `[data-o-withdraw]`, `#oWithdrawalPrepare`, `#oWithdrawalConfirm`. Ihre einzelnen Deaktivierungsprüfungen bleiben ohne geeigneten vorhandenen Ansichts-/Datenzustand BLOCKIERT. Der ebenfalls nicht vorhandene `#saveBuyerPurchaseType` ist aus dem Schritt-2-Profil absichtlich entfernt; seine Abwesenheit in TRADE ist kein zusätzlicher Profilnachweis. Maßgeblich für die sichtbare Profilbereinigung ist E01.

Die bestehenden isolierten CI-Ergebnisse aus dem Schritt-2-Bericht bleiben eigenständige Evidenz (Scanner #651, Battle #127). Sie wurden hier nicht neu ausgeführt und ersetzen die fehlenden praktischen Einzelprüfungen nicht.

## 4. Screenshot-Evidenz

Die sieben Originaldateien wurden im verfügbaren lokalen Arbeitsbereich inventarisiert, bytegleich separat gesichert und per SHA-256 zugeordnet. In `/mnt/data` wurde bis zur geprüften Verzeichnistiefe keine Git-Arbeitskopie gefunden; vorhandene Anwendungsdateien wurden nicht überschrieben oder gepusht. Die Originalbilder bleiben außerhalb des Repositorys, damit keine Kontodaten oder fachfremden Browserinhalte mitveröffentlicht werden. Die Hashliste ist eine Zuordnungshilfe, kein Ersatz für die Originalbilder.

| ID | Originaldatei | SHA-256 der hochgeladenen PNG-Datei |
|---|---|---|
| E01 | Bildschirmfoto 2026-09-22 um 15.09.12.png | `b98bed242da199e11774a3a1e6f3beff214d345399b9247230a160b334fc1128` |
| E02 | Bildschirmfoto 2026-09-22 um 15.13.23.png | `2829412e8bb27b19e820e367d3cdd07f59e1f51a1fbee21ee402b91f049e68ac` |
| E03 | Bildschirmfoto 2026-09-22 um 15.17.09.png | `53d1e9a519e08cceceaaea0f023059ce8b788435aba3717f7831729b5c04d967` |
| E04 | Bildschirmfoto 2026-09-22 um 15.19.19.png | `a1d6748ccf38ed966e38d60833d24de766e526f77f75147ba07fb35ae79665b1` |
| E05 | Bildschirmfoto 2026-09-22 um 15.34.05.png | `eaf4b716e8d04443ba09ee4e2dd1190d9871bcd67f7bb32d476e5b8c4adcabd5` |
| E06 | Bildschirmfoto 2026-09-22 um 15.38.54.png | `740653ff2c8c77390a9ef91b79dcc03a902a9c03d3e3550b3eb64d47d1e86a99` |
| E07 | Bildschirmfoto 2026-09-22 um 15.41.17.png | `696c5aa22896ed2454ab092157ef4006e1cd06dd0b807fcf65307da9ee100f1a` |

## 5. Grenzen und Fortsetzung

Ausschließlich dieser neue Bericht wird dem Branch hinzugefügt. Anwendungscode, SQL-Entwurf, Runtime-Config, Schema-Guard und Freigabemarker werden nicht verändert. Keine Migration und keine Stripe-Aktivierung. Keine neuen Konten, Bestellungen oder Angebote, keine Annahme, Käuferbestätigung, Storno-/Versand-/Profiländerung, Zahlung, Erstattung, Auszahlung oder E-Mail wurden als Prüfschritt ausgelöst. Es erfolgte kein Datenbank-Vorher-Nachher-Audit; die Screenshots beweisen daher keine absolute Änderungsfreiheit sämtlicher automatisch laufender Anwendungsprozesse.

Kein manueller Deploy, kein Reset, Force-Push, Branchwechsel oder Merge. main, Production und Production-Supabase bleiben durch diesen Dokumentationsblock unberührt. PR #5 bleibt Draft und unmerged. COLLECT-/BATTLE-Abnahmen, Scanner-Release-Gate und der alte Transportpatch werden nicht verändert.

Eine weitere Wiederholung derselben leeren Angebotsansicht schließt die Annahmebutton-Lücke nicht. Für einen späteren praktischen Nachweis ist ein bereits vorhandener geeigneter, autorisiert zugänglicher Daten-/Ansichtszustand erforderlich. In diesem Read-only-Block wird ein solcher Zustand nicht durch neue Angebote oder Änderungen hergestellt. Kein vollständiges Preview-PASS behaupten und die fehlenden Einzelbelege nicht durch Build-READY oder Fixtures ersetzen.

**Fortsetzungsstand: Schritt 2 veröffentlicht + vorherige CI PASS; angemeldeter Nachtest jetzt durchgeführt und als TEIL-PASS / REST BLOCKIERT dokumentiert. Schritt 3 und die übrigen V32-Folgeblöcke nicht begonnen. Die Legal-Migration bleibt nach dokumentiertem Stand unangewandt; in diesem Block gab es keine Anwendung oder erneute direkte Datenbankinventur. Keine Gesamt-, Rechts-, Migrations- oder Produktionsfreigabe.**
