# DUELVANTA – MASTERHANDOUT V30

Stand: 2026-09-20
Verbindlicher Entwicklungsbranch: `marketplace-ux-v1`
Verbindlicher Branch-Head vor diesem V30-Aktualisierungscommit: `d0470c4cb34eb9f8c1ae02060118847f86a92c07`
`main`: `50f88213571be13255bb52eb489cc28cca660001` – unverändert
PR #5: offen, Draft, unmerged

## 1. Verbindlichkeit und Arbeitsregeln

V30 ist der aktuelle Übergabestand und ersetzt widersprechende ältere Statusangaben. Vor jeder Weiterarbeit tatsächlichen Repository-Stand prüfen.

- ausschließlich `marketplace-ux-v1`
- `main`, Production und Production-Supabase nicht verändern
- Stripe Live nicht aktivieren; keine echten Payments/Refunds/Payouts
- keine Secrets anzeigen, kopieren oder committen
- keine unnötigen/manuellen Vercel-Deployments
- Spectator Media V1 bleibt bis zum separaten Mehrgeräte-Test pausiert
- offene Rechtsentscheidungen nicht eigenmächtig in Produktlogik umsetzen

## 2. Produktstatus

DUELVANTA = COLLECT. TRADE. BATTLE.

TRADE ist Kauf/Verkauf-Marktplatz; Tausch/Swap dauerhaft aus Release-Scope entfernt. Verkäuferrollen privat/trader vorhanden. Beta zunächst kostenlos; spätere Monetarisierung/Abo möglich. TRADE soll vor Produktivstart rechtlich final geprüft werden.

## 3. BATTLE / Spectator Media

Spectator Foundation V1 ist praktisch abgenommen: öffentlicher/privater Zuschauerpfad, read-only, Presence-Deduplizierung, normales Verlassen, Link-Rotation/Widerruf, Trennung Spieler-Code/Zuschauerlink.

Spectator Media wurde technisch weit entwickelt und Browserpfade wurden bereits erfolgreich getestet. Aktuelles Gate bleibt jedoch der echte Mehrgeräte-Test. Keine weitere Media-Entwicklung oder LiveKit-Abnahme beginnen, bis mehrere Geräte verfügbar sind. Beta-Zuschauerlimit: 50.

## 4. Rechtstexte / IT-Recht Kanzlei

Gebuchte/konfigurierte Basis:
- Impressum
- Online-Plattform-Nutzungsbedingungen
- Datenschutz
- Widerrufsbelehrung Dienstleistungen

Die bisher besprochenen Antworten auf Detailfragen stammten vom KI-Assistenten der Kanzlei und sind NICHT als individuelle anwaltliche Freigabe zu behandeln.

Aus Kanzlei-KI/Generator als Arbeitsannahmen dokumentiert:
- private und gewerbliche Verkäufer müssen klar getrennt werden
- gewerbliche B2C-Verkäufer benötigen eigene Händler-Rechtstexte/Verbraucherinformationen
- zentrale elektronische Widerrufsfunktion für widerrufsfähige Verbraucherverträge ist vorzusehen; C2C nicht automatisch darunter
- strukturiertes Notice-&-Action-System ist zentraler Meldeweg; konkrete Textabstimmung offen
- ordentliche Beendigung gewerblicher Verkäuferkonten: als Arbeitsannahme mindestens 30 Tage + Begründung in Textform
- Supabase nur als Auth-Dienst im aktuellen Datenschutztext ist unvollständig; Backend/DB/Storage und konkrete Datenverarbeitungen müssen nachgezogen werden

Offen für individuelle anwaltliche Prüfung:
1. TRADE-Vertragsschluss / Ziffer 13 / 5-Tage-Verkäuferannahme vs. aktueller Checkout
2. COLLECT/OpenAI/Supabase-Datenschutz
3. TRADE-Datenverarbeitungen, Retention/PStTG/DAC7
4. BATTLE/LiveKit/WebRTC-Datenschutz

Eine strukturierte Anfrage an einen echten Ansprechpartner der IT-Recht Kanzlei wurde am 20.09.2026 abgeschickt. Antwort ausstehend. Bis dahin keine offenen Legal-Entscheidungen implementieren.

## 5. Legal Technical Preflight

Dokument:
`DUELVANTA_LEGAL_TECHNICAL_PREFLIGHT_2026-09-20.md`

Wichtigster TRADE-Befund:
Aktueller Festpreis-Checkout erzeugt nach `Zahlungspflichtig bestellen` unmittelbar Deal `accepted`, Order und Vertrags-Snapshot/`contract_formed_at`. Es existiert technisch keine nachgelagerte Verkäuferannahme innerhalb von fünf Tagen. Das ist ein GAP zur aktuell generierten Ziffer 13 und bleibt `LEGAL DECISION REQUIRED`.

Widerruf-Readiness:
Snapshots, Seller-Status, Order-/Payment-Bezug, Outbox, Audits und Berechtigungsgrenzen sind wiederverwendbar. Es fehlt eine eigene typisierte Widerrufsdomäne. Spätere technische Trennung:
- `marketplace_b2c`
- `marketplace_c2c`
- `duelvanta_direct_consumer`

Erklärung/Widerruf, Storno, Refund und Case nicht vermischen.

## 6. Environment Routing Hardening – abgeschlossen

Ausgang: Legal-Preflight fand gemischte Production-/Staging-Ziele in Preview-Pfaden.

Implementierungs-Commit:
`bd482d3e241977b655316bd7ab75b03ddf9e1923`

Dokumentations-/finaler Head:
`bda7617a18eea1897f9add7d9440c1c3b3d49793`

Dokument:
`DUELVANTA_ENVIRONMENT_ROUTING_HARDENING_2026-09-20.md`

Sollzustand jetzt:
- Production → ausschließlich Production-Supabase `enifiaqsnqtbzylnfrpi`
- Preview/Development → ausschließlich Staging `xhmjxrcskfhbovhitdej`
- abweichende Supabase-Ziele werden vor Netzwerkzugriff abgewiesen
- COLLECT, Spieler-BATTLE, Spectator, Spectator Media und Scanner nutzen denselben zentralen Resolver
- Production-/Staging-Refs und statische Publishable Keys liegen in Runtime-Pfaden nur noch in `supabase-environment.js`
- parallele Hostname-/Monkeypatch-Logik aus `site-nav.js` entfernt
- Scanner Auth/Quota/Accounting nutzt zentralen Resolver

main, Production-Supabase, Stripe Live und LiveKit blieben unverändert.

## 7. Post-Hardening Smoke Test – PASS

Getesteter/finaler Head bleibt:
`bda7617a18eea1897f9add7d9440c1c3b3d49793`

Keine Codeänderung und kein zusätzlicher Commit erforderlich.

Ergebnisse:
- Environment: PASS – Preview/Development ausschließlich Staging
- Fehlkonfiguration: PASS – Cross-Environment-Ziele 503; Scanner-Test bestätigte null Netzwerkzugriffe vor Ablehnung
- COLLECT: PASS – Auth, Collection und Binder geladen; vorhandene Staging-Einträge sichtbar
- TRADE: PASS mit Testdaten-GAP – Marketplace, synthetische Orders und Seller-Onboarding geladen; kein geeignetes aktives Fremdinserat, daher bewusst kein neuer Vertragsschluss
- Spieler-BATTLE: PASS – vorhandener Matchzustand/Profile geladen; Kamera blieb aus
- Preview-Konsole: keine DUELVANTA-Laufzeitfehler
- Scanner: wegen bestehendem `scanner-v16`-Branch-Gate nicht praktisch ausgeführt; null echte OpenAI-Aufrufe
- lokaler Chromium-WebRTC-Loopback blieb zweimal `state=new`; separates lokales Testumgebungs-GAP, CI auf exakt demselben Head grün

Regression:
- Battle WebRTC Check #73: `battle_webrtc` SUCCESS, `spectator_database` SUCCESS
- Scanner V16 Check #597: `validate` SUCCESS, `quota_database` SUCCESS
- Environment-Routing/Runtime-Config/Syntax: PASS
- Scanner V16 Mock: PASS
- TRADE/Marketplace/Compliance/Stripe-Mocks: PASS
- Spectator Database automatisiert: PASS

## 8. Aktuelle offene Gates

### A. Kanzlei
Antwort auf individuelle Legal-Anfrage abwarten. Danach Vertragsschluss und Datenschutz-Lücken priorisiert entscheiden.

### B. Spectator Media
Pausiert bis echter Mehrgeräte-Test möglich ist. Keine weitere Entwicklung/Testung vorher.

### C. Scanner Preview
Separates GAP: Scanner-Preview bleibt durch bestehende Freigabelogik auf Branch `scanner-v16` beschränkt. Nicht nebenbei ändern; eigene Produkt-/Freigabeentscheidung.

### D. TRADE Testdaten
Für Smoke-Test fehlte ein geeignetes aktives Fremdinserat. Kein Blocker des Environment-Hardenings; bei späterer Checkout-Abnahme gezielt synthetische Testdaten vorbereiten.

## 9. Empfohlene nächste Reihenfolge

1. Antwort der IT-Recht Kanzlei auswerten.
2. Daraus Zielmodell für TRADE-Vertragsschluss festlegen.
3. Datenschutz-Ergänzungen/Provider-Matrix finalisieren.
4. Danach Legal-Implementierungsblock: B2C-Händlertexte-Infrastruktur, Widerrufsdomäne und erforderliche Checkout-Anpassungen.
5. Separat Scanner-Branch-Gate entscheiden.
6. Sobald mehrere Geräte verfügbar sind: Spectator-Media-Mehrgeräte-Abnahme fortsetzen.
7. Vor Live finale Gesamtprüfung/Codex-Review.

## 10. Projektarchiv

Konsolidierte Historie: `DUELVANTA_PROJECT_HISTORY_2026-09-20.md`.
Archiv-Commit: `d0470c4cb34eb9f8c1ae02060118847f86a92c07`.
Das Projektarchiv dient als historischer Kontext für archivierte Chat-/Work-Verläufe; bei Widersprüchen haben V30 bzw. spätere Masterhandouts und der tatsächliche Repository-Stand Vorrang.

## 11. Übergabe für neuen Chat

Neuer Chat soll zuerst V30 vollständig lesen und anschließend tatsächlichen Repository-Head prüfen. Erwartet:
- Branch `marketplace-ux-v1`
- Head: tatsächlichen aktuellen `marketplace-ux-v1`-Head prüfen; unmittelbar vor diesem V30-Aktualisierungscommit `d0470c4cb34eb9f8c1ae02060118847f86a92c07`
- main `50f88213571be13255bb52eb489cc28cca660001`
- PR #5 offen/Draft/unmerged

Wenn die Kanzlei noch nicht geantwortet hat, keine Legal-Entscheidung erzwingen. Stattdessen nur klar isolierte, von Legal unabhängige Arbeiten durchführen.

---
Hinweis: Dieser V30-Aktualisierungscommit ändert ausschließlich Dokumentation; Anwendungscode bleibt auf dem technisch getesteten Stand `bda7617a18eea1897f9add7d9440c1c3b3d49793`.

---
Ende V30.
