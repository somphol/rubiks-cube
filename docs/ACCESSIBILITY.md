# Accessibility

CubeLab is a visual 3D application, so accessibility is a matter of providing equivalent
paths and honest limits rather than claiming full parity.

## Goals

- Every non-pointer action has a keyboard path.
- Focus is visible and dialogs trap attention predictably.
- Status changes are announced without stealing focus.
- Motion can be reduced without removing functionality.
- Text and controls meet contrast expectations on the dark stage.

## Keyboard map

| Action | Input |
| --- | --- |
| Turn a face | `U` `D` `L` `R` `F` `B` |
| Prime turn | Hold `Shift` while pressing a face key |
| Undo | `Z` |
| Pause / resume playback (timed modes) | `Space` |
| Next move in Step mode | `Space` or `N` |
| Take camera control during Auto Solve | `Esc` |
| Close a dialog | `Esc` |

The face dock buttons are real `<button>` elements and are reachable by Tab. The canvas is
not a focus target; keyboard users use the dock or face keys.

## Focus and ARIA

- `:focus-visible` uses a 2 px cyan outline with an offset.
- The status pill is `aria-live="polite"`.
- The solve banner is `role="status"` and `aria-live="polite"`.
- The toast is `role="status"` and `aria-live="polite"`.
- Victory and help dialogs use `role="dialog"`, `aria-modal="true"`, and labelled titles.
- Icon-only buttons have `aria-label` and `title`.
- The canvas has an `aria-label` describing it as an interactive 3D Rubik's Cube.
- The solver overlay is marked `aria-hidden` when hidden.

When adding a control, give it a visible label or an `aria-label`, and keep its disabled
state meaningful.

## Reduced motion

`prefers-reduced-motion: reduce`:

- Skips cinematic camera choreography; the solve still plays.
- Shortens turn durations.
- Collapses CSS animations and transitions.

The reduced-motion path must remain fully functional: Auto Solve, Step mode, Take control,
and the victory flow all work without camera motion.

## Colour and contrast

- The interface uses light text on dark glass; primary controls use dark text on cyan.
- Face colours are saturated and distinguishable, but colour alone is not the only cue:
  the move log, banner, and dock use letters and positions.
- The layer glow brightens a turning layer but does not rely on hue alone; the turn itself
  is visible.
- Avoid lowering opacity on essential text below the current muted values.

## Screen reader notes and known gaps

- The cube state is not exposed as a table or text description. A screen reader user can
  operate face turns and read the move log, but cannot inspect sticker colours.
- The 3D canvas is not keyboard-focusable; the dock and face keys are the alternative.
- The move log is a visual list of chips; it is not a structured table with row/column
  semantics.
- The timer updates visually; it is not announced continuously (which would be noisy).
- The victory dialog is announced, but the confetti and orbit are decorative.

Improving the cube-state alternative (for example, a facelet summary or a copyable state
string) is a worthwhile future change. Do not claim full screen-reader parity until that
exists.

## Testing checklist

- Complete a scramble, solve, and reset using only the keyboard.
- Tab through the dock and confirm focus is always visible.
- Open and close both dialogs with `Esc`.
- Enable reduced motion and run Auto Solve and Step mode.
- Zoom to 200% and check that the dock and banner do not clip essential text.
- Test with VoiceOver (macOS/Safari) or NVDA (Windows/Firefox) for the status, banner,
  dialogs, and buttons.
- Test on a phone with a screen reader and touch exploration.

## How to improve

- Add a text alternative for the current cube state and the move history.
- Add a keyboard shortcut help panel that is reachable without a pointer.
- Audit contrast after any palette change.
- Keep the reduced-motion path covered by the manual matrix in [TESTING.md](TESTING.md).
