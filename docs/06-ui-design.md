# 06 — UI & UX design language

The visual style is a deliberate, restrained AMOLED dark theme. It is not a generic Tailwind starter. New screens and controls must look like they belong to this app: near-black surfaces, one green accent, dense rows, full-width pills, and small quiet type. When in doubt, copy the closest existing component in `src/components/ui.tsx` rather than inventing a new look.

## UX — goal number one

**This is a phone-first app. Gestures and near-instant navigation outrank extra features, desktop conventions and visual polish.** If a UX choice conflicts with any of that, the faster, thumbs-first path wins. See [ADR 0005](./decisions/0005-phone-first-gesture-navigation.md).

### 1. Phone first — not a desktop UI shrunk down

- One `max-w-xl` column with a fixed bottom tab bar inside thumb reach, with safe-area insets respected everywhere (`pb-[calc(env(safe-area-inset-bottom)+…)]`, `pt-[env(safe-area-inset-top)]`).
- Touch targets are at least 44 px: `h-11` icon buttons, `min-h-[52px]` episode rows, `h-12` primary actions. Compact `h-9` chips are acceptable only for dense secondary controls.
- **Nothing depends on hover.** `hover:` is a bonus (`hover:text-dim`); every action must be reachable by tap, and the main feedback is `active:` press state.
- Browser touch behaviour is deliberately tuned: `touch-action: manipulation`, `overscroll-behavior: none`, tap highlight removed, and text selection disabled globally except in inputs/textarea — no accidental selection or callout on long press.
- Inputs use `text-[16px]` on purpose: anything smaller makes iOS zoom on focus.
- The on-screen keyboard must open on a user gesture — that is why re-tapping the active Search tab calls `input.focus()` inside the click handler.

### 2. Gestures are the primary interface

| Gesture | Where | Result |
| --- | --- | --- |
| Swipe right | Title row | Mark next episode / movie watched |
| Swipe left | Title row | Undo last watched |
| Swipe right | Episode row | Mark everything up to here |
| Swipe left | Episode row | Clear from here |
| Drag horizontally | Screen (outside swipe rows/inputs) | Switch tabs |
| Drag past the first/last browse column | Search landing (Discover / In cinema) | Switch to the previous/next tab; the track is clamped so no blank space is revealed |
| Drag from left edge | Detail view | Go back / close detail |
| Tap twice | Remove button | Confirm removal |
| Tap active status | Detail status buttons | Remove from library (toast; detail stays open, pick a status to re-add). With watched progress, the first tap arms a 3 s confirmation instead |
| Tap active status | Search/Browse status chip | First tap arms "Tap again" (3 s), second removes from library (toast, row collapses) |
| Tap poster or title | Detail hero | Open the info bottom sheet |
| Drag up | Info sheet header | Expand the sheet to the top of the screen |
| Drag down | Expanded sheet header | Return the sheet to its default height |
| Drag down | Collapsed sheet chrome, or content at the top | Dismiss the info sheet (25% of panel or a fast flick) |

- The threshold is 72 px (70 px for tab and edge swipes). The sheet has its own proportional threshold: 25% of the panel height, clamped to 64–180 px, or a downward flick over 0.35 px/ms. Each gesture moves one detent — up from the header expands, down from expanded collapses, down from collapsed dismisses. Upward drags from content stay with scrolling. Drag transforms and detent heights are written straight to the DOM with no React re-render so motion stays cheap on budget phones; `haptic()` fires on completion.
- A revealed action is always mirrored by a tap control (the `+` button, status buttons, the back button). **Gestures accelerate; they never gate.** Every gesture must have a non-gesture path.
- Rows inside swipe containers keep `data-swipe` so the screen-level tab swipe ignores them; inputs and textareas are excluded the same way.

### 3. Fast navigation is a feature

- Tabs are React state, not routes — switching is instant, with no navigation or network.
- The detail view uses `window.history.pushState` / `popstate`, so it slides in immediately and the system back button / OS edge swipe closes it.
- The library renders synchronously from the in-memory store via `useSyncExternalStore` — no loading spinner. Writes are optimistic: memory updates now, IndexedDB follows.
- Episode data and metadata load in the background and fill in; "Loading episodes…" never blocks the rest of the screen.
- Search debounces 350 ms, caches results in memory, and discards stale responses with a sequence id. Results paginate: an `IntersectionObserver` sentinel 240 px before the bottom loads the next page automatically, with a "Load more" button as the tap/keyboard fallback. The cache holds accumulated pages per query, so returning to the tab restores every loaded result.
- With an empty query the Search tab shows `Browse`: five **vertical columns** — Discover, Trending, Popular, Top rated, In cinema — each a stacked list of poster rows. You swipe sideways to move between columns; the next column is clipped at the right edge (82 % width + 16 px gutter) as the affordance. The dots stay sticky just above the bottom tab bar (`bottom-[calc(env(safe-area-inset-bottom)+76px)]`, above the 66 px capsule) with a `bg-black/70` pill so they remain legible as titles scroll underneath; they jump to a column by tap. Tapping a title opens the same detail view as a search result.
- Small accelerations add up: the last library filter is remembered across tab switches, undo toasts reverse mistakes without leaving the screen, and the `+` button marks the next episode without opening Detail.
- Transitions are 160 ms. Anything longer feels sluggish on a phone. The bottom sheet is the one exception (260 ms in, 200 ms out) because it is a physical surface; see [ADR 0007](./decisions/0007-sheet-interaction-contract.md).

### Priority rule

When adding a feature, ask **how many taps, and how long until it responds?** If the answer is "a new page" or "wait for the network", redesign it as an in-place, optimistic, gestural interaction. Do not add hover-only controls, modal wizards or extra pages for things that can be a swipe plus a toast. Desktop/tablet parity is secondary.

## Design intent

- **Black first.** The base is pure `#000`, which switches off pixels on OLED displays and saves battery. This is stated in the comment at the top of `src/app/globals.css` — do not lighten it casually.
- **One accent.** Green (`#4ade80`) is used for active states, primary actions and positive feedback. Amber (`#fbbf24`) means "undo/clear", red (`#f87171`) means destructive. Nothing else competes.
- **Dense but calm.** Information is packed into short rows with generous horizontal padding and minimal vertical padding. Secondary text recedes via the `dim`/`faint` greys instead of borders or boxes.
- **Fast even on cheap phones.** System font only (no webfont), `content-visibility: auto` on rows (`.cv`), direct DOM writes during swipes, and short 160 ms animations (260 ms only for the sheet's entrance).

## Colour and type tokens

Declared once in `src/app/globals.css` under `@theme`; use the Tailwind names, never raw hex in components.

| Token | Hex | Role |
| --- | --- | --- |
| `bg` | `#000000` | Screen background (pure black) |
| `surface` | `#0c0c0d` | Grouped blocks, segmented buttons |
| `raised` | `#151517` | Toasts, tab bar, poster placeholder |
| `line` | `#1c1c1f` | Hairline borders and progress track |
| `fg` | `#ededee` | Primary text, active chip background |
| `dim` | `#8a8a90` | Secondary text and labels |
| `faint` | `#55555b` | Tertiary text, metadata, hints |
| `accent` | `#4ade80` | Primary action, selected state, progress |
| `warn` | `#fbbf24` | Undo / clear affordances |
| `danger` | `#f87171` | Remove confirmation |

Type is the system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). No custom font. The working scale:

| Size | Used for |
| --- | --- |
| `text-[26px]` semibold, tight tracking | Screen headers (`ScreenHeader`) |
| `text-xl` semibold | Detail title |
| `text-[15px]` medium | List row titles, settings labels |
| `text-[14px]` | Episode names |
| `text-[13px]` | Chips, toasts, status buttons |
| `text-xs` | Subtitles, hints, labels |
| `text-[11px]` uppercase, tracking-wider | Section headings and footnotes |
| `text-[10px]` uppercase, tracking-wider | `TypeTag` (Anime / TV / Movie) |

Numbers that align in columns use `tabular-nums` (counts, times, episode numbers). Icons are the inline SVG set in `ui.tsx`, 24×24 viewBox, 1.8 stroke, `currentColor`, `aria-hidden`.

## Layout skeleton

- The app is a single centred column: `mx-auto min-h-dvh max-w-xl bg-black`. Page gutters are consistently `px-4` (16 px).
- A fixed bottom tab bar floats over the content: a `rounded-full` capsule with `border border-line bg-raised/80 backdrop-blur-2xl`, a heavy drop shadow plus a subtle inset top highlight, and `pb-[calc(env(safe-area-inset-bottom)+10px)]`. Content gets matching bottom padding so nothing is hidden behind it. On phone widths (`< sm`) the capsule is full width inside a 12 px side gutter (`nav` has `px-3`) with tabs splitting it into equal `flex-1` slices; at `sm` and up it reverts to the content-sized, centred capsule (`w-full sm:w-auto`).
- Each tab button is `h-11 rounded-full` with an icon only — no visible label; the button's `aria-label` carries the name for assistive tech. On phone widths each `<li>` is `flex-1`, so the active `bg-accent/15` fills one equal slice of the full-width bar (~56–80 px wide depending on screen) instead of being a circle; at `sm` and up the `<li>` is `flex-none` and the button is `w-[72px]`, keeping the shrunken capsule a fixed size. All tabs are the same width, so switching tabs causes no layout shift. The green background is a single pill behind the buttons (`absolute` in the `ul`), not a per-tab class: `App.tsx` measures the active button's `offsetLeft`/`offsetWidth` in a layout effect and writes `transform`/`width` to the pill, so it **slides** between tabs over 200 ms while the icon colour crossfades via `transition-[color,transform]`. A `ResizeObserver` keeps it aligned when the bar resizes. Active icon colour is `text-accent`; inactive is `text-faint`. Pressing scales to 95% (`active:scale-95`). Keep this interaction if you add a tab.
- The detail view is a full-screen slide-over (`fixed inset-0 z-40 overflow-y-auto bg-black`, `anim-slide`) with a sticky translucent header (`bg-black/90`) and a max-w-xl inner column. It is navigated via the history stack, not the router.
- Toasts float just above the tab bar: a small `rounded-full border border-line bg-raised px-4 py-1 text-[13px]` pill with an optional accent "Undo" button, `role="status"` and `aria-live="polite"`.

## Component recipes

Reuse these before creating anything new:

- **`ScreenHeader`** — `px-4 pb-2`, top padding including the safe-area inset; `text-[26px]` title with an optional `text-xs text-dim` subtitle.
- **Section headers** (Settings) — `text-[11px] font-medium uppercase tracking-wider text-faint`, followed by a `divide-y divide-line/70 overflow-hidden rounded-2xl bg-surface` group. Rows inside are `px-4 py-3.5` with a `text-[15px]` label and optional `text-xs text-dim` hint.
- **List rows** — `flex items-center gap-3 px-4 py-2.5`, bottom hairline `border-line/60`, 44×64 poster, `text-[15px] medium` title, a `text-xs text-dim` subtitle line, and a small `tabular-nums text-faint` count. The `.cv` class skips layout for off-screen rows.
- **Filter chips / segmented controls** — `h-9 rounded-full px-3.5 text-[13px]`; selected = `bg-fg font-medium text-black`, unselected = `bg-surface text-dim active:bg-raised`. Used for status filters, seasons and sort tabs.
- **Primary action** — full width `h-12 rounded-xl bg-accent text-[15px] font-semibold text-black active:opacity-80`; disabled state becomes `bg-surface font-normal text-dim`. Small circular version: `h-11 w-11 rounded-full border border-line text-accent`.
- **Progress** — a 3 px `rounded-full bg-line` track with an `origin-left bg-accent` fill animated by `scaleX` over 300 ms, plus `role="progressbar"` and aria values.
- **Episode row** — `min-h-[52px]`, episode number `w-8 text-xs tabular-nums text-faint`, name `text-[14px]`, air date `text-[11px] text-faint`, and a 24 px round checkbox that is `border-accent bg-accent text-black` when watched. Unaired episodes are `opacity-50`.
- **Empty state** — `px-8 py-20 text-center`, `text-[15px] text-dim` title and `text-xs text-faint` hint.
- **Destructive action** — starts as `text-faint`, becomes `bg-danger/15 text-danger` only after the second tap (3 s window). Other buttons do not use danger styling. Removing via the active status button with watched progress is a stronger case: the first tap arms a 3 s confirmation, shows a `text-danger` line naming what will be deleted (watch history, with the episode count) and switches that button to "Tap again" instead of removing immediately.
- **Info sheet** (`Sheet` in `ui.tsx`) — the one deliberate modal exception ([ADR 0006](./decisions/0006-info-bottom-sheet.md), interaction contract in [ADR 0007](./decisions/0007-sheet-interaction-contract.md)), opened by tapping the detail hero poster or title. It is self-contained: the parent owns `open` and the history entry; `Sheet` owns the enter/exit motion, drag, scrim fade, focus trap and close button. Portal to `document.body`, backdrop `bg-black/70`, panel `rounded-t-2xl bg-surface` pinned bottom with safe-area padding, `z-[45]` (above Detail, below toasts), grab handle, title/subtitle header, 44×44 close button, optional footer, and a `max-h-[78dvh]` scroll area that keeps native scrolling. Local facts render immediately; TMDB extras fill in without blocking. Drag down from the header, or from content only when it is scrolled to the top; dismiss at 25% of the panel height (clamped 64–180 px) or a downward flick over 0.35 px/ms. Drag **up from the header** to expand the panel to the top of the screen (safe-area padded); drag **down from expanded** to return to the default height. Each gesture moves one detent; upward drags from content keep scrolling. Backdrop tap, close button, Escape and system back also dismiss. Exit starts on the same tick as the close (200 ms roll-down) so the history entry and animation cannot drift; no parent timers. Reuse `Sheet` rather than creating another modal.
- **Swipe affordances** — revealed backgrounds are `bg-accent/15 text-accent` on the right ("mark") and `bg-warn/15 text-warn` on the left ("undo/clear"), with labels at `text-sm font-medium`. Threshold is 72 px.
- **Searchable title row** (`MediaRow.tsx`) — shared by Search results and Browse columns. Poster/title taps open the detail view. The Library-style circular `+` (`h-11 w-11 rounded-full border border-line text-accent`) rotates 45° into a close affordance. The row height never changes: the poster/name layer and a four-chip layer — Watching, Planned, Done, Dropped — are stacked in the same 64 px cell and swap with a 200 ms roll (`translateX` + `rotateY` + opacity, with `perspective` on the container). The inactive layer is `aria-hidden` and `pointer-events-none`. `addItem()` also changes the status of an already-tracked title, so every row can show the `+`. Tapping the chip that matches a tracked title's current status does **not** re-add it: the first tap arms a 3 s confirmation ("Tap again", `bg-danger/15 text-danger`; the timer is cleared on unmount), the second calls `removeItem()` and collapses the row with a "removed" toast. Other chips still add/change status. No extra warning line is added, because the row height must stay fixed.

## Motion and feedback

- `anim-up` (fade + 8 px rise) for tab content and toasts; `anim-slide` (24 px slide + fade) for the detail view. Both 160 ms `ease-out`.
- The bottom sheet is the deliberate motion exception: 260 ms in, 200 ms out/snap/detent change, `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-sheet`). It settles like a physical surface instead of snapping like an in-page transition. Detent changes animate the panel height (200 ms); a new sheet always opens at the default height. Keep `SHEET_*` in `ui.tsx` in sync with `--ease-sheet`/`.anim-sheet` in `globals.css`.
- Tab colour/transform transitions: 200 ms. Progress bar: 300 ms.
- Press feedback is `active:scale-95` on chips/tabs and `active:bg-surface`/`active:opacity-80` elsewhere, plus optional haptics via `haptic()`.
- `prefers-reduced-motion` collapses all animations/transitions to 1 ms in `globals.css` — keep any new motion inside that rule. `Sheet` also checks the media query in JS and uses 0 ms for its WAAPI exit/snap.
- The Browse columns are finger-driven, never auto-play: the track follows the horizontal drag and each column's poster rows shift up to ±14 px based on their position relative to the active column. Transforms are written straight to the DOM via a `--px` CSS variable (no React re-render per pointer move); the column snap and the artwork settle in 160 ms. The dots are the tap fallback for the swipe.
- Focus is a 2 px accent outline with 2 px offset (`:focus-visible`). Never remove it without a visible replacement.

## Accessibility is part of the style

The accessible markup is not an add-on; it is how these components are built. Keep: `aria-label` on icon-only buttons, `aria-current` on the active tab, `role="tablist"`/`tab"` where used, `aria-pressed` on episode toggles, `aria-checked` on status radios, `aria-live` for sync status and toasts, `role="dialog"` on the detail view and the sheet, and `role="progressbar"` with aria values. Content is `aria-hidden` while the detail view is open; the detail is `aria-hidden` and the main content is `inert` while the sheet is open. The sheet moves focus in, traps Tab, restores focus on close, and always has a 44×44 close button as the non-gesture path. The app also respects safe-area insets and `prefers-reduced-motion`.

## Checklist for new UI

1. Does it use existing tokens and primitives from `ui.tsx` instead of new colours or a new design system?
2. Is the background pure black and is green reserved for primary/active states?
3. Does it match the 16 px gutters, row density and rounded-pill/rounded-2xl vocabulary?
4. Is there a pressed state, a focus ring, and a reduced-motion-safe animation?
5. Are labels, counts and times `text-xs`/`tabular-nums` where appropriate?
6. Does it work at `max-w-xl` on a phone with safe-area insets and without horizontal overflow?
7. Can a keyboard and screen reader user operate it?
8. Can the main action be done by thumb in one or two taps, or with a swipe?
9. Does every gesture have a tap fallback, and does nothing rely on hover?
10. Does any interaction wait on the network before giving feedback? If so, make it optimistic.

If a change would introduce gradients, multiple accent colours, large card shadows, a webfont, a new component library, a modal wizard or a new page for something that fits in place, stop and reconsider — that is a different app. See [04-conventions.md](./04-conventions.md) for the code-level rules and [05-gotchas.md](./05-gotchas.md) for interaction traps.
