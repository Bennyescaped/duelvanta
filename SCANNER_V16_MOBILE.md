# DUELVANTA Scanner V16.9 Mobile

## Scope

Scanner V16 remains isolated on the `scanner-v16` branch. Production
`collect.html`, Scanner V15.8 and `main` are not changed.

The canonical branch-only mobile route is:

- `/scanner-v16.html`
- `/scanner-v16-lab.html` redirects to the canonical direct route

## Root cause of V16.8 iPhone failures

V16.8 loaded `collect.html` inside an iframe, injected the V16 loader into that
document and then selected a separate native-camera patch on Apple mobile.
That patch added capture-phase click listeners with
`stopImmediatePropagation()` on controls which already had `onclick`
handlers owned by `scanner-v16-ui.js`.

The native patch only opened/configured the shared file input. The actual file
decode and analysis still depended on the older UI's `onchange` property
handler and on the iframe surviving the Safari background/foreground transition
while the native camera was open. Camera state, file-input state and analysis
state therefore had different owners. A returned photo could become visible
while analysis startup, wrapper readiness or control recovery remained
timing-dependent.

## V16.9 architecture

- Direct top-level page; no camera, focus or dialog boundary created by an
  iframe.
- The V16 OCR, catalog, artwork, quality, geometry, resilience, explainability
  and benchmark modules remain in place.
- `scanner-v16-runtime.js` owns one explicit state machine:
  `idle → decoding → preview → analyzing → result/error`.
- One analysis watchdog prevents silent indefinite hangs.
- Artwork reference loading has its own watchdog, so a stalled catalog image
  cannot block OCR/catalog completion or control recovery.
- Every error path releases the busy lock and restores capture/file controls.
- Live `getUserMedia` is the preferred route and preserves the DUELVANTA
  frame, live quality/reflection feedback and capture UI.
- Native camera and gallery use two separate file inputs. Their `capture`
  attributes are never mutated while a picker is open.
- `scanner-v16-native-camera.js` is a small input service and no longer
  intercepts or replaces UI event handlers.
- Event listeners are installed once via a binding guard.
- Explain, capture-guidance and market decorators are idempotent and no longer
  retrigger their own `MutationObserver` indefinitely after result rendering.
- Camera capture and selected/uploaded photos enter the same
  `controller.run()` pipeline.
- A completed analysis emits `dv:v16:analysis-complete`; Guided Benchmark
  captures it immediately while retaining the existing localStorage sessions
  and polling fallback.

## iPhone policy

Safari is allowed to use the top-level live camera first. If permission,
startup or frame delivery is unreliable on a specific device, the UI remains
usable and offers **iPHONE-FOTO** as the robust still-photo fallback. The
fallback necessarily leaves the web UI while Apple's native camera is open,
but it returns into the same preview, progress, OCR, catalog, artwork,
evidence-gate and benchmark pipeline.

## Test mode

`/scanner-v16.html?e2e=1` is a branch-only deterministic browser harness. It
uses local OCR/catalog fixtures, never signs in, never writes Supabase data and
never calls external card catalogs. It exists to regress the complete browser
interaction for Pokémon, One Piece and invalid-image recovery with uploaded
test images.

## Automated coverage

- `tests/scanner-v16-mobile-runtime-test.mjs`: upload/decode/analyze state
  sequence, error recovery and duplicate binding.
- `tests/scanner-v16-mobile-route-test.mjs`: direct route, split file inputs,
  single Supabase client construction and benchmark event integration.
- `tests/scanner-v16-browser-e2e.mjs`: real mobile Chromium file-chooser
  uploads for Pokémon and One Piece, invalid-image recovery and persisted
  Guided Benchmark results.
- Existing V16 recognition, evidence, resilience, geometry, camera and
  benchmark tests remain required.
