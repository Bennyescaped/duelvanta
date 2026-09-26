# DUELVANTA – MASTERHANDOUT V31

Stand: 2026-09-21  
Verbindlicher Entwicklungsbranch: `marketplace-ux-v1`  
Technischer Ausgangs-Head vor Erstellung von V31: `cd92ec135eae3b3ec2df9aa93500a0349f454805`  
`main`: `50f88213571be13255bb52eb489cc28cca660001` – unverändert  
PR #5: offen, Draft, unmerged

## 1. Verbindlichkeit und Arbeitsregeln

V31 ist der aktuelle konsolidierte Übergabestand nach:
- Environment-Routing-Hardening,
- Legal Technical Preflight,
- Spectator-Media-Mehrgeräte-Abschluss,
- COLLECT-Erstnutzer-/Mobile-UX-Block F1/F2,
- mobile COLLECT-Nachträge M1–M3,
- Kaufdatum-iPhone-Nachtrag,
- F3 „eigene leere Binder sicher löschen“.

Bei Widersprüchen ersetzt V31 ältere Statusangaben. Technische Detaildokumente bleiben ergänzend verbindlich, soweit V31 sie nicht ausdrücklich ersetzt.

Vor jeder Weiterarbeit:
1. tatsächlichen Head von `marketplace-ux-v1` prüfen;
2. Abweichungen einordnen, nichts zurücksetzen;
3. ausschließlich auf `marketplace-ux-v1` arbeiten;
4. `main`, Production, Production-Supabase und Stripe Live nicht verändern;
5. keine Secrets anzeigen, kopieren oder committen;
6. keine offenen Rechtsfragen eigenständig als Produktentscheidung umsetzen;
7. keine abgeschlossenen Abnahmen ohne neuen reproduzierbaren Befund erneut aufrollen.

DUELVANTA bleibt: **COLLECT. TRADE. BATTLE.**

## 2. Repository / Release-Grenzen

Aktueller technischer Head zum V31-Erstellungszeitpunkt:
`cd92ec135eae3b3ec2df9aa93500a0349f454805`

Commit:
`feat(collect): allow safe deletion of own empty binders after PG17 proof`

PR #5:
- offen;
- Draft;
- nicht gemergt;
- Base: `main`;
- Base-Head: `50f88213571be13255bb52eb489cc28cca660001`;
- Head zum V31-Erstellungszeitpunkt: `cd92ec135eae3b3ec2df9aa93500a0349f454805`.

Production/main wurden durch die in V31 zusammengefassten Arbeiten nicht verändert.

## 3. Environment Routing – abgeschlossen

Zentrales Runtime-Routing bleibt verbindlich:

- Production → ausschließlich Production-Supabase `enifiaqsnqtbzylnfrpi`
- Preview/Development → ausschließlich DUELVANTA-STAGING `xhmjxrcskfhbovhitdej`
- Cross-Environment-Konfiguration wird vor Netzwerkzugriff fail-closed abgewiesen.

Zentraler Resolver:
`supabase-environment.js`

COLLECT, Spieler-BATTLE, Spectator, Spectator Media und Scanner-Accounting nutzen die zentrale Runtime-Konfiguration.

Detaildokument:
`DUELVANTA_ENVIRONMENT_ROUTING_HARDENING_2026-09-20.md`

Keine parallele zweite Environment-Logik einführen.

## 4. BATTLE / Spectator Media V1 – funktionaler Staging-Abschluss

Der frühere Status „Mehrgeräte-Test ausstehend/pausiert“ ist überholt.

Praktische Mehrgeräte-Abnahme auf Staging abgeschlossen:
- zwei physische Geräte/Kameras;
- drei getrennte Browser-Sitzungen;
- Host und Gast im selben Match;
- Spieler-P2P in beide Richtungen;
- separater read-only Zuschauerpfad;
- Zuschauer empfängt Bild und Ton beider Spieler;
- Zuschauer belegt keinen Spielerplatz;
- Consent/Widerruf praktisch geprüft;
- echter LiveKit-`RemoveParticipant`/Disconnect nachgewiesen;
- Spieler-P2P bleibt beim SFU-Widerruf erhalten;
- Replay eines noch gültigen alten Host-Publisher-Tokens mit HTTP 401 abgewiesen;
- neue Media-Epoche erst nach erneuter Zustimmung;
- Bild/Ton danach erneut erfolgreich.

Abschließend geprüfter BATTLE-Code-/Test-Head:
`73f6baeb08116be4753799155b787f7ea937cd8a`

Damals:
- Battle WebRTC Check #87: SUCCESS
- Scanner V16 Check #611: SUCCESS

Staging:
- `media_enabled=true`
- `max_viewers_per_match=50`

Wichtige Grenze:
- kein Lastnachweis für 50 gleichzeitige Zuschauer;
- keine Production-Freigabe;
- keine Aussage über alle Browser-/Netzwerk-/Hardwarekombinationen;
- keine rechtliche Freigabe.

Detaildokument:
`DUELVANTA_SPECTATOR_MEDIA_MULTIDEVICE_ACCEPTANCE_2026-09-21.md`

BATTLE bleibt nach diesem Abschluss **STOP**: keine neue BATTLE-Entwicklung ohne neue Produktentscheidung oder reproduzierbaren Fehler.

## 5. COLLECT – Erstnutzer-/Mobile-UX-Block abgeschlossen im geprüften Umfang

Der ursprüngliche Erstnutzer-Check ergab drei P2-Themen:
- F1: falscher Leerzustand bei Suche/Filter ohne Treffer;
- F2: fehlende Preisangaben wirkten wie vollständige Nullbewertung;
- F3: eigener leerer Testbinder konnte nicht über die Oberfläche entfernt werden.

F1–F3 sind inzwischen technisch bearbeitet und im jeweiligen dokumentierten Umfang abgeschlossen.

### 5.1 F1 – Suche / Leerzustände

Commit:
`0d502c496d0bbe0af61a65d9d2f7d535b7a0cfae`

Ergebnis:
- echter Leerbestand wird von „keine Such-/Filtertreffer“ unterschieden;
- Liste und Binder zeigen konsistente Zustände;
- Lade-/Fehlerzustände werden nicht als leerer Bestand ausgegeben;
- Suche/Filter zurücksetzen zeigt vorhandene Karten wieder.

iPhone-Safari-Nachtest durch den Nutzer:
- erfolglose Suche zeigt korrekten Hinweis;
- nach Entfernen des Suchtexts verschwindet der Hinweis;
- vorhandene Testkarten werden wieder angezeigt.

Detaildokument:
`DUELVANTA_COLLECT_UX_F1_F2_2026-09-21.md`

### 5.2 F2 – unvollständige Preisbasis

Commit:
`0d502c496d0bbe0af61a65d9d2f7d535b7a0cfae`

Ergebnis:
- `null`/fehlend bleibt unbekannt;
- ausdrücklich gespeicherter Nullpreis bleibt gültiger bekannter Wert;
- ohne Referenzwerte: „Nicht bewertet“;
- fehlende Kaufpreise: verständlicher Hinweis;
- gemischte Preisbasis: bekannte Teilsumme + Kennzeichnung „unvollständig“;
- Gesamt-P/L nur bei vollständiger erforderlicher Preisbasis numerisch, sonst neutral „—“;
- Mengenmultiplikation bleibt erhalten;
- Binderkacheln, Portfolio und Liste nutzen dieselbe Darstellungslogik.

iPhone-Safari-Nachtest durch den Nutzer:
- „Keine Preisangaben“ und „Nicht bewertet“ lesbar;
- kein zerrissener Wortumbruch mehr;
- P/L bleibt bei fehlender Preisbasis neutral.

### 5.3 M1 – mobiler Kartendialog / Fokus-Zoom / Kaufdatum

M1–M3-Commit:
`14f9a16ae7f213fedf54d43e8dd3ff9e4c1c252e`

Kaufdatum-Fix-Kandidat:
`3bf24d78a9f3789eb8f3e84c70c9a4493ec06d47`

Ergebnis:
- Eingabefelder im mobilen Kartendialog 16 px;
- kein Zoom-Verbot, kein `user-scalable=no`, kein erzwungener Zoom-Reset;
- Aktionen bleiben über normales vertikales Scrollen erreichbar;
- Kaufdatum wird auf die verfügbare Spaltenbreite begrenzt;
- nativer Datumstyp, Validierung und Speicherpfad unverändert.

Echter iPhone-/Safari-Nachtest durch den Nutzer:
- Antippen von „Kartenname“ verursacht keinen automatischen Zoom mehr;
- nach Ausblenden der Tastatur sind „Abbrechen“ und „Speichern“ durch vertikales Scrollen sichtbar;
- Kaufdatum läuft leer und befüllt nicht mehr über den Dialogrand;
- kompaktere Datumsfeldbreite wurde vom Nutzer ausdrücklich akzeptiert;
- Abbrechen verwirft eine nicht gespeicherte Datumsänderung;
- Speichern eines Kaufdatums wurde vom Nutzer praktisch bestätigt.

Wichtig zur Evidenz:
Diese Hardware-Nachweise stammen aus Nutzer-/Screenshot-Bestätigungen im begleitenden Chat, nicht aus einem von Work selbst ausgeführten iPhone-Test.

Der manuelle Speichertest hat eine synthetische Staging-Testkarte tatsächlich verändert. Frühere Work-Prüfungen ohne Datenänderung sind davon getrennt zu betrachten.

Detaildokumente:
- `DUELVANTA_COLLECT_MOBILE_M1_M3_2026-09-21.md`
- `DUELVANTA_COLLECT_PURCHASE_DATE_IPHONE_NACHTRAG_2026-09-21.md`

### 5.4 M2 – mobile Preisstatus-Typografie

Commit:
`14f9a16ae7f213fedf54d43e8dd3ff9e4c1c252e`

Ergebnis:
- lange Preisstatus-Texte brechen mobil sauber um;
- Wörter werden nicht mitten im Wort auseinandergerissen;
- Preislogik aus F2 unverändert.

iPhone-Nachtest: PASS im gezeigten fehlenden-Preis-Fall.

### 5.5 M3 – Karten ohne Bild / mobile Listenlabels

Commit:
`14f9a16ae7f213fedf54d43e8dd3ff9e4c1c252e`

Ergebnis:
- Karten ohne Bild zeigen im Binder einen lesbaren Kartennamen;
- leere Plätze bleiben unterscheidbar;
- fehlerhafte Bilddarstellung besitzt eine textliche Ersatzdarstellung;
- vorhandene Bilder bleiben unverändert;
- mobile Liste zeigt Labels für TCG, Zustand/Grading, Menge, Kaufpreis, Referenzwert und Gewinn/Verlust;
- Desktop erhält keine Doppelbeschriftung.

iPhone-Nachtest durch den Nutzer:
- vier bildlose Testkarten in der Master Collection anhand ihrer Namen erkennbar;
- mobile Listenbeschriftungen vollständig und lesbar.

## 6. F3 – sichere Löschung eigener leerer Binder – Staging-Abschluss

F3 ist für den beauftragten **Staging-Umfang abgeschlossen**.

### 6.1 Sicherheitsmodell

Ausgangsproblem:
`collection_items.folder_id -> collection_folders.id` verwendet weiterhin `ON DELETE SET NULL`. Ein ungeschützter direkter Binder-DELETE könnte daher Karten unbemerkt aus einem Binder lösen.

Deshalb wurde kein einfacher Client-DELETE eingeführt.

Migration:
`supabase/migrations/20260921144947_collect_empty_binder_delete.sql`

SHA-256 der getesteten Quelldatei:
`7ddbbf05f8d6a7e194948ed7fe7a165fced9be24d1bd5d5a87826805ef02252e`

Vorbereitender F3-Testcommit:
`4251d99a2fe514250e00f568d878b9e7708b5781`

Endgültiger Anwendungscommit:
`cd92ec135eae3b3ec2df9aa93500a0349f454805`

Prinzip:
- eigene Binderlöschung nur über abgesicherten RPC-Pfad;
- Eigentum und Anmeldung serverseitig;
- Datenverarbeitungssperren bleiben wirksam;
- Binder wird gesperrt;
- vollständige Kartenreferenzen werden serverseitig unabhängig von Browserfiltern geprüft;
- nur tatsächlich leerer Binder wird gelöscht;
- keine Karte wird gelöscht, verschoben oder automatisch entkoppelt;
- direkte Tabellen-DELETE-/TRUNCATE-Rechte für normale Browserrollen entzogen;
- bestehende privilegierte Account-Bereinigung bleibt erhalten;
- Master Collection und Graded Collection erhalten keinen Löschweg.

### 6.2 PostgreSQL-Parallelitätsnachweis

GitHub CI mit echtem PostgreSQL 17.11:
- Isolation: READ COMMITTED;
- getrennte Schreiber-/Löscher-/Beobachterverbindungen;
- unterschiedliche Backend-PIDs nachgewiesen;
- Sperrkanten mit PostgreSQL-Lockinformationen beobachtet;
- 15 verpflichtende Race-/Rollback-/Wiederholungsfälle: PASS;
- keine verlorene Karte;
- keine unbemerkte Aufhebung von Binderzuordnung/Position;
- Rollen-/Account-Erasure-Regressionsprüfungen: PASS.

CI auf Testcommit:
- Scanner V16 Check #617: SUCCESS
- Battle WebRTC Check #93: SUCCESS

CI-Artefakt:
`collect-f3-postgres-evidence`

Die Staging-Migration wurde erst **nach** dem echten PostgreSQL-Nachweis angewendet.

### 6.3 Staging-Anwendung

Projekt:
`DUELVANTA-STAGING / xhmjxrcskfhbovhitdej`

Staging-PostgreSQL:
17.6.1.166

Applied History:
- Version: `20260921151654`
- Name: `collect_empty_binder_delete`

Nachkontrolle:
- neue Funktionskörper stimmen mit getesteter Quelle überein;
- private Funktion: SECURITY DEFINER;
- öffentlicher Wrapper: SECURITY INVOKER;
- leere `search_path`;
- normale Rollen besitzen keinen direkten DELETE/TRUNCATE-Weg;
- `authenticated` besitzt den vorgesehenen EXECUTE-Pfad;
- bestehende Move-/Positions-/Sperr-/Erasure-Funktionen unverändert;
- keine neuen Security-Advisor-Findings für die F3-Funktionen.

Keine F3-Migration wurde auf Production angewendet.

### 6.4 Oberfläche / praktischer Staging-Test

Eigene leere Binder erhalten eine getrennte Löschaktion.
Belegte Binder bleiben geschützt; Suche ohne Treffer macht einen belegten Binder nicht löschbar.

Praktischer Staging-Test:
- genau einen neuen synthetischen leeren F3-Testbinder über die Oberfläche angelegt;
- über die neue Oberfläche gelöscht;
- nach Neuladen weiterhin verschwunden;
- keine neuen F3-Testdaten zurückgeblieben;
- bestehende Karten, Kaufdaten und alter Testbinder blieben durch den F3-Test unverändert.

Der ältere Binder `UXCHECK SYNTHETISCH 20260921` bleibt bestehen.

Finale CI auf Anwendungscommit `cd92ec1…`:
- Scanner V16 Check #618: SUCCESS
- Battle WebRTC Check #94: SUCCESS

Detaildokumente:
- `DUELVANTA_COLLECT_F3_ZWISCHENSTAND_2026-09-21.md`
- `DUELVANTA_COLLECT_F3_CI_2026-09-21.md`

Grenze:
Kein eigener F3-iPhone-/Android-Hardwaretest wurde durchgeführt. Der Staging-Funktions- und Sicherheitsnachweis gilt unabhängig davon; dies ist keine Production-Freigabe.

## 7. Scanner V16 – bestehendes Preview-Gate weiterhin offen

Der aktuelle Servercode erlaubt weiterhin:
- Preview nur bei `VERCEL_GIT_COMMIT_REF === 'scanner-v16'`;
- Production nur bei `VERCEL_GIT_COMMIT_REF === 'main'`.

Damit bleibt der praktische Scannerpfad auf `marketplace-ux-v1` bewusst gesperrt.

Nicht nebenbei ändern. Eine Freigabe für `marketplace-ux-v1` ist eine eigene Produkt-/Deploymententscheidung.

Die COLLECT-UX- und F3-Arbeiten haben Scanner-Erkennung, Quoten-/Kostenregeln und Providerlogik nicht freigeschaltet oder verändert.

## 8. TRADE – Legal Gate weiterhin offen

TRADE bleibt Kauf/Verkauf-Marktplatz. Tausch/Swap bleibt aus dem Release-Scope entfernt.

Der Legal Technical Preflight bleibt maßgeblich:
Aktueller Festpreis-Checkout erzeugt nach `Zahlungspflichtig bestellen` unmittelbar einen akzeptierten Deal, Order und `contract_formed_at`.

Es existiert technisch keine nachgelagerte Verkäuferannahme innerhalb von fünf Tagen.

Dies bleibt ein GAP zur damals generierten Ziffer 13 der Plattform-Nutzungsbedingungen und ist weiterhin:
**LEGAL DECISION REQUIRED**

Keine Änderung dieses Vertragsschlussmodells in den seit V30 abgeschlossenen UX-Blöcken.

Weitere offene anwaltliche Punkte:
1. TRADE-Vertragsschluss / Annahmemodell;
2. COLLECT / OpenAI / Supabase Datenschutz;
3. TRADE-Datenverarbeitungen, Retention, PStTG/DAC7;
4. BATTLE / LiveKit / WebRTC Datenschutz;
5. gewerbliche B2C-Verkäufertexte und Verbraucherinformationen;
6. zentrale elektronische Widerrufsfunktion / Zielmodell.

Die strukturierte individuelle Anfrage an die IT-Recht Kanzlei wurde am 20.09.2026 abgeschickt; Antwort bleibt zum V31-Zeitpunkt ausstehend.

Bis zur Antwort:
- keine offenen Rechtsfragen eigenständig implementieren;
- keine produktive Legal-Freigabe behaupten;
- Stripe Live nicht aktivieren;
- keine echten Payments/Refunds/Payouts.

## 9. Rechtstexte / aktuelle Basis

Gebuchte/konfigurierte Basis:
- Impressum;
- Online-Plattform-Nutzungsbedingungen;
- Datenschutz;
- Widerrufsbelehrung Dienstleistungen.

Frühere Antworten des Kanzlei-KI-Assistenten gelten nicht als individuelle anwaltliche Freigabe.

Technische Readiness-Bausteine wie Snapshots, Sellerstatus, Audit, PStTG/DAC7-Ledger, Notice-&-Action, Datenexport/-löschung und Stripe-Connect-Sandboxfundament bleiben vorhanden; offene Zielentscheidungen werden erst nach anwaltlicher Rückmeldung umgesetzt.

## 10. CI / letzter bestätigter Stand

Auf endgültigem Anwendungshead:
`cd92ec135eae3b3ec2df9aa93500a0349f454805`

- Scanner V16 Check #618: SUCCESS
- Battle WebRTC Check #94: SUCCESS

Der V31-Commit selbst ist ausschließlich Dokumentation. Vor jeder technischen Weiterarbeit ist deshalb der tatsächliche Branch-Head zu prüfen.

## 11. Was aktuell NICHT erneut geöffnet werden soll

Ohne neuen reproduzierbaren Befund nicht erneut bearbeiten:
- BATTLE Spectator Foundation V1;
- BATTLE Spectator Media funktionaler Mehrgerätepfad;
- Host↔Gast P2P-Grundpfad;
- F1/F2 COLLECT-Leerzustände/Preisvollständigkeit;
- M1 Fokus-Zoom / Dialogaktionen;
- M2 mobile Preisstatus-Typografie;
- M3 Bildersatzdarstellung / mobile Listenlabels;
- akzeptierte kompakte Kaufdatum-Darstellung;
- F3 Sicherheitsmodell für leere Binder.

Neue echte Fehler dürfen selbstverständlich isoliert geprüft werden.

## 12. Aktuelle offene Gates

### A. IT-Recht Kanzlei
Antwort auswerten und verbindliches Zielmodell für Vertragsschluss, Datenschutz und Widerruf festlegen.

### B. Scanner-Preview-Gate
Separat entscheiden, ob und wann Scanner V16 auf `marketplace-ux-v1` beziehungsweise später auf dem Livepfad freigegeben wird.

### C. 50-Zuschauer-Lastnachweis
Spectator Media ist funktional abgenommen, aber das konfigurierte Beta-Limit 50 ist noch kein praktisch nachgewiesener Lastwert.

### D. Production-/Live-Release
Noch keine Production-Freigabe. Vor Live:
- Legal-Entscheidungen umsetzen;
- vollständige Gesamtregression;
- Production-Routing/Secrets/Provider final prüfen;
- Stripe-Live weiterhin erst nach ausdrücklicher Entscheidung;
- finale Gesamtprüfung/Codex-Review.

## 13. Empfohlene nächste Reihenfolge

1. Auf Antwort der IT-Recht Kanzlei warten beziehungsweise diese nach Eingang auswerten.
2. Vertragsschluss-Zielmodell und Datenschutz-/Widerrufspunkte verbindlich entscheiden.
3. Nur daraus notwendige Legal-/TRADE-Änderungen implementieren und abnehmen.
4. Scanner-Preview-/Release-Gate separat entscheiden.
5. Vor Live komplette Regression und Codex-Schlussprüfung.
6. Erst nach stabiler Web-Livephase die geplante DUELVANTA-Mobile-App als gemeinsamen Client derselben Konten/Datenbasis beginnen.

Bis zur Kanzlei-Antwort können weiterhin klar isolierte, legal-unabhängige Prüfungen durchgeführt werden; keine neue Großbaustelle eröffnen.

## 14. Übergabe für neuen Chat

Neuer Chat soll zuerst vollständig lesen:
1. `DUELVANTA_MASTERHANDOUT_V31_2026-09-21.md`
2. bei Legal-Arbeit zusätzlich `DUELVANTA_LEGAL_TECHNICAL_PREFLIGHT_2026-09-20.md`
3. bei Spectator-Fragen zusätzlich `DUELVANTA_SPECTATOR_MEDIA_MULTIDEVICE_ACCEPTANCE_2026-09-21.md`
4. bei COLLECT/F3 zusätzlich die jeweiligen Abschlussdokumente.

Danach tatsächlichen Repository-Head prüfen.

Erwartete technische Basis vor V31-Dokumentationscommit:
`cd92ec135eae3b3ec2df9aa93500a0349f454805`

Erwartete unveränderte Production-Basis:
`main = 50f88213571be13255bb52eb489cc28cca660001`

PR #5 bleibt offen, Draft, unmerged.

Wenn die Kanzlei noch nicht geantwortet hat:
- keine Legal-Entscheidung erzwingen;
- nur legal-unabhängige, klar begrenzte Arbeiten durchführen.

---
Ende V31.
