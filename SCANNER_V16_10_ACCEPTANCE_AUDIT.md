# Scanner V16.10 — second mobile acceptance audit

Scope: incremental changes on `scanner-v16`, based on remote head
`117a075f3c94df597fc01beab252830214f3a9f1`. No main, V15.8, collect.html,
auth/RLS, database schema or logo changes. No paid or AI provider added.

## What the screenshots prove, and the exact reproducible defects

The Pokémon result retains `id.code = "074/084"` and quality 96. OCR text
therefore existed; the screenshot alone does not prove a correct catalog
entry was returned or that identifier voting was independently reliable.

1. `scanner-v16-host.js` formerly compared `String(card.set.cardCount.official)`
   and `String(total)` directly to `id.den`. Numeric 84 becomes `"84"`, which
   is unequal to the OCR denominator `"084"`. Even the correct detail record
   was discarded. The new regression supplies an actual-shaped detail with
   numeric count 84 and proves Retourorden 074/084 survives the entire bridge.
2. The old `cards?localId=74` query was a **contains** filter, not equality.
   Only the first 18 rows were fetched, before checking the denominator. An
   unrelated 174 or an older set could consume the limit and hide the target.
   See the provider's [filtering documentation](https://tcgdex.dev/rest/filtering-sorting-pagination).
   The new adapter resolves sets by numeric official/total count first, then
   exact numeric localId. Detail requests have bounded concurrency and a
   timeout. All configured languages are retained for evidence/ranking.
3. Recovery retried whenever `best` was absent, conflating identifier and
   catalog failure. A failed retry retained the original id but marked
   `recovery.success=false`; the advice panel rendered that as “OCR without
   a safe code.” Result and default advice also assumed bad OCR/image. These
   are now separate identifier, catalog and image-quality states.

This establishes the rejection bug without claiming that the live provider
currently contains this particular 2026 printing. Public TCGdex availability
could not be independently verified in this session. A missing provider
record is now a visible catalog miss, never a fabricated match.

For One Piece the screenshot does not expose the active TCG or a readable
printed code, so a single historic cause cannot honestly be proven. Two
concrete propagation hazards were removed: asynchronous global-TCG swapping
around lookups, and Guided Benchmark setting only the visible dropdown
(opening the scanner then restored the old global mode). The adapter also
uses OPTCG's `card_set_id` for identity, rather than conflating it with an
artwork/record identifier. The [provider](https://optcgapi.com/) describes its
catalog as English-release data; candidates remain labelled EN.

## Retained core and repaired boundaries

The existing V16 OCR normalization, artwork scoring, variant/language/foil
gates, perspective correction, Multi AUTO, Binder slots, duplicate guard,
Explain and Guided Benchmark modules remain. The direct top-level route
and separate native/gallery inputs introduced in V16.9 remain.

- `scanner-v16-catalog.js`: explicit per-call TCG, numeric Pokémon set
  resolution, exact One Piece codes, source identity and lookup diagnostics.
- `scanner-v16-ocr.js`: one reusable serialized Tesseract worker with a
  per-pass timeout; live frames never enter OCR. Existing multi-pass crops
  and parsers are used unchanged.
- `scanner-v16-recovery.js`: validate user code; re-analyze the retained crop
  with an identifier override (no new photo/OCR); rerun artwork and evidence.
  Only a matching verified catalog candidate can be manually confirmed or
  selected for import. An unknown/no-hit row remains disabled.
- Loader waits for each analysis wrapper to install before declaring ready,
  preserving a deterministic quality → geometry → resilience → benchmark →
  explain chain. Existing one-owner runtime and bind-once guards stay intact.
- Market enrichment marks empty responses as completed, preventing the
  previously unbounded `enrich(null) → paint → enrich(cached null)` loop.

Every result shows TCG, observed identifier and one of:
`image_quality_failure`, `identifier_failure`, `catalog_no_match`,
`variant_ambiguity`, `language_ambiguity`, `artwork_ambiguity`, or `matched`.

## Exact capture geometry and live pre-stage

`scanner-v16-live.js` computes the rendered video content rectangle from
intrinsic video dimensions, element bounds and object-fit contain/cover.
Object-position is explicitly centered. The 63:88 guide is fitted inside
the visible content. Its inverse transform is the camera's source crop;
prepared live frames bypass the core's second center crop. Letterboxing,
portrait/landscape layout and video resize use the same transform. Multi and
Binder guides use the actual core region coordinates.

At approximately 4.5 Hz a 280-pixel-wide analysis canvas measures four
supported contour edges, alignment, grayscale motion, sharpness, brightness
and strong white clipping/glare. Six stable samples and at least 1.4 seconds
of continuous good capture conditions arm exactly one full-quality frame.
Status and detected contour are visible; manual LIVE AUFNEHMEN remains.
Auto-capture is deliberately restricted to single/continuous modes;
Multi/Binder remain manual. Continuous retains its queue and duplicate guard;
restart Live for the next card. This is a conservative geometric detector,
not a learned card detector: low-contrast, tilted, sleeved or strongly lit
cards can need manual capture. Native iPhone-Foto remains the fallback.

Late camera permission responses are invalidated and their tracks stopped.
Leaving the page stops live capture; returning requires an explicit restart.

## Benchmark and test evidence

Existing localStorage keys and sessions are preserved. New telemetry adds
TCG, identifier source, catalog-match presence and failure category. A read
number without a catalog candidate can no longer suggest a correct verdict.

All eleven local V16 contract/regression test scripts pass. The new acceptance
suite executes numeric 074/084 resolution through the core, One Piece mode
propagation, no-catalog guidance, inverse geometry, contour/stability gating,
single-capture latching, no-photo manual recovery and import rejection.

The browser suite now uses **real Tesseract pixel OCR** and uploaded SVG
fixtures, not the old avatar plus hardcoded OCR/catalog answers. Only public
catalog HTTP responses are isolated with recorded-shape synthetic fixtures;
the production catalog adapter, voting, ranking, artwork/evidence and UI run.
It asserts exact identifier AND named verified candidate for both TCGs,
persists Ground Truth/results, checks TCG through Benchmark reopen, manual
recovery, single-run event counts, invalid-file recovery and mobile overflow.
Known-fixture “Kein sicherer Treffer” explicitly fails. It does not certify
real-card artwork accuracy or current provider completeness.

The interactive browser runtime reported `Browser is not available: 1` in
this session. No manual Safari/device test has been claimed. GitHub CI is
the configured Chromium execution environment; its run status must be
checked before requesting another iPhone acceptance test.

## iPhone acceptance (only after green CI and preview)

Open the branch preview at `/scanner-v16.html`, not a Vercel dashboard URL.
Choose Pokémon, align Retourorden and wait for auto-capture (manual fallback
if needed). Check 074/084 and the catalog result; try correcting the number
without another photo. Then choose One Piece, scan the same physical card,
and confirm `TCG: One Piece · one_piece` in the result. Record both in Guided
Benchmark. Do not import test records into a real collection.
