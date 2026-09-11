# OpenAI comparison pilot — 11 September 2026

This preview-only decision pilot compares OpenAI image recognition with the completed Ximilar baseline before any product integration decision. It does not alter Scanner V15.8, the normal V16 scanner flow, collection imports, Auth/RLS, or production.

The route `scanner-v16-ai-pilot.html?provider=openai` calls `/api/scanner-v16-openai`. The server uses `gpt-5.4-mini` through the Responses API with one image and a strict JSON schema. The request asks for the printed card identifier, name, language, set, rarity, printing, and visible grading-label fields. Results remain proposals: no catalog, certificate, authenticity, market value, or new grade is claimed.

## Boundaries

- Preview deployment and `scanner-v16` branch only.
- Exactly ten SHA-256-bound photographs: one second-angle image for each of the eight known cards, one PSA Sanji slab, and one RGS Flareon slab.
- Short-lived Ed25519 grants expire after four hours. The signing private key is never stored.
- Private photos and the signed upload bundle remain outside Git.
- One request per selected photo in the runner. The attempt is saved before transmission, errors stop the run, and no automatic retry is made.
- In-flight and completed calls coalesce per warm function instance. This is an additional duplicate guard, not a durable global billing ledger.
- `OPENAI_API_KEY` remains a Vercel Preview secret. Browser code never receives it.
- Responses use `store:false`. Only compact observations, timing, token usage, and calculated model cost are returned.
- The model cannot import cards. The pilot page has no Supabase client or Collection write path.

The test reports actual input, output, reasoning, and total token counts returned by OpenAI. Estimated USD cost uses the documented standard `gpt-5.4-mini` token rates encoded in the provider module. Final results must record the observed totals rather than relying on pre-run estimates.
