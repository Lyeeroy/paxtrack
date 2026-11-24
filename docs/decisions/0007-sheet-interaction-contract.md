# 0007 — Sheet interaction contract

- Date: 2026-11-24
- Status: accepted

## Context

The detail info sheet ([ADR 0006](./0006-info-bottom-sheet.md)) is the app's only modal, and its close path had accumulated in the parent: a `closing` flag, a timer, an "already animated" ref, and a `popstate` branch that tried to keep the animation and history in sync. Closing felt laggy and could leave the sheet mounted, fire history twice, or fight the content scroll. There was no visible close button, and dragging from anywhere meant the end of a downward scroll could dismiss the sheet.

The app is phone-first ([ADR 0005](./0005-phone-first-gesture-navigation.md)): a sheet must feel physical and leave immediately when dismissed, while still supporting system back and a tap fallback.

## Decision

`Sheet` in `src/components/ui.tsx` is a self-contained primitive. The parent passes `open`, `onClose`, `title`, optional `subtitle`/`footer`/`maxHeight`, and children; it owns the history entry but no timers or animation state.

- **Exit starts immediately.** Dismissal begins the roll-down and calls `onClose` in the same tick. The parent flips `open`/pops the history entry; the sheet does not wait for an animation before updating history. Duplicate closes are guarded.
- **Drag ownership is explicit.** The header is always draggable. Content is draggable only when `scrollTop === 0` and at least 120 ms after the last scroll. Upward or horizontal movement releases the gesture to the content, so scrolling back up never dismisses the sheet.
- **Threshold is proportional.** Dismiss when the panel has moved 25% of its height (clamped 64–180 px) or when downward velocity exceeds 0.35 px/ms. Otherwise snap back over 200 ms.
- **Two detents, one gesture each.** The default height is content-driven up to `maxHeight` (78dvh); dragging up from the header expands the panel to the top of the screen, and dragging down from expanded returns it to the default height. A detent commits after 25% of the possible travel (minimum 48 px) or a 0.35 px/ms flick, then animates the height over 200 ms. Upward gestures from content stay with scrolling; a new sheet always opens collapsed.
- **Every dismissal path exists.** Drag, 44×44 close button, backdrop tap, Escape and system back. A drag never leaves a click-through.
- **Modal semantics.** Portal to `document.body`, `role="dialog"`/`aria-modal`, labelled by the title, focus moved into the sheet, Tab trapped, focus restored on close, background `aria-hidden`/`inert`, body scroll locked.
- **Motion is a documented exception.** 260 ms open, 200 ms close/snap, `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-sheet`). A sheet is a physical surface; 160 ms is for in-page transitions. Reduced motion uses 0 ms for WAAPI and 1 ms for the CSS entrance.

## Consequences

- A parent cannot accidentally desynchronise the animation and history, and future sheets get the same behaviour for free.
- The sheet has more moving parts (the drag/scroll handshake and the detent resize) but no React state during the drag; transforms, panel height and scrim opacity are written directly to the DOM and committed to React state only when the gesture ends. Detent changes animate height (one layout per frame for 200 ms) rather than transform — acceptable for a deliberate, infrequent motion, and still covered by reduced-motion.
- Only one sheet is supported at a time; body scroll locking and focus trapping assume a single modal. If a second overlay is ever needed, layer it above the sheet rather than nesting two `Sheet`s.
- The 260/200 ms values are a deliberate exception to the 160 ms rule; keep `SHEET_*` in `ui.tsx` and `--ease-sheet`/`.anim-sheet` in `globals.css` in sync.
