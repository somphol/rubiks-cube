# Decision log

Short architecture decision records for choices that are easy to undo accidentally. Each
entry is intentionally brief: context, decision, consequences. The code is the source of
truth; this log explains why it looks the way it does.

## ADR-001 — Static single-file build

**Date:** 2026-10-31

**Context:** CubeLab needs to run from GitHub Pages with no server, no package manager, and
no build infrastructure beyond a clone.

**Decision:** Keep source in `src/`, generate one `index.html` with `build.py`, and load
only Three.js from a pinned jsDelivr URL. Inline the cube model, solver, styles, and app.

**Consequences:** Deployment is a push. The generated file is large and must be committed.
A build check is required so `index.html` cannot drift from `src/`. Adding a framework or
an npm dependency would undermine the constraint.

## ADR-002 — Bundled cube.js and Kociemba solver, worker first

**Date:** 2026-10-31

**Context:** The cube must solve arbitrary legal states in the browser without a backend.

**Decision:** Inline cube.js 1.3.2 and its two-phase solver. Warm the solver in a Blob Web
Worker and fall back to the main thread when workers are unavailable. Provide `?noworker`
to exercise the fallback.

**Consequences:** First solve pays a pruning-table warm-up cost. The worker protocol and
fallback must stay compatible. The solver is fast but not guaranteed optimal; solutions are
typically around 20 moves.

## ADR-003 — Visual/logical sync is a contract

**Date:** 2026-10-31

**Context:** A 3D cube can look correct while the logical model is wrong, which would make
the solver fail silently.

**Decision:** Apply the same move definitions to the visual cubelets and the logical
`Cube`. Map stickers back to facelets with `stickerFacelet()`, and guard the contract with
`?selftest`.

**Consequences:** Any new move must be added to the model, the visual mapping, and the
self-test. A sync failure is a release blocker.

## ADR-004 — Direct manipulation, dock, and keyboard are peers

**Date:** 2026-10-31

**Context:** The cube should feel physical, but pointer-only interaction excludes keyboard
users and is awkward on some devices.

**Decision:** Raycast a sticker and drag to turn its layer; drag empty space to orbit; keep
a full face dock and `U/D/L/R/F/B` keyboard shortcuts. Middle rows turn M/E/S slices.

**Consequences:** Drag mapping must stay consistent with `AXIS_MOVES`. The dock and
keyboard paths must remain enabled whenever the cube is interactive.

## ADR-005 — Responsive camera, stable orbit

**Date:** 2026-10-31

**Context:** A fixed camera clips the cube on portrait phones and makes the dock feel
detached on small screens.

**Decision:** Use a 39° perspective camera, OrbitControls, and a `fitCamera()` distance
scale by aspect ratio. Do not auto-rotate during normal play.

**Consequences:** The camera refits on resize unless the user has moved it. The cinematic
director must save and restore camera state and must not fight OrbitControls damping.

## ADR-006 — Cinematic Auto Solve: stable hero view, not a whip-pan

**Date:** 2026-11-01

**Context:** The solver already played moves, but the camera stayed wherever the user left
it, so many turns happened on faces the viewer could not see. Constant re-framing would be
dizzying.

**Decision:** Add an Auto Solve mode with a saved camera state, a hero three-quarter view,
face-aware nudges only when the working face is not readable, a glow on the turning layer,
a slow-mo outro, and a Take control path. Respect `prefers-reduced-motion`.

**Consequences:** The camera director needs spherical interpolation, a visibility
threshold, and cancellation. The layer glow needs per-sticker materials. Auto Solve is a
presentation layer over the existing solver, not a second solver.

## ADR-007 — Step playback is a first-class mode

**Date:** 2026-11-01

**Context:** Users asked to walk through a solve one move at a time, both in the normal UI
and in the cinematic view.

**Decision:** Add Step as a fourth playback mode. The solve loop shows the move, waits on a
gate, and advances on Next, `Space`, or `N`. Switching to a timed speed, Reset, or Scramble
releases the gate. The Pause button becomes Next in both the speed row and cinematic
controls.

**Consequences:** The gate must resolve on every cancellation path or the solve loop hangs.
The Step UI must stay in sync with the speed row, the cinematic controls, and the banner
copy.

## ADR-008 — Local-first data, no accounts or analytics

**Date:** 2026-11-01

**Context:** A static app can be useful without collecting anything.

**Decision:** Persist only sound, speed, Step mode, and the manual personal best in
`localStorage`. Do not add accounts, tracking, telemetry, or a backend.

**Consequences:** No leaderboard or cloud sync. Users can clear site data to reset. Any
future export feature must be explicit and local.

## ADR-009 — Release-grade documentation and a build check

**Date:** 2026-11-02

**Context:** The project had a good README but lacked the handoff material a new
maintainer or agent needs, and the generated `index.html` could drift from `src/`.

**Decision:** Add `AGENTS.md`, `SUPPORT.md`, a docs index, architecture, testing, release,
design, accessibility, browser support, performance, FAQ, roadmap, a question issue
template, and a GitHub Actions build check.

**Consequences:** Documentation is part of the release checklist. CI verifies only the
generated-file sync; the browser self-test remains manual until a headless job is added.

## ADR-010 — No personal contact data in public docs

**Date:** 2026-11-02

**Context:** The code of conduct contained a personal email address in a public
repository.

**Decision:** Replace it with the repository's private reporting form and the maintainer's
GitHub profile. Keep secrets and personal data out of the docs.

**Consequences:** Conduct reports use the private advisory form or the public profile.
Contributors should not add personal contact details to docs.

## ADR-011 — Reproduction blueprint as continuity

**Date:** 2026-11-02

**Context:** Session context is lost when the session ends. The source alone does not
explain exact UI copy, timing values, acceptance criteria, or why choices were made.

**Decision:** Keep `docs/REPRODUCTION.md` as the complete blueprint and this file as the
decision log. `AGENTS.md` is the short handoff; the docs hold the detail.

**Consequences:** When behaviour changes, update the blueprint and the decision log. The
docs are part of the product, not an afterthought.
