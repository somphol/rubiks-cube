<div align="center">

<img src="docs/social-card.png" alt="CubeLab — Interactive 3D Rubik's Cube Studio" width="100%" />

# CubeLab

**Interactive 3D Rubik's Cube Studio**

Drag-to-turn controls, a live move log, synthesized mechanical clicks, and a real Kociemba two-phase solver in the browser.

[![Live demo](https://img.shields.io/badge/live_demo-online-f59e0b?style=flat-square)](https://somphol.github.io/rubiks-cube/)
[![build](https://github.com/somphol/rubiks-cube/actions/workflows/build.yml/badge.svg)](https://github.com/somphol/rubiks-cube/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square)](LICENSE)

**[Try it live →](https://somphol.github.io/rubiks-cube/)**

</div>

---

## Highlights

- **26-cubelet 3D cube** built with Three.js, rounded bevels, glossy stickers, soft studio lighting, shadows, and a dark slate gradient stage.
- **Direct manipulation** — raycast a sticker and drag to turn that row or column. Drag empty space to orbit 360°, scroll or pinch to zoom. Middle rows turn the M / E / S slices.
- **Full control dock** — U, U′, D, D′, L, L′, R, R′, F, F′, B, B′ buttons plus keyboard shortcuts.
- **Scramble** — 20 randomized, non-redundant face turns with fast animated playback.
- **Solve** — computes a real solution from the current cube state with Herbert Kociemba's two-phase algorithm, then plays it back step by step. Solutions are typically around 20 moves.
- **Auto Solve** — a cinematic run from start to finish: it scrambles a solved cube, computes the solution, and performs it with a face-aware camera, a glow on the turning layer, and a slow-mo finish. Drag the cube or press `Esc` to take the camera back while the solve keeps playing. Switch to Step mode to walk through the same cinematic solve one move at a time.
- **Solver in a worker** — the first solve warms up the pruning tables off the main thread, so the UI keeps animating. A main-thread fallback keeps the solver working in browsers that block Blob workers.
- **Playback controls** — Slow, Medium, Fast, and Step modes, plus pause/resume. In Step mode, the solver waits after every move; click Next (or press `Space` / `N`) to advance.
- **Live HUD** — timer, move count, personal best, solve state, and a scrollable move-history log with copy-to-clipboard.
- **Undo & reset** — reverse the last move or snap back to the pristine solved state.
- **Synthesized audio** — Web Audio API plastic clicks and a victory chime. No audio files.
- **Victory celebration** — 3D confetti, a celebratory camera orbit, and a results card with time, moves, and best.
- **Responsive** — the camera refits for portrait screens, and the dock rearranges for phones.

## Run it

### Locally

```bash
open index.html
```

Or serve the folder if you prefer HTTP:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Online

If GitHub Pages is enabled for this repository:

**https://somphol.github.io/rubiks-cube/**

## Controls

| Action | Input |
| --- | --- |
| Turn a layer | Drag a sticker in the direction the row/column should move |
| Orbit the camera | Drag empty space around the cube |
| Zoom | Scroll or pinch |
| Face turns | `U` `D` `L` `R` `F` `B` |
| Prime turns | Hold `Shift` while pressing a face key |
| Undo | `Z` |
| Pause / resume playback | `Space` |
| Next move in Step mode | Click Next, `Space`, or `N` |
| Take camera control during Auto Solve | Drag the cube or press `Esc` |
| Close a dialog | `Esc` |

The on-screen dock also exposes every face turn, Scramble, Solve, Auto Solve, Undo, and Reset.

## How the solver works

The logical cube is modelled with [cube.js](https://github.com/ldez/cubejs), an MIT-licensed implementation of Kociemba's two-phase algorithm. The visual cube and the logical cube are kept in sync by applying the same move definitions to both; the app includes a self-test that verifies all 18 face turns, all 9 slice turns, and a full solver run.

On the first solve:

1. The solver tables are computed in a Blob Web Worker.
2. The current cube state is sent to the worker as a facelet string.
3. The worker returns a solution in standard notation.
4. The main thread plays each move with the same easing and audio used for manual turns.

If Blob workers are unavailable (for example, some `file://` browser configurations), CubeLab falls back to initializing the solver on the main thread behind the loading overlay.

## Project layout

```
.
├── index.html                 # generated, self-contained playable app
├── preview.png                # README screenshot
├── build.py                   # assembles index.html from src/
├── src/
│   ├── index.template.html    # HTML shell + UI markup
│   ├── styles.css             # glass UI, responsive layout, animations
│   ├── app.js                 # Three.js scene, cube mechanics, UI logic
│   └── vendor/
│       ├── cube.min.js        # cube.js model (MIT)
│       └── solve.js           # Kociemba two-phase solver (MIT)
├── docs/                      # architecture, testing, release, design, FAQ, roadmap
├── .github/                   # issue/PR templates and build workflow
├── AGENTS.md                  # agent/maintainer handoff
├── SUPPORT.md                 # where to get help
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
├── THIRD_PARTY_NOTICES.md
└── LICENSE                    # MIT
```

## Development

Edit files in `src/`, then rebuild:

```bash
python3 build.py
```

The build inlines `src/styles.css`, `src/vendor/cube.min.js`, `src/vendor/solve.js`, and `src/app.js` into `index.html`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the runtime map and
[docs/TESTING.md](docs/TESTING.md) for the full test matrix.

There is also a browser self-test:

```text
index.html?selftest
```

It checks every face and slice move against the visual cube, validates the drag-direction mapping, solves a mixed state, and writes a pass/fail report to the page. Add `?debug` for a small `window.__cubeLab` inspection API, and `?noworker` to exercise the main-thread solver fallback.

## Technical notes

- **Three.js r128** via jsDelivr, with `OrbitControls` and `RoundedBoxGeometry` from the matching examples.
- **No external audio or image assets** — the environment map, favicon, glow, and confetti are generated at runtime.
- **Preferences** — sound, playback speed, step mode, and personal best are stored in `localStorage`.
- **Single file** — the generated `index.html` contains the UI, styles, cube model, solver, and app logic. Three.js is the only runtime CDN dependency.
- **Build check** — GitHub Actions rebuilds `index.html` and fails if the committed file is stale.
- **Docs** — architecture, testing, release, design, accessibility, browser support, performance, FAQ, and roadmap live in [`docs/`](docs/README.md).

## Contributing

Contributions are welcome — bug reports, feature ideas, accessibility improvements, and
documentation fixes alike. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

- **Found a bug?** [Open a bug report](https://github.com/somphol/rubiks-cube/issues/new?template=bug_report.yml)
- **Have an idea?** [Request a feature](https://github.com/somphol/rubiks-cube/issues/new?template=feature_request.yml)
- **Need help?** See [SUPPORT.md](SUPPORT.md) and the [FAQ](docs/FAQ.md).
- **Found a vulnerability?** Please follow [SECURITY.md](SECURITY.md) and report it privately.

## Documentation

| Document | Purpose |
| --- | --- |
| [README.md](README.md) | Overview, setup, controls, and architecture |
| [docs/README.md](docs/README.md) | Documentation index: architecture, testing, release, design, accessibility, browser support, performance, FAQ, roadmap |
| [docs/REPRODUCTION.md](docs/REPRODUCTION.md) | Complete blueprint to rebuild the project from an empty directory |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture decision records and rationale |
| [AGENTS.md](AGENTS.md) | Agent and maintainer handoff |
| [SUPPORT.md](SUPPORT.md) | Where to get help |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes and release history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local workflow, constraints, and pull request checks |
| [SECURITY.md](SECURITY.md) | Supported versions and private vulnerability reporting |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Library, font, and asset attribution |
| [LICENSE](LICENSE) | MIT licence |

## License

Project code: MIT © 2026 Somphol Boonjing.

Bundled [cube.js](https://github.com/ldez/cubejs) is MIT © Petri Lehtinen and Ludovic Fernandez. [Three.js](https://threejs.org/) is MIT © three.js authors. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
