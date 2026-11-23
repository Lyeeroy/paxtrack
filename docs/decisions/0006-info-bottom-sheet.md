# 0006 — Info bottom sheet on the detail view

- Date: 2026-11-23
- Status: accepted

## Context

The detail view previously showed only identity and watch state (poster, title, type, year, status, progress, episodes). Users wanted more about the title itself — synopsis, genre, rating, runtime — reachable from the poster or name. The app's session-only title metadata is fetched from the existing TMDB title route, so there is no offline copy of those fields and no place to put them on the current detail layout without pushing the actions and episode list down the screen.

ADR 0005 and `06-ui-design.md` prefer in-place interactions and discourage modal wizards and extra pages. A separate info page or a long always-expanded block would both fail that guideline in different ways: one costs a navigation, the other buries the primary action (marking episodes).

## Decision

Tapping the detail hero poster or title opens a **bottom sheet** with the extra information. It is a deliberate, narrow exception to the "no modal" preference, requested explicitly for this feature. To keep the phone-first guarantees:

- local facts render instantly; TMDB extras fill in from the existing `/api/tmdb/title` response or a deduplicated on-demand fetch, cached in memory for the session only;
- the sheet is dismissible by dragging the handle down (72 px, DOM-written transform), by tapping the backdrop, and by Escape;
- it is on the history stack, so the first system back / edge swipe closes the sheet and the second closes the detail view;
- it uses the existing surface tokens, safe-area insets, 160 ms motion and reduced-motion rule, with `role="dialog"`, focus management and a focus trap.

No new data is persisted, so sync, last-write-wins, backups and the `Item` shape are untouched.

## Consequences

- The detail view can grow richer without moving the watch action or episode list.
- There is now a second overlay pattern in the app; future UI should reuse `Sheet` from `ui.tsx` rather than inventing another modal, and should not take this exception as permission for multi-step modal flows.
- Descriptive metadata is unavailable offline on a cold session (local facts still show), and opening the sheet may make one background request.
