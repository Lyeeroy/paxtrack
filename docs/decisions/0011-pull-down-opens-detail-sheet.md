# 0011 — Pull down opens the detail info sheet

- Date: 2026-11-26
- Status: accepted

## Context

The detail view already exposes its info sheet through the poster/title buttons. Phone-first navigation should also let a user reach it with the same physical gesture used for pagination, but inverted: a deliberate downward pull when the detail is already at its top. Building a second gesture implementation would duplicate the scroll takeover, damping, ring, haptics, spring-back, click suppression and reduced-motion handling — the exact "replicant" code the project avoids.

## Decision

- Reuse `PullUpToLoad` with `direction="down"`. It claims only a mostly vertical, single-finger drag after 8 px of slop while the detail scroll container is at `scrollTop ≈ 0`, then lifts the content at 0.55× finger travel and fills the same 44 px accent ring over 96 px. Release past the threshold calls `onOpenInfo()`; below it the content springs back over 180 ms.
- The detail passes its scroll container by ref, because the gesture target is the inner content wrapper and the document scroll position never changes here.
- The indicator uses a top variant (`.pull-indicator-top`, `z-42`): below the sticky header, above the detail view (`z-40`) and below the sheet (`z-45`). Aria labels say “Pull to open details” / “Release to open details”.
- While `infoOpen` is true the pull is disabled and reset, so it cannot double-open or leave a spinner behind the sheet. The sheet keeps its own drag-to-dismiss/detent contract from ADR 0007; the poster/title buttons remain the non-gesture path.

## Consequences

- One gesture engine serves both directions, so motion, haptics, reduced motion and accessibility stay consistent.
- The pull is an accelerator, not a gate: the poster/title tap still opens the sheet, and the sheet's close button dismisses it.
- The gesture is limited to the detail scroll container; scrolling down from the top stays native, and a pull that turns horizontal is handed back to the edge-back/swipe handlers.
- iOS's older navbar rubber-banding can still show during the takeover; this needs a real-device check.
