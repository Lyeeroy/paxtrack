# Architecture decision records

Short, dated records of decisions that are already embodied in the code. Each explains **why**, so a future AI does not "fix" the design by reversing it.

When you make a new architectural choice, add `NNNN-short-title.md` (next number, zero-padded to four digits), link it here, and use this shape:

```markdown
# NNNN — Title

- Date: YYYY-MM-DD
- Status: accepted | superseded by ADR-NNNN

## Context
What problem existed.

## Decision
What was chosen.

## Consequences
What it enables and what it costs.
```

Write about *why*, not *what* — the code already says what. Update the status to `superseded` and link the new ADR rather than deleting an old one.

## Index

- [0001 — Local-first IndexedDB cache](./0001-local-first-indexeddb.md) — the library lives in the browser first, not in a server.
- [0002 — Last-write-wins, pull-before-push sync](./0002-last-write-wins-sync.md) — how two devices converge without a central arbiter.
- [0003 — Username auth mode as the default](./0003-username-auth-mode.md) — no email required, derived non-deliverable address.
- [0004 — Previews and soft-delete tombstones](./0004-previews-and-tombstones.md) — why deleted items stay in the map and search results are not persisted on open.
- [0005 — Phone-first, gesture-driven, instant navigation](./0005-phone-first-gesture-navigation.md) — why interaction cost outranks extra features and desktop conventions.
- [0006 — Info bottom sheet on the detail view](./0006-info-bottom-sheet.md) — why this one modal pattern is allowed, and the constraints it keeps.
- [0007 — Sheet interaction contract](./0007-sheet-interaction-contract.md) — the original hand-written sheet's dismissal, detents, drag, focus and motion rules; implementation details superseded by [0013](./0013-drawer-replaces-sheet.md).
- [0008 — Browse uses native scroll-snap, not a JS pager](./0008-native-scroll-snap-pager.md) — why momentum is the browser's job and `<main>` must allow `pan-x`; do not reintroduce a JS fling.
- [0009 — Deliberate bottom-pull pagination](./0009-deliberate-bottom-pull-pagination.md) — why auto-load was removed, how the pull takes over, and the 5-page Browse cap with skeleton catch-up.
- [0010 — Balanced Browse pagination](./0010-balanced-browse-pagination.md) — why pages load in lockstep across all five columns and why cross-page TMDB duplicates are kept.
- [0011 — Pull down opens the detail info sheet](./0011-pull-down-opens-detail-sheet.md) — reusing the pull gesture inverted, with the indicator layered between detail and sheet.
- [0012 — Filtered Discover keeps its own cache lane](./0012-filtered-discover.md) — server-side filters, a per-filter page cache, and why Discover can end shorter than the other columns.
- [0013 — shadcn Drawer replaces the in-house Sheet](./0013-drawer-replaces-sheet.md) — why the modal now delegates gestures, snap points and focus to Base UI.
- [0014 — Discover filter history in localStorage](./0014-local-discover-filter-history.md) — the Discover drawer's History button, auto-recorded filter sets and starred entries.
