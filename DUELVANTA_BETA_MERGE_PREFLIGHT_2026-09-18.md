# DUELVANTA – Beta Merge Preflight 2026-09-18

Status: **CODE-MERGE SIMULATION PASS / PRODUCTION-DATA GATE OPEN**

Repository: `Bennyescaped/duelvanta`  
Base: `main@50f88213571be13255bb52eb489cc28cca660001`  
Head: `marketplace-ux-v1@39385df67cb5ad130c0ed6b41d13fd2cbb0228ae`  
PR: #5, Draft, nicht gemergt.

## Merge-Simulation

GitHub erzeugte den synthetischen PR-Mergecommit:

`4f19abdee3e8f23b59d33781bb7442062e961722`

Eltern:
1. `50f88213571be13255bb52eb489cc28cca660001` (main)
2. `39385df67cb5ad130c0ed6b41d13fd2cbb0228ae` (marketplace-ux-v1)

Tree des synthetischen Mergecommits:
`5b046446bb4c1c6f3bc3a07c51c5b51ff5c312fa`

Tree des Branch-Heads:
`5b046446bb4c1c6f3bc3a07c51c5b51ff5c312fa`

Damit verändert die Merge-Simulation den Branch-Inhalt nicht. PR #5 ist mergeable, Branch ist 366 Commits vor main und 0 Commits dahinter.

GitHub Actions Run #522 / `35310511305` checkte ausdrücklich `refs/pull/5/merge` auf dem synthetischen Mergecommit aus und lief vollständig grün:
- validate: SUCCESS
- quota_database: SUCCESS
- Battle/Profile Boundaries: SUCCESS
- TRADE Contracts/Mobile Order Flow: SUCCESS
- COLLECT Scanner/Binder E2E: SUCCESS
- Mobile Browser Upload E2E: SUCCESS
- Browser Evidence: SUCCESS
- Production-TRADE-Hard-Lock Regression: SUCCESS

## Production-State Preflight – nur lesend

Production-Supabase wurde nicht verändert.

Aktueller nichtterminaler Marketplace-Bestand:
- 2 offene Orders
- 2 offene Deals
- 1 reserviertes Listing
- 3 angenommene/offene Offers

Offene Orders:
- `DV-260910-000006`: open, Versand, 18,00 EUR, manual_beta, Verkäufer Owner
- `DV-260917-000007`: open, Versand, 78,00 EUR, manual_beta, Verkäufer Owner

Die Käuferkonten dieser beiden Orders sind keine explizit benannten `test-*@duelvanta.de`-Konten. Deshalb dürfen diese Vorgänge nicht ohne Nutzerbestätigung als synthetische Testdaten behandelt oder verändert werden.

## Konsequenz

Der Code ist gegen main konfliktfrei und vollständig grün merge-simuliert. Ein tatsächlicher Beta-Merge bleibt jedoch blockiert, solange die bestehenden Production-Marketplace-Vorgänge nicht fachlich geklärt sind: Der neue Production-TRADE-Lock würde normale Nutzer aus der TRADE-Oberfläche aussperren.

Kein Merge, keine Production-Migration und keine Datenänderung wurde durchgeführt.
