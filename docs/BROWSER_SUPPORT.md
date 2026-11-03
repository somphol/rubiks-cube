# Browser support

CubeLab targets current evergreen browsers on desktop and mobile. There is no legacy
build, polyfill bundle, or server-side rendering.

## Supported

| Browser | Desktop | Mobile | Notes |
| --- | :---: | :---: | --- |
| Chrome / Edge (current) | ✅ | ✅ | Reference implementation |
| Firefox (current) | ✅ | ✅ | WebGL and worker paths supported |
| Safari (current) | ✅ | ✅ | iOS may throttle WebGL in low-power mode |
| Older evergreen versions | ⚠️ | ⚠️ | May work; not tested |

Internet Explorer is not supported.

## Required

- WebGL 1 or 2. Without it, the app shows a fatal error instead of a broken canvas.
- A modern JavaScript engine (ES2020+): `Promise`, `Set`, `Map`, `Array.from`, nullish
  coalescing, and the standard DOM APIs. There is no framework or module loader at runtime.
- CSS custom properties, flexbox, grid, and `env(safe-area-inset-*)`.
- `matchMedia` for the responsive camera and reduced-motion checks.

## Optional, with fallbacks

| Feature | Fallback |
| --- | --- |
| Blob Web Worker | Solver initializes on the main thread behind the overlay; `?noworker` forces this |
| `localStorage` | Preferences and best are not persisted; the app still works |
| Web Audio API | No clicks or chime; the app still works |
| `navigator.clipboard` | Copy falls back to a hidden textarea + `execCommand` |
| `navigator.vibrate` | No haptic feedback |
| `backdrop-filter` | Panels remain opaque enough to read |
| `color-mix()` | Face accents fall back to the base colour |
| `prefers-reduced-motion` | Not supported means normal motion is used |

## CDN dependency

Three.js r128, `OrbitControls`, and `RoundedBoxGeometry` load from jsDelivr:

```text
https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js
https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/geometries/RoundedBoxGeometry.js
```

If the CDN is blocked, the app shows a fatal error explaining that Three.js could not be
loaded. There is no bundled copy. The cube model and solver are inlined, so they do not
need the network.

## Known limitations

- `file://` may block Blob workers in some browsers; the main-thread fallback handles it.
- iOS low-power mode and some Android WebViews can throttle `requestAnimationFrame` or
  WebGL; the app may look choppy but remains usable.
- Very old Safari versions lack `color-mix()` and `backdrop-filter`; the layout and text
  remain readable.
- The solver worker warms up pruning tables on first use; a slow device may show the
  overlay for several seconds.
- The app does not adapt render quality to the device; pixel ratio is capped but shadows
  and antialiasing stay enabled.

## Testing notes

Check the matrix in [TESTING.md](TESTING.md) on at least one Chromium browser, Safari, and
Firefox. For mobile, check both portrait and landscape, and test touch drag plus pinch
zoom. If a report depends on a worker, include whether `?noworker` changes the result.
