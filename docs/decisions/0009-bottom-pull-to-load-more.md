# 0009 — Bottom pull to load more in Search

- Date: 2026-11-25
- Status: accepted

## Context

Search results used an `IntersectionObserver` with a 240 px `rootMargin` to load the next TMDB page automatically. That means the list grows before the user ever reaches the bottom, and pagination has no deliberate, tactile affordance. The product is phone-first ([ADR 0005](./0005-phone-first-gesture-navigation.md)), so the load-more action should be a direct gesture with clear progress rather than something that happens to the user.

The requested interaction: at the very bottom, keep pulling; the content gives a little and a circular indicator fills with the pull; releasing past the threshold loads the next page. Critically, scroll momentum that merely *ends* at the bottom must not trigger it — the user must start a new touch there.

## Decision

**Auto-load on scroll is replaced by a bottom-pull gesture; the existing "Load more" button stays as the tap fallback.**

`PullToLoad.tsx` is a reusable wrapper with these mechanics, taken from established pull-to-refresh implementations:

- **Arming:** `touchstart` must find the document actually at its bottom (`scrollTop + innerHeight >= scrollHeight - 2`) and at least 140 ms after the last `scroll` event, which excludes a fling that carried the user there. A single finger and 8 px of downward movement arm the gesture. `touchmove` uses a non-passive listener and calls `preventDefault()` only while armed, so ordinary scrolling and vertical gestures elsewhere are unaffected.
- **Damped travel:** content translates by `MAX_PULL × (1 − e^(−DAMPING·dy / MAX_PULL))` with `MAX_PULL = 140`, `DAMPING = 0.6` (the web pull-to-refresh hook's exponential tension). It yields ~56 px at the 120 px trigger and keeps resisting beyond that, instead of following the finger 1:1 or snapping to a hard stop.
- **Circle:** Android `SwipeRefreshLayout` scaling. Progress `p = dy / 120`; `adjusted = max(p − 0.4, 0) × 5/3`; the arc fills `min(0.8, adjusted × 0.8)` of the circle (`pathLength = 100`, `strokeDashoffset = 100 − arc × 100`, round cap, rotated −90°). Opacity and scale ramp from 30%/0.6 to 100%/1. At the trigger the arc is 80% full, matching `MAX_PROGRESS_ANGLE = 0.8`; past it the circle becomes a spinner and is held while loading.
- **Release:** below the 120 px threshold the wrapper springs back over 180 ms. At/above it, `onTrigger()` calls `loadMore()` and the held spinner collapses when the caller's `busy` prop turns false (success or failure). Reduced motion collapses instantly.
- The indicator is fixed above the tab bar and outside the translated wrapper, so it stays anchored; transforms are written directly to DOM nodes, with React state used only for the spinner phase.

## Consequences

- A page of results is fetched only when the user deliberately asks, so they can actually reach the end of the current list; the button keeps the action accessible without the gesture.
- Removing the observer means a user who never pulls will see only the first page. That is intentional: the gesture and button are the discovery path.
- Because the document (not a nested element) is the scroller, the bottom check uses `document.scrollingElement`; keeping the global `overscroll-behavior: none` prevents the browser's own refresh/bounce from competing with the custom circle.
- Future changes must keep the momentum guard and the touch-slop gate: without them a fast fling to the end of the list can accidentally load the next page. The constants above are a tuned gesture contract, not arbitrary values — verify on a real phone before changing them.
- See [06-ui-design.md](../06-ui-design.md) for the UX description.
