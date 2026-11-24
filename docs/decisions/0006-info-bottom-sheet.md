# 0006 — Info bottom sheet on the detail view

- Date: 2026-11-23
- Status: accepted; interaction details amended 2026-11-24 by [ADR 0007](./0007-sheet-interaction-contract.md)

## Context

The detail view previously showed only identity and watch state (poster, title, type, year, status, progress, episodes). Users wanted more about the title itself — synopsis, genre, rating, runtime — reachable from the poster or name. The app's session-only title metadata is fetched from the existing TMDB title route, so there is no offline copy of those fields and no place to put them on the current detail layout without pushing the actions and episode list down the screen.

ADR 0005 and `06-ui-design.md` prefer in-place interactions and discourage modal wizards and extra pages. A separate info page or a long always-expanded block would both fail that guideline in different ways: one costs a navigation, the other buries the primary action (marking episodes).

## Decision

Tapping the detail hero poster or title opens a **bottom sheet** with the extra information. It is a deliberate, narrow exception to the "no modal" preference, requested explicitly for this feature. To keep the phone-first guarantees:

- local facts render instantly; TMDB extras fill in from the existing `/api/tmdb/title` response or a deduplicated on-demand fetch, cached in memory for the session only;
- the sheet is dismissible by dragging it down from anywhere on the panel (72 px, DOM-written transform; upward drags still scroll the content), by tapping the backdrop, and by Escape; closing animates the panel all the way off-screen (160 ms) instead of unmounting it instantly;
- it is on the history stack, so the first system back / edge swipe closes the sheet and the second closes the detail view;
- it uses the existing surface tokens, safe-area insets, 160 ms motion and reduced-motion rule, with `role="dialog"`, focus management and a focus trap.

No new data is persisted, so sync, last-write-wins, backups and the `Item` shape are untouched.

## Consequences

- The detail view can grow richer without moving the watch action or episode list.
- There is now a second overlay pattern in the app; future UI should reuse `Sheet` from `ui.tsx` rather than inventing another modal, and should not take this exception as permission for multi-step modal flows.
- Descriptive metadata is unavailable offline on a cold session (local facts still show), and opening the sheet may make one background request.

## Amendment — 2026-11-24

The first implementation had no visible close button, grabbed the drag anywhere on the panel (so the end of a downward content scroll could dismiss it), and drove the exit from parent timers and a "closing" flag. That felt unpredictable and let the history entry drift from the animation. [ADR 0007](./0007-sheet-interaction-contract.md) replaces those details:

- `Sheet` is self-contained; the parent owns only `open` and the history entry.
- Drag starts from the sheet chrome, or from content only when it is scrolled to the top (120 ms scroll lock). Upward and horizontal gestures stay with the content.
- Dismiss at 25% of the panel height (clamped 64–180 px) or a downward flick over 0.35 px/ms.
- A 44×44 close button, backdrop tap, Escape and system back all dismiss.
- Motion is 260 ms in / 200 ms out with `cubic-bezier(0.32, 0.72, 0, 1)`, the documented exception to the 160 ms rule. Reduced motion uses 0 ms.
- Focus is trapped and restored; the detail behind is `aria-hidden`, the main tab content is `inert`, and body scroll is locked.

The rest of this ADR still stands: the sheet is a narrow, single-purpose exception, and future overlays should reuse it.
