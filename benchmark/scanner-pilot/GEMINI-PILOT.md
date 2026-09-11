# Gemini comparison pilot

Prepared on 2026-09-10, on top of scanner-v16 `8481172`. The user authorized a Gemini comparison after creating an AI Studio test key. Ximilar trial access is still pending. This supersedes the earlier pilot's prohibition on an external comparison; it does not enable the normal scanner fallback or a paid public product.

The real sixteen-photo run is complete: [results, costs and limitations](GEMINI-RESULTS-2026-09-10.md). The temporary signed pilot is closed again. No further requests are authorized by its public configuration.

The separate `scanner-v16-ai-pilot.html` page calls `/api/scanner-v16-gemini`. `scanner-v16-vision.js`, capture, recognition, collection imports, existing local benchmark sessions and V15.8 remain unchanged. No new Supabase client, database table, Auth/RLS change or service-role credential is used.

## Scope and access

- Runtime requires both `VERCEL_ENV=preview` and `VERCEL_GIT_COMMIT_REF=scanner-v16`.
- The Gemini key is read only on the server from `GEMINI_API_KEY`. GET reveals only whether a nonempty key is configured, not validity or quota. No key, upstream error body, authorization header or image is logged.
- POST requires an Ed25519 signature binding the original photo hash, TCG, fixed model, dataset and expiry. The public config contains only the verification key and sixteen SHA-256 hashes with TCGs. It contains no private key, usable test tickets, source photos, filenames, card names or ground truth.
- Private tickets expire two hours after preparation. The signing key is never saved. The private upload bundle must remain outside Git. `prepare-gemini-pilot.mjs` refuses a changed or incomplete set and refuses overwriting an existing bundle.
- Requests accept JPEG bytes, at most 1.6 MB, only for those signed photos. No arbitrary prompts, model selection, remote image URLs, tools, search or reference hints.
- One fixed prompt, model `gemini-3.5-flash-lite`, one output candidate, minimal thinking, at most 1,600 output tokens and a 45-second provider timeout. These settings are frozen before any provider response is inspected.
- Browser runs sequentially, waits 15 seconds between requests, records each attempt before sending and stops on a provider/network error. It never automatically retries an uncertain or failed attempt. Reloads resume only unattempted photos in the same browser.
- Server caches in-flight/completed/error responses within one instance. **This is not a durable global spending cap:** cold starts, concurrent instances or another browser can replay an unexpired signed grant. Only the private evaluator holds grants; this short-lived pilot must not be distributed as a public service. A subscription scanner needs durable per-user accounting and idempotency before rollout. No billing or subscription configuration is changed here.

## What counts as evidence

All provider outputs remain `importable:false`, `catalogVerified:false`. Model confidence is explicitly a self-assessment. Exact code, selected/inferred TCG, language, variant uncertainty, actual token usage (including thinking), provider model version, duration and raw response are recorded. Names and variants must be checked against independently verified catalogs after inference. A syntactically valid code is not a catalog match. Errors, null identifiers and truncated/invalid JSON are not recognition successes.

The existing sixteen original photos (eight physical cards, two angles without sleeves) are used unchanged. Ground truth stays in the private manifest and is not sent to Gemini. Existing development/holdout labels remain recorded; these cards have already informed earlier development and are not a fresh unseen holdout. No claim about worldwide accuracy, sleeves, foil robustness or slab recognition follows from this set. Ximilar superiority has not been measured.

## Verification

`node tests/scanner-v16-gemini-test.mjs` exercises branch/production guards, missing key, expiry, invalid signature, changed photo, answer-hint rejection, request coalescing, failure replay protection, provider timeout/truncation, token measurement, correct Pokémon/One Piece result propagation and import exclusion. All existing V16 contract tests and the original pilot scorer also run without any provider call. CI includes the new test.

Vercel deployment, real API availability and actual recognition results are separate gates. A green unit test or a `configured:true` status is not evidence of successful Gemini recognition. Runtime results are kept privately, with a public summary only after a real attempt.

Sources: [Gemini model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [image input](https://ai.google.dev/gemini-api/docs/image-understanding), [Vercel variables](https://vercel.com/docs/environment-variables).
