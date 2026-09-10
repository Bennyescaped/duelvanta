# Ximilar comparison pilot — 10 September 2026

The owner supplied a server-only `XIMILAR_API_TOKEN` in the `scanner-v16` Preview. A token's presence does not prove Collectibles access. The first signed photo request tests that access; the runner stops on any service error without retries or subscription changes.

The existing private Gemini runner now also supports `scanner-v16-ai-pilot.html?provider=ximilar`. Provider selection is a fixed allowlist with separate browser storage and provider-bound signed tickets. The closed Gemini configuration stays closed. Neither pilot is loaded by the normal scanner; Vision remains disabled and no results are imported.

## Protocol frozen before the first real response

- Endpoint: `https://api.ximilar.com/collectibles/v2/tcg_id`, token header, no redirects.
- Same 16 original JPEGs as Gemini: eight user cards, two angles, no sleeves. No crops, enhancement, expected identifiers, names, language or variant hints sent.
- One image per call; only the selected TCG (`Pokemon` / `One Piece`) is supplied.
- `lang:true`, `rotate:true`; `analyze_all`, `slab_id`, `slab_grade`, `price_stats` all false.
- Preview and branch guards, exact image SHA-256, short-lived Ed25519 grants, 16-photo allowlist. Private bundle never committed; no signing private key persisted.
- One sequential attempt per photo; persisted before submission, stop on error, in-flight/result/error cache. As with Gemini, the instance cache is **not a durable global quota**. This is a private limited evaluation, not a production billing system.
- 45-second upstream deadline, 60-second function limit; sanitized provider evidence retained with echoed image payloads/tokens removed. Missing credit metadata is null, never zero.
- Preserve candidate details, alternatives, distances, OCR language and finish separately. Distances/detection probabilities are not treated as calibrated match confidence. Every result remains an unverified, non-importable proposal.

Score identifier, language, set and printing evidence independently. Exact printing ground truth is not fully confirmed for every card, especially Sabo. The 16 photos are a small previously exposed development set; they cannot establish worldwide accuracy, graded-card support or performance under sleeve glare.

## Verification

`node tests/scanner-v16-ximilar-test.mjs` checks signed provider separation, branch/expiry/key guards, exact originals, no answer hints, optional-cost features off, language and candidate parsing, credit metadata, repeated failure suppression and redaction. Existing Gemini tests must continue to pass when its transport guard is reused.

Prepare private grants with the existing tool's final `ximilar` argument:

`node benchmark/scanner-pilot/prepare-gemini-pilot.mjs PRIVATE_MANIFEST PHOTOS_DIR PRIVATE_BUNDLE benchmark/scanner-pilot/ximilar-pilot-public.json ximilar`

Close `ximilar-pilot-public.json` (`enabled:false`) after the run or an access failure. Preserve existing benchmark sessions and Gemini evidence.

Official protocol and account-access requirements: https://docs.ximilar.com/collectibles/recognition

After the owner explicitly confirmed checking the token, a fresh `token-check-2` run was authorized. The prepare command now accepts an optional final run suffix; it preserves the original dataset and failed attempt. Recognition settings remain frozen. Error responses expose only a fixed diagnostic category (invalid token, missing credentials, account/service access, permission denied, unspecified), never provider error text or the token.
