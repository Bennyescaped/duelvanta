# V16.13 — bounded Ximilar integration

The existing V16 core, direct mobile route, local OCR, modes and benchmark session keys remain in place. No new paid provider requests are used to validate this change.

## Result path

A Ximilar response supplies the printed identifier, language and original provider printing ID. V16 still performs its own catalog lookup, language filtering, artwork comparison, evidence gates, rendering and benchmark recording. Provider confidence is not presented as local OCR votes. Provider identifier conflicts remain unresolved; the adapter does not guess from the expected answer.

The normal camera/gallery flow can select Ximilar only when the authenticated usage endpoint reports an active allowance. Local recognition remains the default. AI recognition is limited to single-card and continuous modes. Multi and binder scans keep their existing local path. The legacy multimodal Vision fallback remains disabled.

Ximilar proposals require a catalog-backed manual candidate confirmation before import. A provider printing ID alone does not certify the exact printing or foil finish. This is especially relevant to Nico Robin `ST29-009_P1` and Sabo `OP04-083_R2`, whose provider suffixes must not be equated blindly to another catalog's suffixes.

Saved-response replay verifies the original file SHA-256, records `provider_replay: true` in the existing local benchmark and cannot be imported, including after manual code recovery. Replay timing is not a new provider latency measurement.

## Short completion flow

After a successful import, **Next card** starts the next capture and **View card** opens the saved card summary inside the scanner. No additional COLLECT navigation is required. Tests use an in-memory collection and do not write real user data.

## Cost boundary — implemented but closed

`api/scanner-v16-recognize.js` is preview/`scanner-v16` only. Its public configuration is **disabled**. It uses the existing Supabase access token and publishable key, verifies the token with Auth, then requires a committed atomic reservation before contacting Ximilar. It never uses a privileged key or creates a second Auth client.

`database/collect-scanner-v16-quota-PROPOSAL.sql` is a reviewable proposal, **not an applied migration**. It adds two private usage tables, RLS with no direct-client table policies, narrow authenticated RPCs, a per-user row lock, allowance bounds of 1–20 attempts, and explicit expiry. Existing Auth, collection tables and policies are untouched. Because the owner previously prohibited Auth/RLS changes, applying even these new usage objects requires the owner's specific approval. No allowance has been granted.

- Exact JPEG + TCG and request UUID are deduplicated across function instances.
- Different crops/re-encodings count as new attempts, still bounded by the allowance.
- Missing allowance, expired allowance, exhausted allowance, missing RPC or accounting timeout: no paid request.
- Unknown provider/network outcome consumes the reservation. No automatic retries or refunds that could duplicate charges.
- No images or provider keys in the usage tables. Pseudonymous user IDs and image hashes remain private.
- No public subscription, Stripe, auto-renewal, graded-card addon, price addon or additional service.

## Validation scope

Sixteen Node regression suites pass locally, including all eight pilot card shapes, Pokémon denominators/language conflicts, One Piece printing IDs, exact-photo replay, benchmark integration and quota boundary failures. The quota tests model a shared atomic ledger; actual Postgres concurrency/RLS behavior still needs validation after authorized provisioning. SQL is not claimed as live-tested.

Browser E2E includes correct Pokémon/One Piece identifiers and candidates, replay import exclusion, an explicit AI selection through a mocked authenticated endpoint, manual confirmation and isolated import, provider-error recovery, and the inline saved-card view. Provider/catalog mocks do not prove new live provider recognition. Existing real-OCR and live-catalog checks remain required and unchanged.

The preceding docs-only CI Run 113 failed because of external TCGdex timeouts. Deployment and CI results for this implementation must be inspected separately; no live-catalog assertion is weakened here.
