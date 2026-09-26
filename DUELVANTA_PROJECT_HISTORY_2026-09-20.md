# DUELVANTA – PROJECT HISTORY
Stand: 2026-09-20

Zweck: Konsolidiertes Projektarchiv vor Archivierung älterer Chat- und Work-Verläufe. Für aktuelle Entscheidungen gilt immer das neueste Masterhandout plus tatsächlicher Repository-Stand. Aktueller operativer Stand: `DUELVANTA_MASTERHANDOUT_V30_2026-09-20.md`.

## 1. Vision und Produkt
DUELVANTA = **COLLECT. TRADE. BATTLE.** Primärdomain duelvanta.de, zusätzlich duelvanta.com. Designrichtung Schwarz/Gold, `v-logo.svg`. Start mit Pokémon und One Piece; spätere modulare Erweiterung um weitere TCGs vorgesehen. Beta zunächst kostenlos, spätere Monetarisierung/Abo möglich.

COLLECT: Sammlung, Scanner, Binder, Grading/Slabs.
TRADE: Marktplatz für physische Karten und Sealed-Produkte.
BATTLE: Webcam-Matches mit Zuschauerfunktion.

## 2. Repository-/Release-Strategie
Repository: `Bennyescaped/duelvanta`.
Entwicklung auf `marketplace-ux-v1`; PR #5 Draft/unmerged. `main` blieb während der dokumentierten Staging-Arbeiten eingefroren. Wiederkehrende Regeln: Production/main nicht verändern, Production-Supabase nicht für Staging beschreiben, Stripe Live aus, keine echten Payments/Refunds/Payouts, keine Secrets committen, keine unnötigen manuellen Deployments.

## 3. COLLECT / Scanner
Scanner wechselte von Ximilar auf OpenAI; Google Vision/Gemini wurden evaluiert. Beta-Limits: 50 Karten/Woche und 10 Slabs/Woche; Admin-/Quota-/Budgetlogik aufgebaut. Slab/PSA zeitweise bewusst manuell.

Scanner V16 wurde stabiler Referenzpfad mit eigener CI. Separates offenes Gate: praktische Preview-Freigabe weiterhin auf Branch `scanner-v16` beschränkt.

COLLECT entwickelte Sammlung, Kartenbilder, Binder, Drag&Drop, Seitenwechsel, Reload nach Setzen und konfigurierbare Seitenzahl. Private Kartenbilder/Sammlungsdaten sowie OpenAI-Bildanalyse/Supabase-Storage bleiben Teil der finalen Datenschutzprüfung.

## 4. TRADE / Marketplace
Verkäuferrollen privat und trader/gewerblich, Seller-Onboarding, Owner-Freigabe und Status-Audits wurden aufgebaut. Ein synthetischer C2C-Sealed-Checkout wurde praktisch abgenommen.

Wichtige Produktentscheidung 17.09.2026: **Tausch/Swap dauerhaft aus Release-Scope entfernt.** TRADE bedeutet seitdem ausschließlich Kauf/Verkauf. Aktive Swap-CTAs/Tabs/Navigation und Neuanlage wurden kontrolliert stillgelegt, historische Daten nicht unnötig zerstört.

Aufgebaut wurden u.a. Listings, Orders, Shipping Profiles, Lieferadress-Snapshots, Pickup, Nachrichten, Order Resolution, Bewertungen, Moderation und Compliance.

Stripe Connect wurde vorbereitet; Live blieb deaktiviert.

## 5. TRADE Compliance
Technisch vorbereitet: Notice & Action, Beschwerde-/Moderationssystem, PStTG/DAC7-Ledger, Export/Löschung, Verkäuferstatus, Audits, Vertrags-/Order-Snapshots, Compliance Message Dispatch und Account Data Erasure.

B07 Legal Review vom 15.09.2026: anwaltliche und steuerliche Schlussprüfung vor Produktivstart erforderlich.

## 6. BATTLE / Spieler-WebRTC
Webcam-Matches und Zwei-Spieler-WebRTC wurden entwickelt und praktisch/automatisiert getestet. CI blieb bis Battle WebRTC Check #73 grün. Bei nur einem verfügbaren Gerät wurden keine künstlichen Zwei-Kamera-Abnahmen erzwungen.

## 7. Spectator Foundation V1
Am 18.09.2026 praktisch weitgehend abgenommen: öffentlicher/privater Zuschauerpfad, read-only, kein Spielerplatzverbrauch, Presence-Deduplizierung, normales Verlassen, Link-Rotation/Widerruf, Trennung Spieler-Code/Zuschauerlink und sichtbare Ablehnung falscher Codes.

Historische technische/Dokumentations-Checkpoints existieren im Repository; aktuelle Wahrheit ergibt sich aus V30 und aktuellem Branch-Head.

## 8. Spectator Media V1
Staging: `xhmjxrcskfhbovhitdej`; pg_net, pg_cron, Vault, Edge-Reconciler und LiveKit wurden aufgebaut. Revocation `player_withdrawal` wurde pending → HTTP 200 → done verarbeitet und idempotent nachgewiesen; alte Epoche wurde nicht wiederverwendet. Reconciler erreichte Version 5.

Publisher-/Viewer-Pfade wurden später registriert und Host/Gast/Zuschauer im Browser erfolgreich getestet. Vollständiger realer Mehrgeräte-Test blieb mangels weiterer Geräte offen.

**Aktuelles Gate: Spectator Media pausiert bis Mehrgeräte-Test.**
Beta-Zuschauerlimit: 50.

## 9. IT-Recht Kanzlei / Legal
Konfiguriert: Impressum, Online-Plattform-Nutzungsbedingungen, Datenschutz, Widerrufsbelehrung Dienstleistungen.

Viele Detailantworten stammten vom KI-Assistenten der Kanzlei und gelten ausdrücklich **nicht als individuelle anwaltliche Freigabe**.

Dokumentierte Arbeitsannahmen:
- private/gewerbliche Verkäufer klar trennen;
- gewerbliche B2C-Verkäufer brauchen eigene Händler-Rechtstexte/Verbraucherinformationen;
- zentrale elektronische Widerrufsfunktion für widerrufsfähige Verbraucherverträge vorsehen; C2C nicht automatisch darunter;
- strukturiertes Notice-&-Action-System als zentraler Meldeweg;
- ordentliche Beendigung gewerblicher Verkäuferkonten als Arbeitsannahme mindestens 30 Tage + Begründung;
- Supabase nur als Auth-Dienst im aktuellen Datenschutztext ist unvollständig.

Am 20.09.2026 wurde eine strukturierte Anfrage an einen echten Kanzlei-Ansprechpartner versendet. Offen:
1. TRADE-Vertragsschluss / 5-Tage-Annahme vs. aktueller Checkout;
2. COLLECT/OpenAI/Supabase Datenschutz;
3. TRADE-Daten/Retention/PStTG/DAC7;
4. BATTLE/LiveKit/WebRTC Datenschutz.

## 10. Vertragsschluss / Widerruf
Legal Technical Preflight: aktueller Festpreis-Checkout erzeugt nach Käuferaktion unmittelbar Deal `accepted`, Order und Vertrags-Snapshot/`contract_formed_at`. Keine nachgelagerte Verkäuferannahme binnen fünf Tagen. GAP zur aktuell generierten Kanzlei-Ziffer 13 → `LEGAL DECISION REQUIRED`.

Für spätere Widerrufsfunktion wiederverwendbar: Snapshots, Seller-Status, Order-/Payment-Bezug, Outbox, Audits, Berechtigungsgrenzen. Fehlende typisierte Domäne soll unterscheiden:
- `marketplace_b2c`
- `marketplace_c2c`
- `duelvanta_direct_consumer`

Widerruf, Storno, Refund und Case nicht vermischen.

## 11. Environment Routing Hardening
Legal-Preflight fand gemischte Production-/Staging-Ziele. Isoliert behoben.

Implementierungscommit: `bd482d3e241977b655316bd7ab75b03ddf9e1923`
Hardening-Stand: `bda7617a18eea1897f9add7d9440c1c3b3d49793`
Dokument: `DUELVANTA_ENVIRONMENT_ROUTING_HARDENING_2026-09-20.md`

Ergebnis:
- Production → nur `enifiaqsnqtbzylnfrpi`
- Preview/Development → nur `xhmjxrcskfhbovhitdej`
- Cross-Environment-Konfiguration vor Netzwerkzugriff abgewiesen
- COLLECT, Spieler-BATTLE, Spectator, Spectator Media und Scanner nutzen gemeinsamen Resolver
- Scanner Auth/Quota/Accounting zentral geroutet
- Runtime-Refs/Publishable Keys zentralisiert
- parallele Hostname-/Monkeypatch-Logik entfernt

## 12. Post-Hardening Smoke Test
Auf `bda7617a18eea1897f9add7d9440c1c3b3d49793`:
Environment PASS; Fehlkonfiguration PASS; COLLECT PASS; TRADE PASS mit Testdaten-GAP; Spieler-BATTLE PASS; keine DUELVANTA-Laufzeitfehler; keine Codeänderung nötig. Scanner respektierte Branch-Gate, null echte OpenAI-Aufrufe.

CI: Battle #73 SUCCESS inkl. spectator_database; Scanner #597 SUCCESS; TRADE/Marketplace/Compliance/Stripe-Mocks PASS. Lokaler Chromium-WebRTC-Loopback blieb `state=new`, als separates lokales Testumgebungs-GAP bewertet.

## 13. Provider-/Datenbestand
Bekannt/relevant: Vercel, Supabase Auth/PostgreSQL/Storage, OpenAI, Stripe Connect, LiveKit/WebRTC und Resend. Diese Provider-/Datenflüsse sind Grundlage der finalen Datenschutzprüfung; Rechtsgrundlagen nicht aus Code erfinden.

## 14. Weitere Entscheidungen
Beta zunächst kostenlos. App später. Weitere TCGs modular. TRADE kann perspektivisch sichtbar sein, aber bis Legal-Freigabe per Release-Gate/Coming-soon gesperrt bleiben. Codex soll für finale technische Prüfung vor Live eingesetzt werden.

## 15. Aktuelle Gates
- **Legal:** echte Kanzlei-Antwort ausstehend.
- **Spectator Media:** Mehrgeräte-Test ausstehend; pausiert.
- **Scanner:** Preview-Branch-Gate `scanner-v16` separat offen.
- **TRADE-Testdaten:** beim Smoke-Test kein geeignetes aktives Fremdinserat; bewusst kein neuer Vertragsschluss.

## 16. Masterhandouts / Archivlogik
Die Entwicklung wurde über zahlreiche Masterhandouts und spezialisierte Abnahmedokumente fortgeschrieben. Frühere Versionen bleiben historische Quellen, werden aber durch spätere Handouts überschrieben, wenn Angaben kollidieren.

Aktueller operativer Master:
`DUELVANTA_MASTERHANDOUT_V30_2026-09-20.md`

V30-Dokumentationscommit:
`7e883dd2e157ca5da0c6601b29556d857e5b3c0f`

`main` bleibt:
`50f88213571be13255bb52eb489cc28cca660001`

Nach Erstellung dieses Projektarchivs können ältere DUELVANTA-Chats und Work-Chats als Arbeitsverläufe archiviert werden, sofern erhalten bleiben:
1. Repository `marketplace-ux-v1`;
2. neuestes Masterhandout;
3. dieses Project-History-Dokument;
4. spezialisierte Legal-/Battle-/Spectator-/Abnahmedokumente im Repository.

Dieses Dokument ersetzt weder Git-Historie noch das jeweils neueste Masterhandout.

## Nachtrag 2026-09-21 – Spectator Media Abschluss

Dieser Nachtrag ersetzt die vorstehenden Angaben „Mehrgeräte-Test ausstehend/pausiert“ und den damaligen Spectator-Anwendungscode-Stand. Die übrigen Gates bleiben unverändert.

- Funktionale Staging-Abnahme bestanden: zwei physische Geräte/Kameras, drei getrennte Browser-Sitzungen (Host Chrome, Gast iPhone Safari, Zuschauer Safari auf Host-Mac).
- Echter LiveKit-Widerruf, fortbestehendes Spieler-P2P, Replay des noch gültigen Host-Tokens mit HTTP 401 und erneuter Bild-/Tonempfang nach regulärer Zustimmung nachgewiesen.
- Abschließend geprüfter Code-/Test-Head: `73f6baeb08116be4753799155b787f7ea937cd8a`; Battle WebRTC Check #87 und Scanner V16 Check #611 SUCCESS.
- `media_enabled=true` ausschließlich für Staging `xhmjxrcskfhbovhitdej` freigegeben. Keine Production-Freigabe, kein 50-Zuschauer-Lastnachweis.
- Vollständiger Umfang, Fehlerbehebungen, Evidenz und Grenzen: `DUELVANTA_SPECTATOR_MEDIA_MULTIDEVICE_ACCEPTANCE_2026-09-21.md`.
- Production/main/Stripe Live unverändert; main weiterhin `50f88213571be13255bb52eb489cc28cca660001`.
- Abschluss: STOP. Keine weitere BATTLE-Entwicklung beginnen. Für neue Arbeiten tatsächlichen Branch-Head prüfen; spätere Dokumentationscommits ändern den genannten geprüften Code nicht.
