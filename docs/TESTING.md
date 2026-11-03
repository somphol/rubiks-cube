# Testing

CubeLab has no server and no test runner dependency. Testing is a browser self-test plus a
short manual matrix. Run the build check before every commit that touches `src/`.

## Quick smoke test

```bash
python3 build.py
python3 -m http.server 8000
```

Open <http://localhost:8000> and check:

1. The cube renders and drags to turn.
2. A face key (`U`, `R`, `F`, ...) turns the matching layer.
3. Scramble produces 20 moves.
4. Solve computes a solution and plays it back.
5. Auto Solve scrambles a solved cube and completes a cinematic solve.
6. Step mode waits after each move; Next, `Space`, and `N` advance one move.
7. Reset returns the cube to solved.
8. Reload preserves sound, speed, Step mode, and personal best.

## Browser self-test

Open:

```text
http://localhost:8000/index.html?selftest
```

The test covers:

- All 18 face moves and 9 slice moves against the visual cube.
- A mixed move sequence and visual/logical sync.
- Drag-direction mapping.
- Cinematic UI presence and camera viewpoints.
- Step UI and the Step gate.
- Layer glow on and off.
- A full solver run on a mixed state.

It writes a report to `<pre id="selftest">` and sets
`document.body.dataset.selftest` to `pass` or `fail`. The page title also changes.

## Debug API

Open `?debug` and use `window.__cubeLab` from the console:

```js
__cubeLab.state()                 // cube, visual, sync, mode, moves, camera, cinematic...
__cubeLab.move("R")               // perform one move
__cubeLab.sequence(["R", "U", "R'"])
__cubeLab.reset()
__cubeLab.scramble()
__cubeLab.solve()                 // normal solve
__cubeLab.autoSolve()             // cinematic solve
__cubeLab.setSpeed("step")        // "step" or 150 / 330 / 650
__cubeLab.screenPoint("F", 1, 1)  // screen coordinates of a facelet
```

`?noworker` forces the main-thread solver path. Use it when a worker-related bug is
suspected.

## Manual matrix

| Area | What to check |
| --- | --- |
| Desktop | Chrome, Safari, Firefox, Edge: render, drag, orbit, zoom, dock, keyboard |
| Tablet | Portrait and landscape: dock reflow, banner, touch drag, pinch zoom |
| Phone | Narrow widths: controls fit, no horizontal overflow, safe-area padding |
| WebGL | Context creation, shadows, environment map, resize |
| Solver | First run (warm-up), subsequent runs, `?noworker` fallback, Reset during solve |
| Playback | Slow, Medium, Fast, Step; pause/resume; Next; `Space`; `N`; speed change mid-solve |
| Auto Solve | Scramble-then-solve, camera framing, layer glow, Take control, `Esc`, reduced motion |
| State | Reload, reset, undo, scramble, victory modal, personal best |
| Audio | Sound toggle, clicks, victory chime, muted state persists |
| Accessibility | Keyboard-only flow, focus rings, `Esc` closes dialogs, reduced motion |
| Persistence | `localStorage` values survive reload; corrupt values do not break boot |

## Build check

The generated `index.html` must match `src/`:

```bash
python3 build.py
git diff --exit-code -- index.html
```

CI runs the same check in `.github/workflows/build.yml`. It does not run the browser
self-test; that remains a manual step.

## Change-specific checks

- **Cube mechanics:** run `?selftest` and add a case if the move set changed.
- **Solver:** test a mixed state, a solved state, and `?noworker`.
- **Camera/cinematic:** test desktop and phone, Take control, `Esc`, and reduced motion.
- **Step mode:** test Next, `Space`, `N`, switching to Fast mid-solve, Reset while waiting.
- **UI/CSS:** test 320 px, 390 px, 768 px, 1024 px, and 1440 px widths.
- **Persistence:** test a reload and a fresh profile.

## Reporting a failure

Open a [bug report](https://github.com/somphol/rubiks-cube/issues/new?template=bug_report.yml)
with the browser, OS, URL or commit, exact steps, expected/actual behaviour, and console
output. For security issues, follow [SECURITY.md](../SECURITY.md).
