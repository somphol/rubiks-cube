# Roadmap

This is a direction, not a promise. Priorities can change based on reports, maintenance
time, and whether a change fits the static, single-file design.

## Near term

- **Browser CI.** Add a headless browser job that runs `?selftest`, not just the build
  check.
- **Cube-state text alternative.** Expose the current facelets and move history in a form
  a screen reader can read, without turning the UI into a spreadsheet.
- **Mobile performance.** Measure low-end devices and consider an adaptive quality switch
  (shadow map, pixel ratio) instead of assuming desktop performance.
- **Solver coverage.** Add more mixed-state cases to the self-test and verify the
  main-thread fallback in CI.
- **Docs upkeep.** Keep the architecture, testing, and release docs current with each
  release.

## Later

- **Keyboard-only cube entry.** A text field for move sequences (for example `R U R' U'`)
  with validation and playback.
- **Replay/share.** Encode a scramble or solution in the URL so a state can be shared
  without a backend.
- **More cube sizes.** A 2×2 or 4×4 mode would need a different model, solver, and visual
  mapping; treat it as a separate project rather than a small toggle.
- **Guided tutorials.** A beginner-method walkthrough layered on the existing solver.
- **Theme presets.** A small set of stage palettes that preserve contrast and face colours.

## Out of scope

- Accounts, cloud sync, leaderboards, or multiplayer.
- Analytics, advertising, or tracking.
- A server-rendered or backend-dependent version.
- Arbitrary file import/export or image uploads.
- A heavy framework or bundler that makes static hosting harder.

## How to propose

Open a [feature request](https://github.com/somphol/rubiks-cube/issues/new?template=feature_request.yml)
with the problem, the proposed behaviour, and how it fits the constraints in
[CONTRIBUTING.md](../CONTRIBUTING.md). Small, well-scoped changes are easiest to land.

## Status

The project is maintained on a best-effort basis. The current release is the latest commit
on `main`, deployed to <https://somphol.github.io/rubiks-cube/>.
