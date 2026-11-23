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
