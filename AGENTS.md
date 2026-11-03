# AGENTS.md

CubeLab is a static, single-file 3D Rubik's Cube studio. This file is the handoff for
anyone changing the repository. For the product overview, start with
[README.md](README.md); for the full doc index, see [docs/README.md](docs/README.md).

## What it is

CubeLab renders a 26-cubelet Rubik's Cube with Three.js, supports drag-to-turn and
keyboard moves, and solves the current state with a bundled Kociemba two-phase solver.
`src/` is the source of truth; `build.py` inlines it into `index.html`, which is the
deployable GitHub Pages artifact. It is not a server application: there is no backend,
account system, analytics, or package manager.

## Commands

All commands run from the repository root.

| Task | Command |
| --- | --- |
| Build `index.html` | `python3 build.py` |
| Run locally | `python3 -m http.server 8000`, then open <http://localhost:8000> |
| Browser self-test | <http://localhost:8000/index.html?selftest> |
| Debug API | <http://localhost:8000/index.html?debug> (`window.__cubeLab`) |
| Force main-thread solver | <http://localhost:8000/index.html?noworker> |
| Verify generated file | `python3 build.py && git diff --exit-code -- index.html` |
| Deploy | push `main`; GitHub Pages serves the repository root |

The self-test writes `PASS`/`FAIL` to the page and sets `document.body.dataset.selftest`.
There is no npm install and no build dependency beyond Python 3.

## Architecture

- `build.py` reads `src/index.template.html`, `src/styles.css`,
  `src/vendor/cube.min.js`, `src/vendor/solve.js`, and `src/app.js`, then writes
  `index.html`. The template placeholders are `/*__STYLES__*/`, `/*__VENDOR__*/`, and
  `/*__APP__*/`.
- `src/app.js` is one IIFE. Construction order: constants → state → DOM refs → Three.js
  scene → camera director → cube geometry → move queue → UI state → solver worker →
  solve/scramble/undo → input handlers → render loop → debug/self-test API.
- The visual cube and the logical `Cube` model are kept in sync by applying the same move
  definitions to both. `stickerFacelet()` maps a visual sticker to a facelet index;
  `checkSync()` compares it with `state.cube.asString()`.
- `src/vendor/cube.min.js` is cube.js 1.3.2. `src/vendor/solve.js` is the Kociemba
  two-phase solver. Both are inlined and MIT-licensed; see
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Three.js r128, `OrbitControls`, and `RoundedBoxGeometry` load from jsDelivr at runtime.
  Everything else is local.
- The solver runs in a Blob Web Worker built from the inline `#vendor-source` script. If
  workers are unavailable, it falls back to the main thread behind the solver overlay.
- Playback modes are Slow/Medium/Fast, Step (`state.step` + `waitForStep()`), and the
  cinematic Auto Solve director (`CINEMA`, `cinemaFocus()`, `beginCinematic()`).
- Preferences persist in `localStorage`: `cubelab.best.v1`, `cubelab.sound.v1`,
  `cubelab.speed.v1`, `cubelab.step.v1`.

## Decisions and constraints

- **Never edit `index.html` by hand.** Edit `src/` and run `python3 build.py`.
- Keep the app static, backend-free, and single-file apart from the pinned Three.js CDN.
- Do not add accounts, tracking, analytics, or server-side state.
- Preserve the visual/logical sync. The `?selftest` suite is the guard; extend it when
  adding a move or changing the cube model.
- Preserve keyboard paths, focus styles, ARIA labels/live regions, and
  `prefers-reduced-motion` behaviour.
- Keep the solver worker and the main-thread fallback working. Do not move solver
  initialization onto the critical path.
- Treat `src/vendor/` as pinned third-party code; update notices if it changes.
- The cinematic camera intentionally stays on a readable hero view and only re-frames when
  the working face is occluded. Do not turn it into a per-move whip-pan.
- Step mode is a first-class playback mode: keep `Next`, `Space`, and `N` in sync, and
  keep the gate releasable by Reset, Scramble, and speed changes.

## Known issues

- First load needs network access for Three.js; a blocked CDN shows a fatal error.
- WebGL is required. Blob workers are optional but recommended.
- The browser self-test is manual; CI checks only that `index.html` is rebuilt from
  `src/` (`.github/workflows/build.yml`).
- Low-end mobile devices can drop frames; there is no adaptive quality switch.
- `color-mix()` and `backdrop-filter` degrade gracefully in older browsers.
- There is no import/export, account, leaderboard, or cloud sync feature.

## Continuity

- Live site: <https://somphol.github.io/rubiks-cube/>
- Repository: <https://github.com/somphol/rubiks-cube>
- GitHub Pages deploys from `main` at the repository root. Commit the rebuilt
  `index.html`; `.nojekyll` is present.
- Documentation: [docs/README.md](docs/README.md). Release process:
  [docs/RELEASE.md](docs/RELEASE.md).
- Reproduction blueprint: [docs/REPRODUCTION.md](docs/REPRODUCTION.md). Decision log:
  [docs/DECISIONS.md](docs/DECISIONS.md).
