# Architecture

CubeLab is a static, single-page application. There is no server component. The
repository contains source files in `src/` and a generated `index.html` that is deployed
as-is.

## Runtime shape

1. The browser loads `index.html`.
2. Three.js r128, `OrbitControls`, and `RoundedBoxGeometry` load from jsDelivr.
3. The inlined vendor block defines `Cube` and `Cube.initSolver`.
4. The app IIFE builds the scene, cube, UI, solver worker, and event handlers.
5. The render loop runs continuously; the solver runs only when requested.

The only network requests are the three CDN scripts. There are no fonts, images, audio
files, analytics, or API calls at runtime.

## Build pipeline

`build.py` reads:

- `src/index.template.html` — HTML shell, UI markup, script tags
- `src/styles.css` — glass UI, layout, responsive rules, animations
- `src/vendor/cube.min.js` + `src/vendor/solve.js` — cube model and Kociemba solver
- `src/app.js` — scene, mechanics, UI logic, camera director, self-test

It replaces `/*__STYLES__*/`, `/*__VENDOR__*/`, and `/*__APP__*/` and writes `index.html`.
The vendor header in `build.py` carries the cube.js MIT notice.

**Do not edit `index.html`.** Edit `src/` and rebuild. CI runs the build and fails if the
committed `index.html` differs.

## Source map

| File | Responsibility |
| --- | --- |
| `src/index.template.html` | Document shell, top bar, stats, history, banner, speed row, dock, modals, cinematic controls, solver overlay |
| `src/styles.css` | Design tokens, glass surfaces, cube UI, cinematic mode, responsive breakpoints, reduced motion |
| `src/app.js` | State, Three.js scene, cube mechanics, move queue, solver worker, camera director, UI wiring, self-test |
| `src/vendor/cube.min.js` | cube.js 1.3.2 model |
| `src/vendor/solve.js` | Kociemba two-phase solver |
| `build.py` | Single-file build script |
| `index.html` | Generated deployable artifact |

## Cube model and move system

- `Cube` (cube.js) is the logical model. `state.cube` is the source of truth for legality
  and solving.
- `MOVE_DEFS` maps each face/slice move to an axis, layer, and canonical quarter-turn
  angle. `AXIS_MOVES` maps a positive axis/layer rotation to a face move for drag input.
- `performMove()` queues a move. `startTurn()` animates the selected cubelets around the
  axis, then calls `state.cube.move()`, records the move, plays the click, and checks for
  a solved state.
- `stickerFacelet()` maps a sticker's current world orientation and position to a facelet
  index. `getVisualFacelets()` builds the 54-character string; `checkSync()` compares it
  with `state.cube.asString()`.
- The visual cube uses 26 cubelet groups, each with a body and up to three stickers.
  Stickers have per-sticker materials so the cinematic layer glow can animate
  independently.
- `generateScramble()` creates 20 non-redundant face turns and avoids three consecutive
  moves on the same axis.

## Solver

- `initSolverWorker()` builds a Blob worker from the inline `#vendor-source` script and a
  small bootstrap.
- The worker calls `Cube.initSolver()` once, then handles `{ type: "solve", state }`
  messages.
- `computeSolution()` sends `state.cube.asString()` and falls back to
  `state.cube.solve()` on the main thread if the worker fails or `?noworker` is set.
- The first solve pays the pruning-table warm-up cost. The UI shows the solver overlay
  while that happens.
- Solutions use standard face-turn notation (`U`, `R'`, `F2`, ...). The solver does not
  emit slice moves.

## Camera and cinematic director

- `PerspectiveCamera` is 39° with home position `(6.2, 5.5, 8.3)` and target
  `(0, -0.1, 0)`.
- `fitCamera()` scales the distance for portrait and narrow aspect ratios. It is skipped
  while the cinematic director is active.
- `OrbitControls` provides orbit and zoom with damping; distance is clamped to 5.6–24.
- The cinematic director (`CINEMA`) saves the pre-show camera state, disables damping, and
  animates in spherical coordinates (theta/phi/distance) so the path never cuts through
  the cube.
- `CINEMA_FACE_VIEW` defines a three-quarter view per face. `cinemaFocus()` only moves
  when the working face is not readable (`faceIsVisible()` threshold 0.22), so most moves
  stay on a stable hero view.
- `cinemaIntro()` returns to the hero view; `cinemaOutro()` pulls back before the victory
  orbit.
- `beginCinematic()` and `endCinematic()` manage the `body.cinematic` class, controls, and
  glow cleanup. `cancelCinematicCamera()` hands control back without stopping playback.
- `prefers-reduced-motion` skips camera animation while keeping the solve.

## Playback modes

- Slow, Medium, and Fast set `state.speed` to 650, 330, or 150 ms.
- Step sets `state.step`. The solve loop shows the move, then awaits `waitForStep()`.
  `advanceStep()` resolves the gate. Reset, Scramble, and switching to a timed speed call
  `releaseStep()`.
- Auto Solve calls `autoSolve()`: if the cube is solved it runs `scramble()`, then
  `solveCube({ cinematic: true })`.
- In cinematic mode the solve loop calls `cinemaFocus()` before each move, suppresses
  `checkSolved` during playback, and calls `onSolved()` after `cinemaOutro()`.

## State and persistence

`state` includes the cube, history, move count, timer, mode, speed, step/stepWaiting,
sound, paused, started, scrambled, assisted, celebrating, session, solution/index, best,
and solverReady. `CINEMA` holds cinematic camera state.

`localStorage` keys:

| Key | Value |
| --- | --- |
| `cubelab.best.v1` | Personal best (manual solves only) |
| `cubelab.sound.v1` | Sound on/off |
| `cubelab.speed.v1` | Last timed speed |
| `cubelab.step.v1` | Step mode preference |

No data leaves the browser.

## UI layers

- **Top bar** — brand, status pill, sound, help.
- **Stats panel** — timer, moves, best, state.
- **History panel** — move log and copy.
- **Bottom UI** — solve banner, speed row, face dock, hint.
- **Cinematic controls** — Pause/Next and Take control, shown only in cinematic mode.
- **Modals** — victory and help.
- **Solver layer** — warm-up/search overlay.
- **Toast** — transient status.

The UI is plain DOM over the canvas; there is no framework.

## Self-test and debug

`?selftest` runs a browser test: 18 face and 9 slice moves, a mixed sequence, drag
mapping, cinematic UI/views, Step UI/gate, layer glow, and a solver run. It writes a
report to `<pre id="selftest">` and sets `document.body.dataset.selftest`.

`?debug` exposes `window.__cubeLab` with `state()`, `move()`, `sequence()`, `reset()`,
`scramble()`, `solve()`, `autoSolve()`, `setSpeed()`, and `screenPoint()`.

`?noworker` forces the main-thread solver path.

## Extension points

- **New face or slice move:** add it to `MOVE_DEFS`/`AXIS_MOVES`, add the visual mapping,
  and extend the self-test.
- **New playback behaviour:** add it to `solveCube()` and the speed row; keep Step and
  cinematic paths consistent.
- **New visual effect:** prefer per-sticker or per-cubelet state; keep the render loop
  allocation-light.
- **New UI panel:** add markup to `index.template.html`, styles to `styles.css`, refs and
  handlers to `app.js`, and responsive rules.
- **New solver option:** keep the worker protocol backward-compatible and the main-thread
  fallback working.

## Constraints

- Static hosting, no backend.
- One generated `index.html` plus the pinned Three.js CDN.
- No tracking or remote persistence.
- Must stay usable on a phone.
- The browser self-test must stay green.
