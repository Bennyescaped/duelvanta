# V16.11 — iPhone false printing and auto-capture audit

Scope: scanner-v16 only. Preserve V16 modules, direct route, recovery, benchmark storage keys, V15.8, collect.html and main. Vision fallback remains disabled.

## Reproduced evidence

The supplied IMG_9777 screenshot shows German Retourorden, printed 074/084. IMG_9778/9779 show V16.10 reporting 074/081 and a Japanese catalog printing. This is an incorrect physical-printing result, even though the UI labels it review. The original camera frame and temporal live trace were not supplied, so its exact three OCR texts cannot be recovered retrospectively.

The regression fixture `tests/fixtures/retourorden-iphone.png` is an unaltered pixel extraction (x=102,y=642,w=503,h=635) of the photographed card and background from IMG_9777. No browser chrome, account data, generated pixels or hard-coded recognition answer. It is a screenshot crop, not the original full-resolution capture.

## Causes and targeted changes

1. The old green contour was display-only. Capture and quality sampling used the larger static guide. Patterned background inflated sharpness and reduced the effective size of the footer. Capture now uses the detected contour with a small edge margin. Green contour and crop use the same source-pixel rectangle and object-fit transform; manual capture can use a recent valid contour, with the static guide as fallback. File inputs detect the card before OCR using the same detector. Multi/Binder behavior is preserved.
2. Three large, highly contrasted OCR crops were followed by parsing their concatenated text again. This duplicated evidence without adding an independent observation. Small 4/1/8 footer errors could therefore appear certain. Narrow footer crops with gentle contrast now retain the printed digits; each independent crop contributes at most one vote per code. Conflicting or singly read codes cannot become automatic ready results.
3. Catalog-code equality was displayed as “Kartennummer bestätigt”. It only proved that the catalog agreed with the OCR string. The UI now distinguishes multiple OCR readings from unconfirmed catalog consistency and shows every voted code with its independent-pass count.
4. The language gate compared candidate languages with one another, not with text observed on the physical card. German/English require at least two distinct language-specific words. A confidently conflicting catalog language is excluded even if it is the sole candidate. An alternative denominator can only come from an actual independent OCR reading, followed by an exact catalog match in the observed language; conflicts remain review-only. No expected card name, set or denominator is hard-coded in production.
5. Auto capture required <10% guide deviation and restarted its entire 1.4-second timer for every small change in raw grayscale samples. It now accepts a complete nearby card, samples relative to its contour, removes global exposure shifts from motion measurement, and uses a bounded rolling window with 75% good samples, at least six good samples and two consecutive good samples at capture. Large motion, sustained blur, glare, absent contour and bad framing still prevent capture. There is no OCR in the live loop.
6. Review candidates show no card valuation before explicit confirmation. Their import checkbox remains disabled until the candidate is confirmed. Backgrounding Safari no longer overwrites a completed result with “camera paused”.

## Verification

Automated coverage includes conflicting 074/081 vs 074/084 votes, German text vs Japanese-only catalog hit, strict TCG propagation, exposure oscillation and hand tremor, brief contour dropout, moving/blurred/glared/absent cards, direct upload, manual recovery and benchmark counts. The browser suite runs real Tesseract on synthetic Pokémon/One Piece fixtures and the real iPhone fixture. Its canvas-video input varies position and brightness and is smaller than the guide; it must auto-capture exactly once using the detected crop.

Push CI additionally removes catalog mocks and recognizes the real iPhone fixture against public TCGdex, requiring Retourorden, 074/084, DE and me05-074. Missing reference artwork remains review-only; a no-hit or wrong Japanese printing is a test failure. Public provider availability is an external dependency, not a fabricated fallback.

Local native Tesseract verification of the production crop preparation read 074/084 in all three independent crops and detected DE. CI browser evidence is authoritative for the browser engine. Physical iPhone autofocus, frame timing and hand motion still require the final short acceptance test.

The preview has Vercel login protection in the interactive cloud browser; this audit does not change or bypass it. Browser CI exercises the same direct route, modules and actual public catalog without changing user collections or authentication.

## Browser findings on 2026-09-10

Run 72 passed synthetic Pokémon, One Piece, the real iPhone fixture and exactly one automatic capture with a smaller, moving/exposure-varying video card. Browser Tesseract read 074/084 independently in passes 0 and 2 and detected DE. Push run 71 also resolved the real public catalog to `me05-074`, Retourorden, 074/084, DE. Its initial strict console assertion exposed an external artwork error: `https://assets.tcgdex.net/de/me/me05/074/high.webp` returned duplicate `Access-Control-Allow-Origin: *, *` values, which Chromium rejects. The candidate therefore correctly remained review-only.

The live-provider test records that specific external asset diagnostic and verifies the reference-unavailable warning, disabled import and absent valuation. All other browser errors remain test failures. No CORS protection, provider response, auth setting or security header is modified. This external condition must not be misreported as a wrong number or a missing catalog card. Multi-pass recovery now preserves observed language even when the first identifier pass fails, and applies the same independent-vote and language gates as the initial recognition.

Asset format reference: [TCGdex asset documentation](https://tcgdex.dev/assets).
