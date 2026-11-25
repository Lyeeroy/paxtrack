# 0008 — Browse uses native scroll-snap, not a JS pager

- Date: 2026-11-25
- Status: accepted

## Context

The Search tab's Browse carousel needs iOS-like momentum: the track must keep the finger's speed after release and then stop on one column. Native horizontal scrolling appeared unavailable because `App.tsx` set `touch-action: pan-y` on `<main>` for the screen-level tab swipe, and `touch-action` is **intersected** from the touched element up to the first scroll container — a descendant cannot re-enable a direction an ancestor disallows.

That conclusion was correct but led to the wrong fix. Roughly twenty attempts simulated the pager in `Browse.tsx` with pointer events: pointer capture, velocity windows, projection caps, CSS-ease durations, a cubic-Hermite glide, interruption commits, residual momentum, and finally a two-phase exponential-fling-plus-spring. Each fixed one symptom and broke another: fast flicks dulled on release, rapid repeated flicks re-targeted a stale page, or the animation started late. The root problem was the layer, not the constants — the browser owns momentum on the compositor and JS reimplements it on the main thread.

Research confirmed the native model:

- Native scrollers coast with platform friction, then snap with a curve that takes the live velocity; changing the fling friction is what produces an "uncanny valley" feel ([csswg-drafts #8549](https://github.com/w3c/csswg-drafts/issues/8549)).
- The one-column rule is a **limit on where the fling may snap**, not a steeper curve: iOS `.viewAligned(limitBehavior: .alwaysByOne)`, Android `PagerDefaults.flingBehavior(pagerSnapDistance = atMost(1))`. CSS equivalent: `scroll-snap-stop: always` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-stop)), which stops the scroll at the first snap point even on a fast flick.
- `touch-action` intersection is documented in [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action); `<main>` must allow `pan-x` for a horizontal scroller inside it to work at all.

## Decision

**The browser owns the Browse gesture. Do not reintroduce a JS pager.**

- `App.tsx` keeps `<main>` at `touchAction: "pan-x pan-y"` (not `pan-y`). Reverse this and native horizontal panning in Browse stops working.
- `Browse.tsx` is a plain scroll container: `overflow-x-auto`, `snap-x snap-mandatory`, `overscroll-x-contain`, `no-scrollbar` and `touch-action: pan-x pan-y`. Every column has `scroll-snap-align: start` and `scroll-snap-stop: always`; that combination is the one-column cap.
- A leading `w-4` spacer with `scroll-pl-4` reproduces the original left inset; a trailing `w-[18%]` spacer lets the last column align to the scrollport start. `GAP` must stay in sync with the column's `mr-2.5`.
- JS is limited to what the browser cannot express: `onScroll` derives the active page for the dots, dot taps call `scrollTo({ behavior: "smooth" })` (instant under `prefers-reduced-motion`), and a >70 px horizontal flick at scroll position 0/max delegates to the adjacent tab through `onOverscroll`.
- `scroll-snap-stop: always` can also trap a **programmatic** multi-column dot jump at the first snap point. Dot handlers relax it to `normal` for the duration of that scroll and restore it on `scrollend` (with a timeout fallback).
- Poster rows do not shift or tilt with position — the earlier `--px` parallax was removed; it added motion without value.

## Consequences

- Momentum, flick speed and interruption handling now come from the OS and feel native on cheap phones; there is no main-thread rAF loop, no velocity estimation, and no page-commit bookkeeping in `Browse.tsx`.
- `touch-action: pan-x pan-y` on `<main>` means other tabs' `overflow-x-auto` rows (Library/Detail chips) also become natively scrollable. That is desirable, but the screen-level tab swipe still works because there is no horizontally scrollable ancestor on those tabs for the browser to latch onto; `data-swipe` keeps Browse out of that handler.
- Edge tab switching at the first/last column remains a small JS touch handler because native rubber-banding cannot delegate navigation. It must stay threshold-based and horizontal-only so vertical scrolling is never stolen.
- Any future change that adds `pointermove`-driven transforms, pointer capture, or a custom fling to this component is a regression — it undoes the decision this ADR records. Verify changes on a real phone: one column per flick, natural coast, vertical page scroll over Browse, direct dot jumps, and tab change on edge flicks.
- See [05-gotchas.md](../05-gotchas.md) and [06-ui-design.md](../06-ui-design.md) for the constraints and UX spec.
