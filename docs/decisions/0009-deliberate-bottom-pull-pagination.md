# 0009 — Deliberate bottom-pull pagination

- Date: 2026-11-26
- Status: accepted

## Context

Search results used an `IntersectionObserver` sentinel 240 px before the bottom to fetch the next page automatically. That made the list grow while the user was still reading, and returning to a cached tab could trigger another page without a deliberate action. Browse had no pagination at all: each of its five columns loaded a single 20-title page, so a column simply ended after roughly one screen.

The product is phone-first. Pagination should feel like a physical continuation of the scroll, and every gesture still needs a tap/keyboard path. A previous pull implementation was reverted; this decision records a fresh design rather than reviving that code.

## Decision

- A shared `PullUpToLoad` component owns a **deliberate upward pull at the document bottom**. The page must already be at the bottom; continuing the drag lifts the content at 0.55× finger travel (max 120 px) and fills a 44 px accent ring over 96 px. Release past the threshold loads the next page; below it, the page springs back over 180 ms. Haptics fire when the ring is full.
- The gesture uses a **native `touchmove` listener with `passive: false`** because React touch handlers are passive and cannot prevent scrolling. It claims only for a mostly vertical, single-finger drag, after 8 px of slop, and rechecks the bottom on every move. It aborts on horizontal drift, `touchcancel`, tab hide or page hide.
- The indicator is **portaled to `document.body`**; a transformed ancestor would otherwise become its containing block. Browse's sticky dots live inside the transformed wrapper, so they fade while pulling instead of travelling with the page.
- **Search results** replace the automatic sentinel with the pull. The "Load more" button remains the tap/keyboard fallback.
- **Browse** loads page 1 for all five columns. A pull loads the active column's next page and prefetches the next column. Switching to a column behind the deepest one fetches the missing pages in parallel and renders skeleton rows in the gap, so the column never looks blank. Each column is capped at **5 pages / 100 titles**; at the cap or TMDB `totalPages` the pull disables and the column shows “No more in {label}”. Each active column also has a “Load more” pill.
- Pages are stored in **slots keyed by page number** and flattened in order, so late responses cannot append out of order or overwrite a whole column. One in-flight promise per `category:page` dedupes pulls, prefetch and catch-up.

## Consequences

- Automatic pagination is gone on purpose. A user can reach the end of a page and stop without new rows appearing; they must pull or tap. This is the intended trade for predictability and less wasted data.
- The pull is an accelerator, not a gate: the Load more controls work with a keyboard, a screen reader and a mouse. On short pages where the search field is still visible, the pull stays disabled and the button is the path, so content never slides under the input.
- The 5-page cap bounds catch-up to four extra pages (80 rows) and keeps the page height, memory and skeleton work predictable. Columns that lag are filled with skeletons rather than a blank list.
- iOS versions before 16 still rubber-band despite `overscroll-behavior: none`; the takeover needs a real-device check there. Desktop/trackpad users use the button.
- Do not restore the old `IntersectionObserver` sentinel or revive the reverted pull code. The interaction contract is documented in `06-ui-design.md` and the traps in `05-gotchas.md`.
