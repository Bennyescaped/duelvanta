# Ximilar access check — blocked, 10 September 2026

**No recognition comparison is available yet.** The server-only token was present in the correct branch Preview, but Ximilar rejected the first real request with HTTP 401.

| Measurement | Observed |
|---|---|
| Tested commit | `b8e585a098604a931e51f597542c2e441d40484c` |
| Endpoint | `/collectibles/v2/tcg_id` |
| Authentication | Official `Authorization: Token …` header; secret never exposed |
| Request | P01-A, original Retourorden photo, 2026-09-10 17:09:53 UTC |
| Attempts | 1; no retries, no subsequent photos |
| Response | Upstream HTTP 401; sanitized `provider_http_401` |
| Recognition results | 0; no identifier/language/variant scores possible |
| Credits | Unknown; no usage metadata returned, billing not inspected |
| Verification | PR CI Run 102 successful; Vercel Ready; browser loaded all 16 grants and stopped after the first failed call |

The first response proves the configured value was not accepted for this request. It does **not** establish whether the cause is a copied/revoked token, an account issue or missing service entitlement. The provider error body was intentionally not logged or displayed. A key's presence must not be reported as successful authentication.

The temporary Ximilar pilot is closed again (`enabled:false`). The runner also blocks restarting a failed bundle so another click cannot move on to other billable photos. Existing Gemini and local scanner benchmark evidence is retained. Normal scanner Vision remains off; no imports, Auth/RLS changes or production changes.

Next owner action: check that the value of `XIMILAR_API_TOKEN` is the original API token for the intended Ximilar account, with no `Token ` prefix or surrounding quotation marks, scoped to Preview / `scanner-v16`. After correction, issue a fresh bounded test grant and verify Collectibles access once. A generic API token does not by itself establish Collectibles trial access; [Ximilar documents the access requirement](https://docs.ximilar.com/collectibles/recognition).

Gemini's already measured 16/16 identifiers and languages remain unchanged. Do not claim Ximilar is better or worse based on this authentication failure.
