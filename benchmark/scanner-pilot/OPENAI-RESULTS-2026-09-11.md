# OpenAI image pilot results — 11 September 2026

The fixed ten-photo `gpt-5.4-mini` pilot completed without provider errors or retries. The pilot was closed immediately afterward. No result was imported into COLLECT.

## Measured run

- 10/10 requests completed.
- 26,793 total API tokens reported by OpenAI.
- $0.03083475 calculated model cost for the complete run, or $0.00308348 per photo on average, using the configured standard token rates.
- 3,059 ms median provider time.
- 9/10 identifiers passed the strict DUELVANTA format gate.
- The remaining result contained the correct `045/084` number but added `PBL DE` before it; the validator correctly returned `identifier_failure`.
- All ten cards had the correct underlying card identity and language.

## Raw cards

| Photo | Expected | OpenAI | Language | Printing / rarity observation |
|---|---|---|---|---|
| P01-B | Retourorden `074/084` | Correct | German | Normal / no variant |
| P02-B | Rameidon ex `045/084` | Correct number embedded, strict format failed | German | `★★`, additional `holo` wording |
| P03-B | Moruda `091/084` | Correct | German | Illustration/full-art detected, rarity called Secret Rare |
| P04-B | メッソン `021/063` | Correct | Japanese | `C`, no variant |
| O01-B | Ganzui `OP17-043` | Correct | EN | `UC`, no variant |
| O02-B | Event `OP17-019` | Correct | English | `R`, but incorrectly called parallel |
| O03-B | Sabo `OP04-083` | Correct | EN | `SR`, Special detected |
| O04-B | Nico Robin `ST29-009` | Correct | EN | `C`, Alternate Art / Parallel missed |

OpenAI is strong at names, identifiers, and languages, but its self-confidence does not safely establish an exact printing. Two One Piece variant judgments were materially wrong or missing. Catalog and artwork comparison remain mandatory.

## Graded slabs

### PSA Sanji

- Card: Sanji `OP01-013`, EN, Alternate Art.
- Label: PSA 10, certificate `148536135`.
- All requested label fields were read correctly from one whole-slab photo.

### RGS Flareon ex

- Card: ブースターex `022/187`, Japanese, rarity `RR`.
- Label: Rubin Grading Service, overall grade 10.
- No certificate number was invented because none was visible.
- Subgrades: Centering 10, Corners 9, Edges 10, Surface 9.5 — all correct.

This is the clearest product advantage from the pilot: OpenAI handles non-standard grading labels and subgrades substantially better than a provider flow centered on a fixed slab catalog.

## Product decision

**Product decision after the measured pilot:** use OpenAI as the bounded primary recognizer in the Scanner V16 preview. Keep Ximilar available as a disabled comparison/fallback, but do not call it from the normal scanner. OpenAI output must pass the existing catalog, artwork, language, variant, and user-confirmation gates before import. Do not use OpenAI self-confidence as an import guarantee.

The first product implementation should therefore be:

1. OpenAI observes the photographed card or grading label.
2. Existing V16 catalog and artwork ranking independently verify the proposal.
3. Explicit confirmation remains mandatory for uncertain printings and every grading label.
4. Server-side authentication, duplicate prevention and weekly/global limits run before each paid request.
