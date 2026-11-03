# FAQ

## Is the solver real, or is it playing a script?

It is real. CubeLab sends the current 54-facelet state to a bundled Kociemba two-phase
solver (`cube.js` + `solve.js`) and plays the returned solution. It is not a canned
animation, and it works from any legal scrambled state.

## Why does the first solve take longer?

The first solve builds the two-phase pruning tables. That work happens in a Blob Web Worker
so the UI stays responsive. Later solves reuse the worker and are much faster. If workers
are unavailable, the same warm-up happens on the main thread behind the solver overlay.

## Why is the solution sometimes longer than 20 moves?

Kociemba's two-phase algorithm is fast and produces short solutions, but it is not a
guaranteed optimal solver. A typical result is 18–22 moves; the exact count depends on the
state.

## Does it work offline?

The app is a single HTML file, but Three.js r128 is loaded from jsDelivr on first load.
After the libraries are cached by the browser, the app can run offline. The cube model and
solver are inlined, so they do not need the network. If the CDN is blocked, the app shows a
fatal error.

## What data does it store?

Only browser-local preferences and your best manual solve:

- `cubelab.best.v1`
- `cubelab.sound.v1`
- `cubelab.speed.v1`
- `cubelab.step.v1`

There is no account, backend, analytics, or telemetry. Clearing site data resets the app.

## Does it work on a phone?

Yes. The layout reflows, the camera refits for portrait screens, and touch drag/pinch are
supported. A modern browser with WebGL is required. Low-power mode may reduce frame rate.

## Why does Auto Solve scramble a solved cube first?

So the show has a beginning. If the cube is already scrambled, Auto Solve solves the
current state instead. Use the normal **Solve** button if you want to solve the current
state without a scramble.

## What is Step mode?

Step is a playback mode. The solver computes the full solution, then waits before every
move. Click **Next**, press `Space`, or press `N` to advance one turn. It works with both
**Solve** and **Auto Solve**.

## How do I take camera control during Auto Solve?

Drag the cube, click **Take control**, or press `Esc`. The camera returns to you and the
solve keeps playing. The top-right controls also include **Pause** / **Next**.

## Why does the timer run while I step?

The timer measures the assisted solve session, including the time you spend inspecting a
step. Assisted solves are not recorded as personal bests. The timer is informational.

## Can I embed it in my site?

Yes, under the MIT licence. Keep the copyright and permission notice, and keep the
third-party notices for Three.js and cube.js. The app is a single `index.html`; you can
host it anywhere static. Three.js still loads from jsDelivr unless you vendor it.

## Why are there no accounts or leaderboards?

CubeLab is deliberately local-first and static. Accounts, leaderboards, and cloud sync
would require a backend, privacy work, and ongoing maintenance that are out of scope.

## The cube is black or the page says WebGL is unavailable. What now?

The app requires WebGL. Enable hardware acceleration, update the browser, or try a current
Chrome, Edge, Firefox, or Safari. On a remote desktop or locked-down machine, WebGL may be
disabled by policy.

## There is no sound. Why?

Browsers require a user gesture before audio can start. Click or tap the page, then toggle
sound on. If the browser blocks `AudioContext`, the app continues silently.

## Can I change the cube colours?

The face colours are defined in `FACE_COLORS` in `src/app.js` and mirrored as CSS variables
in `src/styles.css`. Change both, rebuild with `python3 build.py`, and check contrast and
the move-log chips. This is a code change, not a settings option.

## Is it accessible?

The keyboard paths, focus styles, live regions, and reduced-motion mode are implemented.
The cube state itself is not exposed as a text alternative yet, so screen-reader parity is
partial. See [ACCESSIBILITY.md](ACCESSIBILITY.md) for the honest limits and the roadmap.

## How do I report a bug?

Open a [bug report](https://github.com/somphol/rubiks-cube/issues/new?template=bug_report.yml)
with the browser, OS, steps, expected/actual behaviour, and console output. For security
issues, follow [SECURITY.md](../SECURITY.md) and report privately.
