# 0013 — shadcn Drawer replaces the in-house Sheet

- Date: 2026-11-27
- Status: accepted; supersedes the implementation details of [0007](./0007-sheet-interaction-contract.md)

## Context

`Sheet` in `src/components/ui.tsx` had grown into ~590 lines of hand-written gesture plumbing: pointer capture, a scroll-lock handshake, velocity sampling, WAAPI exits, detent resizing, scrim fading, focus trapping and portal/ARIA management. Those details were carefully documented in ADRs 0006 and 0007, but they duplicated what a maintained primitive already does well. shadcn/ui's `Drawer` (Base UI) provides swipe-to-dismiss, snap points, a swipe handle, focus management, scroll locking and reduced-motion-aware transitions out of the box, with better platform-native feel than the bespoke implementation.

This project already initialized shadcn/ui against the official `@shadcn` registry with the `base` primitive library, so no new dependency was needed.

## Decision

- Install `npx shadcn@latest add drawer`; the source lives in `src/components/ui/drawer.tsx` and is owned by this repo.
- **Delete `Sheet` from `src/components/ui.tsx` entirely.** The detail info overlay composes `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerClose` and `DrawerFooter` directly. The two filter drawers share `FilterDrawer` in `src/components/FilterControls.tsx`, which composes the same parts once instead of duplicating the sheet chrome. There is no app-level modal wrapper left.
- The detail info drawer passes `snapPoints={[0.78, 1]}` to keep the collapsed/expanded detents. The two filter drawers stay content-sized; forcing them to 78dvh would leave a large empty panel. Base UI measures that height and transitions it, so the filter controls keep a fixed row count and the footer is always rendered (Reset disabled when inactive). Changing Type or any other filter then cannot animate the panel's top edge.
- Base UI now owns dismissal thresholds, flick detection, scroll-vs-swipe decisions and focus/scroll locking. The custom 25%-of-panel threshold, 0.35 px/ms velocity check and 120 ms scroll-lock constant are gone.
- Each call site restyles the generated components with the app's tokens: `mx-auto max-w-xl rounded-t-2xl border-line bg-surface`, `z-[45]`, `bg-black/70` scrim, a 44×44 close button, and a `min-h-0 flex-1 overflow-y-auto` content region. `src/components/ui/drawer.tsx` keeps shadcn's generated 450 ms `cubic-bezier(0.32, 0.72, 0, 1)` enter and swipe-strength-scaled exit — that animation is the reason for switching. `globals.css` exempts the drawer parts from the global 1 ms reduced-motion collapse (which otherwise made it disappear) and gives `body` `position: relative` for iOS 26 Safari.
- Dismissal calls `onClose` from `Drawer`'s `onOpenChange(false)`, so the parent-owned history entry is popped on the same tick and system back still works.
- The Search screen also opens the active filter drawer with `PullUpToLoad` in `direction="down"` and `indicator="chevron"` — the same primitive Detail uses for its info sheet. It wraps the whole Search screen (header, search field and results), so `allowTyping` is set: otherwise the guard that ignores gestures while an input has focus made the pull dead right after typing a query. The chevron uses the shared `pull-indicator-top` position.

## Consequences

- Roughly 590 lines of gesture code are gone, along with the `Sheet` abstraction; each overlay is now ordinary shadcn composition. Future touch-handling fixes arrive with a dependency update instead of local patching.
- Swipe/detent thresholds now follow Base UI, not the documented 25%/0.35 px/ms numbers. ADR 0007's mechanism rules are superseded; its guarantees (immediate dismissal, every close path, modal semantics, one history entry) remain.
- The generated `drawer.tsx` is local source: re-running `shadcn add drawer` without `--diff` will overwrite the timing/styling overrides.
- `Drawer` handles background `aria-hidden`/`inert` and focus itself, so no app code sets those manually any more.
