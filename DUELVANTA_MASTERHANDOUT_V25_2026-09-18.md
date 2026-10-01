# DUELVANTA – Masterhandout V25

Stand: 18.09.2026. Verbindlicher technischer Checkpoint nach vollständiger Zwei-Rollen-Abnahme und geglättetem TRADE-Start.

V25 übernimmt V24 und ersetzt dessen offenen Abschlussauftrag. V24 bleibt als historische Übergabe relevant; widersprechende technische Statusangaben werden durch V25 ersetzt. Keine Produktions-, Rechts-, Steuer-, Payment- oder kommerzielle Freigabe.

## 1. Ergebnis dieses Checkpoints

**DUELVANTA TRADE = Kaufen + Verkaufen. Tausch bleibt dauerhaft aus dem Release-Scope.**

Die in V24 noch offene angemeldete Zwei-Rollen-Abnahme ist vollständig abgeschlossen. Versand- und Abholorder wurden im Browser bis zum Abschluss geführt; Abschlussbenachrichtigungen und Archivdarstellung wurden aus Käufer- und Verkäuferrolle nachgewiesen. Die anschließende rein lesende Staging-Prüfung bestätigte die finalen Zustände.

Zusätzlich wurde der von iPhone/Safari beobachtete TRADE-Lade-/Layout-Flash behoben. Statt einer schwarzen bzw. kurz unfertigen Oberfläche wird nun ein stabiler DUELVANTA-Ladezustand **„TRADE – Marktplatz wird geladen.“** gezeigt. Der Nutzer hat den neuen Start sowie die Übergänge zu Bestellungen und Archiv praktisch bestätigt: keine sichtbare Überlagerung mehr, Ladebildschirm funktioniert einwandfrei.

## 2. Verbindlicher Repository- und Deployment-Stand

| Gegenstand | Stand |
|---|---|
| Repository | `Bennyescaped/duelvanta` |
| Einziger Arbeitsbranch | `marketplace-ux-v1` |
| Funktionaler Checkpoint | `de7428dc896f82b1e4bacad750e0601eaa5f1834` |
| Unverändertes `main` | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | offen, Draft, nicht gemergt |
| CI | Scanner V16 Check #518 / Run `35309544310`: `validate` SUCCESS, `quota_database` SUCCESS |
| Preview-Deployment | `dpl_hDSDBmAXUAyVG6jcrweYwrYUA26N` |
| Preview | https://duelvantav5vision-2vg8h0cmg-bennyescaped-3783.vercel.app |
| Preview-Zustand | READY, kein Production-Target |
| Supabase-Staging | `xhmjxrcskfhbovhitdej` / DUELVANTA-STAGING |
| Production-Supabase – nicht verändern | `enifiaqsnqtbzylnfrpi` |

Vercel-Projekt: `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd`; Team: `team_VHCwSwfBWANJvmS3qdkpJ0dK`.

## 3. Vollständig bestandene Zwei-Rollen-Abnahme

### Versandorder

`DV-260917-000009` / `60085d9b-b744-45d2-91b2-6df3f3dc9649`

- Käufer bestätigte **„ERHALTEN – ALLES IN ORDNUNG“**.
- Order verschwand nach Reload aus „Aktion erforderlich“.
- Käufer-Archiv: `KAUF / COMPLETED`, 1 Artikel, 2,08 EUR, Versand, Abschluss 17.09.2026 21:44.
- Verkäufer-Benachrichtigung: **ERHALT BESTÄTIGT – DV-260917-000009 wurde vom Käufer abgeschlossen.**
- Verkäufer-Archiv: `VERKAUF / COMPLETED`, 1 Artikel, 2,08 EUR, Versand.
- Listing steht auf `SOLD`.
- Es gab keinen realen Versand; Versanddienst/Tracking waren ausschließlich synthetische Staging-Daten.

### Abholorder

`DV-260917-000010` / `0cc409fd-5382-4e4c-911d-fe6bd88a210d`

- Verkäufer erzeugte regulär einen neuen einmaligen Übergabecode.
- Käufer bestätigte den Code.
- Übergabecode wurde einmalig verbraucht; Staging-Nachweis: `attempt_count=1`, `buyer_confirmed_at=consumed_at`.
- Käufer-Archiv: `KAUF / COMPLETED`, 3 Artikel, 6,50 EUR, Abholung, Abschluss 17.09.2026 22:02.
- Verkäufer-Benachrichtigung: **ERHALT BESTÄTIGT – DV-260917-000010 wurde vom Käufer abgeschlossen.**
- Verkäufer-Archiv: `VERKAUF / COMPLETED`, 3 Artikel, 6,50 EUR, Abholung.
- Drei zugehörige Listings stehen auf `SOLD`.
- Technischer Abschlussgrund: `pickup_bilateral_handover`.

Damit ist der offene Abschnitt 7 aus V24 vollständig erledigt.

## 4. Staging-Datenbank – Abschlusskonsistenz

Bei der abschließenden lesenden Prüfung wurde ein enger Staging-Drift gefunden: `DV-260917-000009` war bereits `completed`, lief aber beim Abschluss noch über eine ältere Staging-Version von `confirm_market_order_received`, sodass B07-Felder `buyer_received_ok_at`, `technical_completed_at` und `technical_completion_reason` fehlten.

Korrektur ausschließlich in Staging:

- vorhandene aktuelle B07-Funktion aus dem Branch wieder aktiviert;
- bereits vorhandenes Abschlussereignis von `000009` konsistent nachgezogen;
- keine Order neu abgeschlossen und kein Browsernachweis durch SQL ersetzt.

Finaler Zustand:

| Order | status | technical_completion_reason | Deals | offene Deals | SOLD-Listings | Abschlussmeldung |
|---|---|---|---:|---:|---:|---:|
| DV-260917-000009 | completed | buyer_received_ok | 1 | 0 | 1 | 1 |
| DV-260917-000010 | completed | pickup_bilateral_handover | 3 | 0 | 3 | 1 |

## 5. Tausch-Stilllegung – unverändert bestätigt

Tausch wurde nicht nur visuell überlagert.

- `trade-c2c-swap.js` und `trade-listing-type-rules.js` werden im aktiven TRADE-Runtime-Stack nicht geladen.
- Single/Graded und Sealed bieten nur Verkauf.
- Neue Tauschvorgänge sind serverseitig gesperrt.
- Historische Swap-Daten, Tabellen, Module und Migrationen bleiben aus Nachweis-/Historiengründen erhalten.
- Aktuelles Staging: 6 historische `trade`-Listings, 0 `sale_or_trade`; **0 aktive/reservierte/pausierte retired Listings**.
- Historische Tauschdaten sind damit kein Teil der aktiven Marktplatzoberfläche und waren nicht Ursache des Ladeeffekts.

Die bereits in V23/V24 dokumentierten Staging-Sperren bleiben maßgeblich. Nicht erneut implementieren und historische Daten nicht vorsorglich löschen.

## 6. TRADE-Start / Lade-UX

Befund: Durch den modularen TRADE-Stack wurde die Oberfläche während der Initialisierung kurz unfertig bzw. nach dem ersten Fix vollständig schwarz angezeigt.

Gezielte Korrektur:

- stabiler Lade-Shell direkt in `trade.html`;
- Text **„TRADE – Marktplatz wird geladen.“** statt leerer schwarzer Fläche;
- aktive Marktoberfläche bleibt bis zur Kern-Initialisierung ausgeblendet;
- Runtime-Skripte werden parallel angefordert, behalten aber ihre definierte Ausführungsreihenfolge;
- vor Freigabe werden Marketplace-UX und aktive Archivfilter synchronisiert;
- Release-Gate für Production bleibt unverändert wirksam;
- normale Production-Nutzer laden weiterhin keinen vollständigen TRADE-Stack, sondern sehen **COMING SOON 2027**;
- Owner-Bypass bleibt erhalten.

Geänderte Kernbereiche dieses Fixes:
- `trade.html`
- `trade-release-gate.css`
- `trade-release-gate.js`
- `tests/trade-release-gate-test.mjs`
- `tests/trade-marketplace-ux-contract-test.mjs`

Nutzerabnahme auf iPhone/Safari: Ladebildschirm und Übergänge funktionieren einwandfrei.

## 7. Unveränderte Schutzgrenzen

- ausschließlich `marketplace-ux-v1`;
- `main` und Produktion nicht verändern;
- PR #5 nicht mergen;
- Production-Supabase nicht verändern;
- Stripe Live nicht aktivieren;
- keine echten Payments, Refunds oder Payouts;
- TRADE Production-Lock **COMING SOON 2027** erhalten;
- COLLECT, BATTLE, Scanner, Logo, Slogan und globale Navigation nicht ungefragt ändern;
- historische Tausch-Infrastruktur nicht löschen;
- Kategorie C bleibt extern offen; technische Abnahme ist keine rechtliche oder steuerliche Freigabe.

## 8. Weiterarbeit ab V25

1. V25 ist der neue technische Übergabestand.
2. Zwei-Rollen-Abschlussprüfung nicht erneut durchführen, solange kein neuer reproduzierbarer Befund vorliegt.
3. Tausch-Stilllegung nicht erneut implementieren.
4. TRADE-Lade-UX ist praktisch bestätigt; nicht weiter umbauen, solange kein neuer UI-Befund vorliegt.
5. Vor jeder neuen Änderung Branch/PR/Preview nur lesend abgleichen und ausschließlich auf `marketplace-ux-v1` arbeiten.
6. Nächste Arbeit gezielt am nächsten noch offenen DUELVANTA-Entwicklungs- oder Abnahmepunkt fortsetzen; bereits geschlossene B07-Bereiche nicht vorsorglich wieder öffnen.

## 9. Herkunft

V25 konsolidiert:
- `DUELVANTA_MASTERHANDOUT_V24_2026-09-17.md`;
- die am 17./18.09.2026 gemeinsam per Screenshot durchgeführte Zwei-Rollen-Browserabnahme;
- den anschließenden lesenden Staging-Datenbanknachweis;
- den bestätigten TRADE-Lade-UX-Fix bis Commit `de7428dc896f82b1e4bacad750e0601eaa5f1834`.

Keine Zugangsdaten oder Übergabecodes sind Bestandteil dieses Dokuments.
