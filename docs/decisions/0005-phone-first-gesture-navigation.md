# 0005 — Phone-first, gesture-driven, instant navigation

- Date: 2026-11-23 (recorded from the existing implementation)
- Status: accepted

## Context

Tracker is used almost entirely on a phone, often one-handed and sometimes offline or on a slow connection. Traditional web patterns — pages, hover menus, blocking confirmations, waiting for the server before showing a result — make every small action feel expensive. The product's value is checking off an episode or seeing what's next in seconds, so interaction cost is the main constraint, not feature breadth.

## Decision

**Phone-first UX, gestures as the primary interface, and near-instant navigation are goal number one.** Concretely, as implemented in the code:

- One `max-w-xl` column with a bottom tab bar in thumb reach, 44 px+ touch targets, safe-area insets, `text-[16px]` inputs (no iOS zoom), and no hover-dependent controls.
- Gestures carry the common actions: swipe a title row right/left to mark/undo, swipe an episode row right/left to mark up to/clear from here, drag the screen to switch tabs, drag from the left edge to go back, two-tap to remove. Drag transforms are written directly to the DOM to hold 60 fps on cheap devices.
- Navigation never costs a page load: tabs are client state, and the detail view uses `history.pushState` / `popstate` so the system back button works. The library renders from an in-memory store with optimistic writes; background metadata fills in later.
- 160 ms transitions only, undo toasts instead of blocking dialogs, and in-place micro-interactions (quick `+`, remembered filter) over extra screens.

Every gesture has a tap equivalent — gestures accelerate, they never gate an action.

## Consequences

- New features must be judged by "taps to complete" and "time to first feedback". If the honest answer is a new page or a network wait, the design is wrong for this app.
- Avoid hover-only affordances, modal wizards, multi-page flows and heavy animation. Desktop/tablet parity is secondary to the phone experience.
- Keeping both gesture and tap paths means more UI surface to maintain, and gesture logic is split between `ui.tsx` (`SwipeRow`) and `App.tsx` (screen/edge swipes) — changes must be made in both.
- Accessibility is non-negotiable: aria patterns, focus rings, reduced-motion support and tap fallbacks are part of this decision, not exceptions to it.
- See [06-ui-design.md](../06-ui-design.md) for the full visual and interaction specification.
