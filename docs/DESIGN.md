# Design

CubeLab is a small product with a deliberate look: a dark studio stage, a glossy physical
cube, and glass controls that stay out of the cube's way. The design notes below explain
the choices so they can be extended without turning the app into a different product.

## Principles

1. **The cube is the interface.** Controls orbit around it; they never cover the face
   being turned for long.
2. **Clarity beats spectacle.** Motion and camera work should make the solve easier to
   follow, not harder.
3. **One calm hero view.** The cinematic camera stays put when the working face is already
   readable.
4. **Local and immediate.** No loading screens except the solver warm-up. No accounts, no
   remote state.
5. **Graceful on a phone.** The dock reflows, the camera refits, and the layout respects
   safe areas.

## Visual system

- **Stage:** near-black slate gradient with a soft aurora, a faint grid, and a vignette.
- **Cube:** rounded black body, glossy colour stickers, soft key/fill/rim lights, contact
  shadow, and a generated environment map.
- **Glass:** dark translucent panels with a 1 px light border, large blur, and a subtle
  inner highlight. Used for stats, history, the dock, and dialogs.
- **Accents:** cyan (`#5ee7f5`) and indigo (`#818cf8`) for primary actions and progress;
  amber for Scramble; violet for playback/pause; face colours for the move buttons and
  move-log chips.
- **Type:** system UI sans for labels, monospace for moves, timers, and numeric stats.
- **Radii:** 26 px for large panels, 18 px for cards, 11–13 px for controls.

Face colours are fixed in `FACE_COLORS` in `src/app.js` and mirrored as CSS variables for
the dock and move log. Keep them consistent; they are the cube's identity.

## Layout

- **Desktop:** stats top-left, move log top-right, cube centre, banner + speed row + dock
  at the bottom.
- **Tablet:** the move log drops out; the dock becomes a two-row layout.
- **Phone:** stats span the top, the face pad sits above the action row, labels shorten,
  and the hint disappears.
- **Cinematic mode:** top bar, stats, history, speed row, dock, and hint are hidden; only
  the cube, banner, and the top-right Pause/Next + Take control controls remain.

The cube is centred in the viewport. The banner and dock live in normal document flow
inside a fixed bottom container so they do not jump when the history grows.

## Interaction

- **Drag a sticker** to turn that row or column; the drag direction is projected into
  screen space.
- **Drag empty space** to orbit; **scroll or pinch** to zoom.
- **Face keys** (`U`, `D`, `L`, `R`, `F`, `B`) turn a face; hold `Shift` for prime.
- **Dock buttons** mirror every face turn.
- **Scramble**, **Solve**, **Auto Solve**, **Undo**, and **Reset** are explicit actions.
- **Step mode** makes the solve conversational: show the move, wait, then turn.

Direct manipulation is the primary path. The dock and keyboard are equivalent, not
second-class.

## Motion

- Turns use cubic easing over the selected speed (150/330/650 ms).
- Camera moves use spherical interpolation over 260–760 ms, depending on speed.
- The cinematic intro is 900 ms; the outro is 1000 ms and pulls back slightly.
- Confetti and the victory orbit are short and celebratory, not a loop.
- `prefers-reduced-motion` removes camera choreography, reduces turn duration, and keeps
  the solve usable.

Avoid springy overshoot, long eases, and camera moves that continue after the turn has
finished. The cube should feel physical, not floaty.

## Cinematic Auto Solve

- **Intro:** return to the hero three-quarter view and show `Ready`.
- **Per move:** if the working face is readable, stay put. If not, move to that face's
  three-quarter view, then perform the turn.
- **Layer glow:** the nine stickers of the turning layer brighten in their own colour with
  a slight cyan tint and scale. It is a cue, not a light show.
- **Banner:** `AUTO SOLVE · n/N`, the current move, the next moves, and a progress bar.
- **Finish:** pull back, then hand off to the existing victory orbit and confetti.
- **Control:** dragging or pressing `Esc` returns the camera without stopping the solve.

The director must never hide the cube behind the banner or spin through the cube. Keep the
hero view stable; re-frame only when necessary.

## Step mode

- The solve loop shows the move before it happens.
- The banner reads `STEP · n/N` and `Click Next · then ...`.
- The Pause button becomes **Next** (skip icon) in both the normal speed row and the
  cinematic controls.
- `Space` and `N` advance one move.
- Switching to a timed speed releases the gate and auto-plays the rest.
- Reset and Scramble release the gate and cancel cleanly.

Step mode is a teaching mode. Favour legibility over speed: keep the move visible, keep
the camera framing, and do not auto-advance.

## Sound

All audio is synthesized with the Web Audio API: a short filtered noise tick plus a low
sine body per move, and a five-note chime on victory. There are no audio files. Sound is
optional and persists; the first user gesture resumes the audio context.

## What to avoid

- Adding a framework or a build step that makes the project harder to host statically.
- Covering the cube with permanent panels.
- Per-move camera whip-pans or constant auto-rotation during a solve.
- Neon gradients, drop shadows, or glow that compete with the cube colours.
- New runtime assets (fonts, images, audio) when a generated or system asset will do.
- Motion that ignores `prefers-reduced-motion`.
