# Performance

CubeLab is a small WebGL scene, not a game engine. The budget is deliberately modest: one
generated HTML file, one pinned CDN dependency, and a render loop that stays under a few
milliseconds on a typical laptop.

## Budget

| Item | Target |
| --- | --- |
| Generated `index.html` | ~175 KB before gzip |
| Runtime dependencies | Three.js r128 from jsDelivr only |
| Cube geometry | 26 cubelet groups, 54 stickers |
| Draw calls | Stable per frame; no per-move scene rebuilds |
| Shadow map | 2048², PCF soft shadows |
| Environment map | One generated 1024×512 equirectangular texture, PMREM once |
| Render loop | `requestAnimationFrame`, one `renderer.render` per frame |
| Pixel ratio | 1.75 on narrow screens, 2 on desktop, capped |

The app does not ship a bundler, minifier, or asset pipeline. The generated file is large
because the vendor solver and app source are inlined; gzip/brotli on GitHub Pages reduces
the transfer size substantially.

## Frame loop

`animate()` does four things:

1. `updateCinemaCamera(now)` — only active during a cinematic camera move.
2. `controls.update()` — OrbitControls damping/orbit.
3. `updateStickerGlow(dt)` — only active while stickers are glowing.
4. `updateConfetti(dt)` and `renderer.render(scene, camera)`.

The loop is allocation-light by design. The camera director reuses a scratch vector;
confetti is a bounded array; the layer glow only updates the stickers in its set.

## Scene costs

- Each cubelet has a body mesh and up to three sticker meshes. Stickers use per-sticker
  materials so the glow can animate independently; the shader program is shared.
- The environment map and PMREM are generated once at boot.
- Shadows are enabled for the key light; the shadow floor is a single plane.
- Confetti is created only on victory and removed when it expires.
- There are no textures, fonts, or audio files to download at runtime.

## Solver warm-up

The first solve calls `Cube.initSolver()` in a Blob worker. That builds the two-phase
pruning tables and can take a few seconds on a slow device. The UI shows the solver overlay
and keeps the render loop alive. Later solves reuse the worker. If workers are blocked, the
same work happens on the main thread; use `?noworker` to test that path.

## Mobile considerations

- Pixel ratio is capped at 1.75 below 720 px to avoid fill-rate blowups.
- The camera refits for portrait aspect ratios so the cube does not clip.
- The dock and stats reflow; there is no separate mobile scene.
- Low-power mode can throttle `requestAnimationFrame`; the app does not compensate by
  skipping frames or lowering shadow quality.

## Profiling

- Chrome DevTools → Performance: record a scramble and a solve; look for long tasks,
  layout thrash, and excessive GC.
- Chrome DevTools → Rendering: check paint and layer counts.
- `?debug` exposes `window.__cubeLab.state()` for a quick sanity check.
- `?noworker` isolates solver-worker cost from the render loop.

## Optimization checklist

- Avoid new per-frame allocations in `animate()` and the camera director.
- Reuse geometries and materials; do not rebuild the cube on a move.
- Keep the confetti array bounded.
- Do not add a second render pass, post-processing stack, or heavy texture set without
  measuring.
- Test on a low-end phone before claiming a performance improvement.
- Re-run the self-test and the manual matrix after any rendering change.

## Known bottlenecks

- First solver warm-up (worker or main thread).
- WebGL context creation and PMREM generation at boot.
- 2048² shadow map on integrated GPUs.
- 54 physical materials and per-sticker glow updates on very low-end devices.
- Large generated HTML parse time on slow connections; gzip/brotli helps.

Measure before optimizing. The current app is intentionally small; the biggest wins are
usually in avoiding extra draw calls and keeping the render loop free of allocations.
