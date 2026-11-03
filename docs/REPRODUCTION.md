# Reproduction blueprint

This is the complete handoff for rebuilding CubeLab from an empty directory. The source in
`src/` is the canonical implementation; this document captures the product behaviour,
exact values, build steps, and acceptance criteria that are easy to lose between sessions.

If you are changing the existing repository, read [AGENTS.md](../AGENTS.md) first. If you
are recreating the project, follow this document in order.

## 1. What CubeLab is

CubeLab is a static, single-page 3D Rubik's Cube studio. It renders a 26-cubelet cube with
Three.js, supports drag-to-turn and keyboard moves, and solves the current state with a
bundled Kociemba two-phase solver. The deployable artifact is one generated `index.html`;
there is no backend, account system, analytics, or package manager.

Non-goals: accounts, leaderboards, cloud sync, multiplayer, server-side state, arbitrary
file import/export, analytics, and a framework build pipeline.

## 2. Reproduction checklist

1. Create the repository layout in section 3.
2. Add the pinned vendor files: cube.js 1.3.2 and the Kociemba solver.
3. Add the HTML shell with the exact UI regions in section 5.
4. Add the design tokens, layout, cinematic mode, and responsive rules in section 6.
5. Implement the state, scene, cube model, move queue, solver worker, camera director,
   playback modes, UI wiring, and self-test in section 7.
6. Add `build.py` and build `index.html`.
7. Open `index.html?selftest`; it must report `RESULT PASS`.
8. Run the build check: `python3 build.py && git diff --exit-code -- index.html`.
9. Add the docs, issue templates, PR template, and CI workflow.
10. Deploy to GitHub Pages from `main` at the repository root.

## 3. File tree

```text
.
├── index.html                 # generated; do not edit
├── preview.png                # README screenshot
├── build.py                   # assembles index.html from src/
├── src/
│   ├── index.template.html    # HTML shell, UI markup, CDN scripts
│   ├── styles.css             # tokens, layout, cinematic mode, responsive rules
│   ├── app.js                 # state, scene, mechanics, solver, camera, UI, self-test
│   └── vendor/
│       ├── cube.min.js        # cube.js 1.3.2 (MIT)
│       └── solve.js           # Kociemba two-phase solver (MIT)
├── docs/                      # this blueprint, architecture, testing, design, FAQ, etc.
├── .github/                   # issue/PR templates, build workflow
├── AGENTS.md                  # maintainer/agent handoff
├── SUPPORT.md                 # where to get help
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── THIRD_PARTY_NOTICES.md
├── LICENSE
├── .nojekyll
├── robots.txt
└── sitemap.xml
```

## 4. Dependencies and versions

| Dependency | Version | Delivery |
| --- | --- | --- |
| Three.js | r128 | jsDelivr CDN |
| OrbitControls | r128 examples | jsDelivr CDN |
| RoundedBoxGeometry | r128 examples | jsDelivr CDN |
| cube.js | 1.3.2 | inlined from `src/vendor/cube.min.js` |
| Kociemba two-phase solver | bundled with cube.js | inlined from `src/vendor/solve.js` |
| Python | 3.x | build only |

CDN URLs:

```text
https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js
https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/geometries/RoundedBoxGeometry.js
```

No npm, bundler, CSS framework, font file, image asset, or audio asset is used at runtime.

## 5. HTML shell and UI regions

`src/index.template.html` contains:

- `#stage` — full-screen canvas.
- `.bg-aurora`, `.bg-grid`, `.vignette` — decorative backgrounds.
- `.topbar` — brand (`CUBE` + `lab`), status pill, sound button, help button.
- `.stats-panel` — Time, Moves, Best, State.
- `.history-panel` — Move Log, copy button, move chips.
- `.bottom-ui`:
  - `.banner` — kicker, current move, sub-text, progress bar.
  - `.speed-row` — Slow, Medium, Fast, Step, Pause/Next.
  - `.dock` — 12 face buttons (U/U′/D/D′/L/L′/R/R′/F/F′/B/B′), divider, Scramble, Solve, Auto Solve, Undo, Reset.
  - `.hint` — drag/orbit/zoom/keyboard hint.
- `.cine-controls` — Pause/Next and Take control, shown only in cinematic mode.
- `.toast` — transient status.
- `#victory` modal — title, sub-text, Time, Moves, Best, Reset, Scramble Again.
- `#help` modal — How to play, direct manipulation, keyboard, Auto Solve, solver, credit.
- `#solverLayer` — computing-solution overlay with spinner and status text.
- `#vendor-source` — inline vendor script block used to build the solver worker.

Exact copy worth preserving:

| Element | Copy |
| --- | --- |
| Brand | `CUBE` + `lab` |
| Status | `Ready`, `In Play`, `Scrambled`, `Solving`, `Paused`, `Step`, `Solved`, `Scrambling` |
| Banner kickers | `SCRAMBLING`, `SCRAMBLE`, `SOLVING`, `AUTO SOLVE`, `STEP`, `PAUSED`, `SOLVED` |
| Banner subs | `Next: …`, `Final move`, `Playback paused — press Space or Resume`, `Click Next · then …`, `Click Next for the final move` |
| Speed row | `Playback`, `Slow`, `Medium`, `Fast`, `Step`, `Pause`, `Resume`, `Next` |
| Actions | `Scramble`, `Solve`, `Auto Solve`, `Undo`, `Reset` |
| Cinematic | `Pause`/`Next`, `Take control` |
| Hint | `Drag a sticker to turn a layer · drag empty space to orbit · scroll to zoom · U D L R F B turn · ⇧ prime` |
| History | `Move Log`, `Copy`, `Your moves will appear here. Drag a sticker or use the dock below.` |
| Victory | `Solved.`, `New personal best. Every sticker is home.`, `Solved with the two-phase solver in N moves.`, `Every sticker is home. Beautifully done.` |
| Toasts | `Cube reset.`, `Nothing to undo.`, `Playback paused`, `Playback resumed`, `Playback finished.`, `Scrambling first, then solving…`, `Camera control returned to you.`, `Sound on`, `Sound off`, `No moves to copy yet.`, `Move history copied.`, `Could not access the clipboard.`, `The cube is already solved.`, `The solver is unavailable in this browser.`, `No solution found. Try resetting the cube.`, `The solver hit an unexpected state. Try Reset.` |

## 6. Visual specification

### Design tokens

| Token | Value |
| --- | --- |
| `--bg-0` | `#05070c` |
| `--bg-1` | `#0a0f18` |
| `--bg-2` | `#111827` |
| `--ink` | `#eef3fb` |
| `--ink-soft` | `#c3cddd` |
| `--muted` | `#8492a8` |
| `--muted-2` | `#64748b` |
| `--line` | `rgba(255, 255, 255, 0.085)` |
| `--line-strong` | `rgba(255, 255, 255, 0.15)` |
| `--glass` | `rgba(14, 20, 32, 0.66)` |
| `--glass-2` | `rgba(20, 28, 43, 0.58)` |
| `--shadow` | `0 26px 70px rgba(0,0,0,0.48), 0 4px 18px rgba(0,0,0,0.28)` |
| `--cyan` | `#5ee7f5` |
| `--cyan-strong` | `#22d3ee` |
| `--indigo` | `#818cf8` |
| `--amber` | `#fbbf24` |
| `--green` | `#34d399` |
| `--red` | `#fb7185` |
| `--violet` | `#c4b5fd` |
| `--face-u` | `#f8fafc` |
| `--face-d` | `#ffd60a` |
| `--face-l` | `#ff7a18` |
| `--face-r` | `#ef2b3d` |
| `--face-f` | `#18b45a` |
| `--face-b` | `#2f6bff` |
| `--radius-xl` | `26px` |
| `--radius-lg` | `18px` |
| `--radius-md` | `13px` |

Font stack: `Inter`, system UI, `SF Pro Display`, `Segoe UI`, Roboto, Helvetica, Arial.
Monospace: `SF Mono`, `JetBrains Mono`, `Roboto Mono`, ui-monospace, Menlo.

### Layout breakpoints

| Breakpoint | Behaviour |
| --- | --- |
| `max-width: 1180px` | Hide the move-log panel |
| `max-width: 900px` | Compact top bar; stats move; dock stacks; actions 5 columns; hide hint |
| `max-width: 620px` | Full-width stats; smaller banner/dock/buttons; Auto Solve label hides; cinematic controls shrink |
| `max-width: 380px` | Hide brand text and all action labels; icon-only actions |
| `max-height: 700px` and `min-width: 621px` | Hide the banner except in cinematic mode |

### Cube visuals

- 26 cubelet groups at integer positions `x,y,z ∈ {-1,0,1}`, excluding the centre.
- Body: `RoundedBoxGeometry(0.96, 0.96, 0.96, 4, 0.045)`.
- Sticker: rounded rectangle `0.88 × 0.88`, corner radius `0.11`, offset `0.4815` along
  the face normal.
- Face colours: U `0xffffff`, R `0xc4162b`, F `0x009e3a`, D `0xffc400`, L `0xff6a00`,
  B `0x1d4ed8`.
- Body material: colour `0x06080d`, roughness `0.28`, metalness `0.58`, clearcoat `0.7`,
  clearcoat roughness `0.22`, env intensity `1.25`.
- Sticker material: roughness `0.25`, metalness `0.03`, clearcoat `0.85`, clearcoat
  roughness `0.12`, env intensity `0.78`, emissive = face colour × `0.02`.
- Each sticker has its own material clone so the cinematic glow can animate independently.

### Camera and lighting

- `PerspectiveCamera(39, aspect, 0.1, 120)`.
- Home position `(6.2, 5.5, 8.3)`; target `(0, -0.1, 0)`.
- `OrbitControls`: damping `0.075`, rotate speed `0.82`, zoom speed `0.86`, distance
  `5.6–24`, polar `0.1–π-0.1`.
- `fitCamera()` distance scale by aspect: `<0.55 → 1.42`, `<0.8 → 1.28`, `<1.05 → 1.12`,
  otherwise `1`.
- Key directional light `(6.5, 9.5, 7.5)`, 2048² shadow map, PCF soft shadows.
- Fill light `(-7.5, 4.5, -4.5)`, rim light `(0, -5.5, 4.5)`, ambient `0.22`, hemisphere
  `0.3`.
- Shadow floor at `y = -2.18`, 40×40 plane, `ShadowMaterial` opacity `0.3`.
- Generated 1024×512 equirectangular environment map with four radial blobs; PMREM.
- Glow plane 13×13 at `y = -2.19`, additive, generated radial texture.

### Motion timings

| Motion | Duration |
| --- | --- |
| Manual turn | `300 ms` (`160 ms` reduced motion) |
| Scramble turn | `92 ms` (`30 ms` reduced motion) |
| Cinematic turn | `clamp(speed × 1.55, 280, 900) ms` (`140 ms` reduced) |
| Cinematic camera move | `clamp(speed × 1.35, 260, 760) ms` (`0` reduced) |
| Cinematic intro | `900 ms` + `220 ms` hold |
| Cinematic outro | `1000 ms`, distance × `1.12` |
| Victory camera orbit | `5200 ms`, auto-rotate speed `2.35` |
| Banner transition | `0.28 s` |
| Victory modal delay | `700 ms` |

Easing is `easeInOutCubic` for turns and camera moves.

## 7. Behaviour specification

### State

`state` contains:

```text
cube, history, moveCount, timer {start, elapsed, running}, mode,
speed, step, stepWaiting, sound, paused, started, scrambled, assisted,
celebrating, session, solution, solutionIndex, best, solverReady
```

`mode` is `idle | scrambling | solving | solved | undo`. `CINEMA` separately holds
`active`, `cameraCancelled`, `anim`, `saved`, `damping`.

### Cube model and moves

- `Cube` is the logical model; `state.cube.asString()` is the 54-facelet state.
- Face offsets: U `0`, R `9`, F `18`, D `27`, L `36`, B `45`.
- Move definitions (`axis`, `layer`, canonical angle):

| Move | Axis | Layer | Angle |
| --- | --- | --- | --- |
| R | x | 1 | `-π/2` |
| L | x | -1 | `+π/2` |
| U | y | 1 | `-π/2` |
| D | y | -1 | `+π/2` |
| F | z | 1 | `-π/2` |
| B | z | -1 | `+π/2` |
| M | x | 0 | `+π/2` |
| E | y | 0 | `+π/2` |
| S | z | 0 | `-π/2` |

- Prime multiplies the angle by `-1`; `2` multiplies by `2`.
- Drag mapping: positive axis/layer rotation maps to the following moves. The canonical
  sign is the sign that produces the unprimed move.

| Axis | Layer | Move | Canonical sign |
| --- | --- | --- | --- |
| x | 1 | R | -1 |
| x | -1 | L | +1 |
| x | 0 | M | +1 |
| y | 1 | U | -1 |
| y | -1 | D | +1 |
| y | 0 | E | +1 |
| z | 1 | F | -1 |
| z | -1 | B | +1 |
| z | 0 | S | -1 |

- `performMove()` queues `{move, options, resolve, token}`. One turn runs at a time.
  `startTurn()` selects cubelets where `Math.round(position[axis]) === layer`, animates
  their quaternions, rounds positions at the end, calls `state.cube.move()`, records the
  move, plays a click, and checks for solved.
- Visual/logical sync: `stickerFacelet()` maps a sticker's current world normal and rounded
  cubelet position to `{face,row,col}`:

| Face | Row | Column |
| --- | --- | --- |
| U | `z + 1` | `x + 1` |
| D | `1 - z` | `x + 1` |
| R | `1 - y` | `1 - z` |
| L | `1 - y` | `z + 1` |
| F | `1 - y` | `x + 1` |
| B | `1 - y` | `1 - x` |

`getVisualFacelets()` builds the 54-character string; `checkSync()` compares it with
`state.cube.asString()`.

### Scramble

- 20 moves.
- Faces `U R F D L B`; modifiers `""`, `"'"`, `"2"`.
- Never repeat the same face consecutively.
- Never use the same axis three times in a row.
- Duration `92 ms` (`30 ms` reduced), volume `0.55`, not recorded, no solved check.
- After the scramble: mode `idle`, `scrambled = true`, history/move count reset, timer
  reset, banner `SCRAMBLE` for `6500 ms`.

### Solver

- Worker source: inline `#vendor-source` + bootstrap.
- Messages: `{type:"init"}` → `{type:"ready"}`; `{type:"solve", state, id}` →
  `{type:"solution", id, solution}`; errors → `{type:"error", id, message}`.
- Init timeout `25 s`; solve timeout `15 s`.
- Main-thread fallback: `Cube.initSolver()` once, then `state.cube.solve()`.
- `?noworker` forces the fallback.
- Solutions are face-turn notation; no slice moves.

### Playback modes

- Slow `650 ms`, Medium `330 ms`, Fast `150 ms`.
- Step: `state.step = true`. The solve loop shows the move, awaits `waitForStep()`, then
  performs it. `Next`, `Space`, and `N` call `advanceStep()`. Switching to a timed speed,
  Reset, or Scramble calls `releaseStep()`.
- Auto Solve: if the cube is solved, scramble first; then `solveCube({cinematic:true})`.
- Cinematic mode: `beginCinematic()` hides the UI, disables controls, saves camera state,
  disables damping. The loop focuses the working face, performs the move with layer glow,
  suppresses `checkSolved` during playback, runs `cinemaOutro()`, ends cinematic, then
  calls `onSolved()`.
- Take control: drag, `Esc`, or the button calls `cancelCinematicCamera()`; the solve keeps
  playing and the normal UI returns.

### Camera director

- `CINEMA_FACE_VIEW` (`theta`, `phi` in degrees):

| Face | Theta | Phi |
| --- | --- | --- |
| F | 18 | 62 |
| R | 72 | 62 |
| L | -72 | 62 |
| B | 162 | 62 |
| U | 28 | 34 |
| D | 28 | 118 |

- Cinematic distance: `CAMERA_HOME.length() × aspectScale × 0.94`.
- Face visibility threshold: dot product `0.22`; if the face is already visible, stay put.
- Interpolate spherical coordinates with the shortest angular path; never lerp through the
  cube.
- Intro returns to the home direction; outro adds `+0.25 rad` theta, `-0.06 rad` phi, and
  distance × `1.12`.

### Layer glow

- Highlight the 9 cubelets in the turning layer.
- `k = 1 - exp(-dt × 12)` per frame.
- Emissive = `baseColor × (0.02 + glow × 0.34)`, then lerp toward `0x9ff7ff` by
  `glow × 0.14`.
- `emissiveIntensity = 1 + glow × 0.32`; scale `1 + glow × 0.02`.
- Clear when target is `0` and glow `< 0.008`.

### Timer, best, and victory

- Timer starts when a solve/recorded move begins; `performance.now()` based; display
  refresh every `47 ms`. Display format is `MM:SS.t` (tenths).
- Best is saved only when `!assisted`, `started`, `ms > 400`, and `moveCount > 0`.
- `onSolved()` sets `mode = solved`, stops the timer, plays the chime, spawns confetti,
  starts the victory camera orbit, hides the banner, and opens the victory modal after
  `700 ms`.
- Confetti: `90` particles compact / `150` desktop; geometry `0.055 × 0.012 × 0.09`; life
  `2.6–4.6 s`; gravity `-7.4`; spin ±`7`; fade over the last `0.55 s`.
- Victory camera: auto-rotate on, speed `2.35`, off after `5200 ms`.

### Audio

- Web Audio only; no files.
- Click: filtered noise burst + low sine body, per-face pitch table
  `U7 R5 F3 D0 L2 B4 M1 E6 S8`.
- Chime: `523.25`, `659.25`, `783.99`, `1046.5`, `1318.51` Hz, `85 ms` stagger.
- Audio context is created/resumed on a user gesture; failure is non-fatal.

### Persistence

| Key | Value |
| --- | --- |
| `cubelab.best.v1` | `{ ms, moves, date }` |
| `cubelab.sound.v1` | boolean |
| `cubelab.speed.v1` | `150`, `330`, or `650` |
| `cubelab.step.v1` | boolean |

Reads/writes are wrapped in `try/catch`; storage failure is non-fatal.

### Browser and accessibility

- Required: WebGL, ES2020+, `matchMedia`, CSS custom properties/flex/grid, and
  `env(safe-area-inset-*)`.
- Optional with fallbacks: Blob Worker (main-thread solver), `localStorage` (no
  persistence), Web Audio (silent), clipboard (hidden textarea + `execCommand`),
  `navigator.vibrate`, `backdrop-filter`, and `color-mix()`.
- Keyboard: `U/D/L/R/F/B`, `Shift` for prime, `Z` undo, `Space` pause/Next, `N` next,
  `Esc` close dialog or take camera control.
- ARIA: the status pill is `aria-live="polite"`; the banner and toast are
  `role="status"`; dialogs are `role="dialog"` + `aria-modal`; the canvas has an
  `aria-label`.
- Reduced motion: skip camera choreography, shorten turns, and collapse CSS
  animations/transitions.
- Known gap: the cube state is not exposed as a text alternative; screen-reader parity is
  partial.

## 8. Build pipeline

`build.py`:

1. Reads `src/index.template.html`, `src/styles.css`, `src/vendor/cube.min.js`,
   `src/vendor/solve.js`, and `src/app.js`.
2. Prepends the cube.js MIT header to the vendor block.
3. Replaces `/*__STYLES__*/`, `/*__VENDOR__*/`, and `/*__APP__*/`.
4. Writes `index.html` with UTF-8.

The generated file is committed. CI runs the same build and fails if `index.html` differs.

## 9. Acceptance criteria

### Self-test

`index.html?selftest` must report `RESULT PASS`. It covers:

- 18 face moves and 9 slice moves against the visual cube.
- A mixed sequence and visual/logical sync.
- Drag-direction mapping.
- Cinematic UI presence and camera viewpoints.
- Step UI and the Step gate.
- Layer glow on and off.
- A full solver run on a mixed state.

`?debug` exposes `window.__cubeLab` with `state()`, `move()`, `sequence()`, `reset()`,
`scramble()`, `solve()`, `autoSolve()`, `setSpeed()`, and `screenPoint()`.

### Manual matrix

- Desktop Chrome, Safari, Firefox, Edge: render, drag, orbit, zoom, dock, keyboard.
- Tablet portrait/landscape and phone widths: reflow, touch drag, pinch zoom.
- Solver: first run, later runs, `?noworker`, Reset during solve.
- Playback: Slow/Medium/Fast/Step, pause/resume, Next, `Space`, `N`, speed change mid-solve.
- Auto Solve: scramble-then-solve, camera framing, layer glow, Take control, `Esc`,
  reduced motion.
- Persistence: reload, reset, undo, scramble, victory, best.
- Accessibility: keyboard-only, focus rings, `Esc`, reduced motion.

### Build check

```bash
python3 build.py
git diff --exit-code -- index.html
```

## 10. Known limitations

- First load requires network access for Three.js; a blocked CDN shows a fatal error.
- WebGL is required; Blob workers are optional but recommended.
- The browser self-test is manual; CI checks only the generated-file sync.
- Low-end mobile devices can drop frames; there is no adaptive quality switch.
- `color-mix()` and `backdrop-filter` degrade in older browsers.
- The cube state is not exposed as a text alternative; screen-reader parity is partial.
- There is no import/export, account, leaderboard, or cloud sync.
- Three.js is loaded without Subresource Integrity; pinning limits drift but does not
  remove CDN risk.

## 11. Baseline snapshot

At the time this blueprint was written (`2026-11-02`), `main` was at commit `35df0de`,
the feature baseline was `c93da6a` (cinematic Auto Solve + Step playback), and the live
site was <https://somphol.github.io/rubiks-cube/>. The commit that contains this file is
the documentation baseline; check `git log -- docs/REPRODUCTION.md` for the current one.
Always check `git log` for the current state; the source in `src/` remains the canonical
implementation.

## 12. Where to look next

- [ARCHITECTURE.md](ARCHITECTURE.md) — runtime map and source responsibilities.
- [TESTING.md](TESTING.md) — test matrix and debug API.
- [DESIGN.md](DESIGN.md) — visual and interaction rationale.
- [DECISIONS.md](DECISIONS.md) — why the major choices were made.
- [AGENTS.md](../AGENTS.md) — commands and constraints for changing the repo.
