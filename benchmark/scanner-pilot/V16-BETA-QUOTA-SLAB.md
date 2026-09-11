# V16.15 — beta quota and existing graded slabs

Only scanner-v16 / Draft PR1. Main, V15.8, collect.html, existing Auth/collection policies and logo unchanged.

## Deployed ledger (2026-09-10)

`database/collect-scanner-v16-weekly-quota.sql` was applied using Supabase migration `scanner_v16_weekly_quota`. Replaces the obsolete PROPOSAL. Separate private RLS tables, no direct client table privileges, authenticated caller-only RPCs. Public functions are invokers; narrow private definers use an empty search_path and verified JWT user identity. Anonymous sign-ins rejected. No service_role or second Auth client.

- 20 raw + 5 slab attempts/user/week, Europe/Berlin Monday 00:00 including DST.
- Limits can be reduced centrally in scan_policy without deployment; existing usage is retained.
- Every paid request reserves 10 raw / 15 slab credits atomically before calling Ximilar.
- Shared policy/period row locks serialize parallel reservations, across users and cold starts.
- Same request ID cannot charge twice; same photo/TCG/kind is deduplicated within a billing period.
- Global explicit billing-period cap <=100,000, including prior consumption. No automatic renewal/top-up.
- Failed/unknown paid outcomes remain reserved; no automatic retry/refund.
- 15 beta users at maximum allowance: 4,125 credits/week.

The API route is enabled **but the database policy remains disabled and no billing period is installed**. Thus no paid request can run until the verified account period and already-spent credits are entered. Do not guess the renewal date or count the earlier pilot as the account's entire usage. Other manual/account API use must also be deducted/reconciled; the ledger cannot control calls made outside DUELVANTA.

Owner/operator activation requires the actual Ximilar period start/end and current consumed credits. Insert one active credit_period with those facts and credit_limit=100000, then enable scan_policy. At renewal deactivate the old period and explicitly add the verified new one; do not reset weekly_usage. Routine limit reductions only update raw_weekly_limit/slab_weekly_limit (0..20 / 0..5). Never grant users access to these tables.

## Slab recognition

Uses exactly one `/collectibles/v2/slab_id` request with one image record. It does NOT combine tcg_id+slab_id (which would cost more), call AI grading, price_stats, analyze_all, or certificate verification.

The full holder and label are captured. The provider's bounded card rectangle supplies the local V16 OCR/catalog/artwork pipeline. Label language is not assumed to be card language; a label's bare card number is not invented into a Pokemon denominator. Weak card OCR can still require manual code recovery. This is a deliberate 15-credit hybrid, not a promise that slab_id performs full visual card identification.

Before import both the independent catalog candidate and the label fields require confirmation. Leading zeros in certificate numbers are preserved. Existing collection columns receive grading_company/grade/cert_number. BECKETT maps to BGS; other supported firms map to existing OTHER while the actual firm is preserved in notes. The legacy mandatory raw condition uses the existing NM default; notes explicitly say raw condition was not assessed, and graded collection display uses company/grade. No raw market price is stored/shown as a graded valuation. The saved photograph retains the complete holder.

No real physical slab was supplied yet: parser, geometry, OCR, confirmation and import are tested with a clearly synthetic fixture. Physical slab accuracy remains an acceptance test, not a claimed result.

## Verification

- Actual PostgreSQL transaction assertions executed successfully, then rolled back: 20 raw, separate 5 slab, duplicate, cross-user isolation, reduced limits, weekly rollover, global exhaustion, period expiry, anonymous denial and DST.
- Post-test: zero reservation rows, policy disabled.
- Same SQL regression runs automatically in a disposable PostgreSQL17 CI service.
- New slab suite verifies the dedicated request, bounded crop, missing/conflicting label handling, certificate strings and collection constraints.
- Browser regression: synthetic whole-holder upload → mocked label response → actual Tesseract card OCR → correct 074/084 DE candidate → separate label/card confirmation → isolated graded import with corrected certificate and null market value.
- Existing real-photo and live-catalog recognition tests remain enabled. No paid provider calls or real collection writes for these tests.
- Supabase advisors: new private tables intentionally have RLS and no direct policies (INFO); no new public definer functions. Pre-existing unrelated findings were not modified.

## Still separate work

AI multi/binder segmentation and interactive binder drag/drop are not implemented by this change. Existing local multi/binder modes remain. A slab is one holder per capture; auto-capture disabled for slab until physically validated. Manual shutter/gallery remain available.

Official provider contract: https://docs.ximilar.com/collectibles/recognition
