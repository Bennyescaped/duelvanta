# Ximilar Business 100K — historical checkpoint, export recovered

**Resolved:** after explicit owner approval, the page was reopened and all 16 complete responses recovered without another provider request. Identifiers and languages match on 16/16; median 2,753 ms. Both Nico Robin results retain `ST29-009_P1`. The pilot is closed. See the [completed comparison](XIMILAR-GEMINI-COMPARISON-2026-09-10.md). The checkpoint below records what was known before recovery.

The owner purchased Business 100K and replaced the API token. A fresh Preview at `06ca141d38d50314e6c4cbe2871c4f5f040254a3` successfully authenticated and recognized real original photographs starting 17:39:37 UTC. The earlier invalid-token failures remain historical evidence, not the current access status.

## Verified progress before browser access was blocked

- Fourteen successful responses were observed: both angles of Retourorden, Rameidon ex, Moruda, Memmeon, Ganzui, OP17-019 Event and Sabo. Their identifiers and languages are present and consistent with user metadata, after the response-field mapping below.
- Last visible status was photo 15/16 (Nico Robin angle A) in progress. Final Nico Robin results and completion of all 16 are **not yet verified**.
- The first four full responses were exported successfully; they have matching identifiers/languages, median 2,796.5 ms (2,375–2,928 ms). Later visible examples include Sabo at 3,141 and 2,574 ms. Do not report this partial median as the complete 16-photo result.
- No numeric credit metadata appeared in the inspected responses. The published TCG identification rate is 10 credits/card; 160 credits would be the nominal estimate for 16 successful single-card identifications, not a measured account debit. No pricing, slab, grading or analyze-all add-ons were enabled. [Official pricing](https://www.ximilar.com/pricing/)
- OP17-019 consistently maps to The World's Strongest Warriors, unlike the earlier Gemini set/variant errors. Sabo consistently returns provider printing ID `OP04-083_R2`, The Best vol.2; its artwork visually agrees with the separately cached OPTCG PRB02 reprint reference (`OP04-083_r3` in that catalog's namespace). Exact cross-provider printing identifiers, marketplace links and finish still need validation.
- Existing Gemini observations remain intact. No further Gemini requests or collection imports.

## Response mapping repaired without resending photographs

The first adapter read only `card_number`. Ximilar puts One Piece's full identifier in `card_id` while `card_number` contains only e.g. `043`. The adapter now reads the full ID, or combines an explicit set-code prefix with its numeric part. Printing suffixes remain preserved in the original candidate.

For Japanese Memmeon, the candidate lacks `out_of`, but Ximilar's own OCR explicitly reads `021/063` in both images. The adapter fills a missing denominator only from one unambiguous OCR identifier with a matching candidate numerator. OCR/catalog disagreements remain `identifier_conflict`; conflicting denominators never become successful scores.

The offline scorer reparses retained raw responses without another provider call and keeps candidate details, OCR codes, language, finish and printing evidence separate. This is a deterministic response-shape fix after inspecting the API payload, not a provider/model retest. No expected card codes are sent to the provider or parser. A correct identifier/language remains distinct from an independently verified exact printing.

## Verification and current limitation

Tested live commit: CI Run 110 and Vercel successful. Regression tests cover split One Piece identifiers through the signed API handler, missing Pokemon denominators, OCR disagreement, reprint suffix preservation, provider error redaction, repeat protection and offline scoring.

Automatic browser approval review blocked the final read/export, stating that navigation could interrupt the active comparison. A narrower read-only DOM snapshot was also rejected with the same navigation concern. No alternate browser surface, raw protocol or indirect workaround was used. The test configuration is closed again and the available checkpoint is preserved. The complete comparison requires authorized reopening of the test page to recover its previously saved browser results. Do not resend photos to recreate the export.
