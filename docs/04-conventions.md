# 04 — Conventions: how we write code here

These are patterns already established in the codebase. Follow them unless there is a reason not to; if you deliberately deviate, document why.

## Module and file conventions

- Every component under `src/components/` starts with `"use client"`. The only server-side TypeScript is `src/app/**/route.ts`, `src/app/auth/error/page.tsx`, `src/lib/tmdb-server.ts`, `src/lib/supabase/server.ts`, `src/lib/auth-redirect.ts` and `src/proxy.ts`. Don't add `"use server"` actions — there are none in this project.
- Path alias `@/*` maps to `src/*` (`tsconfig.json`). Use it in components and routes; `src/lib` files mostly use relative imports (`./idb`) for local modules.
- Files are small and single-purpose. `src/lib/store.ts` is the largest (~400 lines) because it owns all library mutations; keep new helpers there rather than creating a second store.
- Import `Item`, `EpData`, etc. as types (`import type { … }`) — `noEmit`, `isolatedModules` and strict mode are on.

## External stores instead of Context/Redux

State that changes outside React (IndexedDB, Supabase auth, sync status, toasts) uses the same hand-rolled pattern:

```ts
let state = INITIAL;
const listeners = new Set<() => void>();
export function useX() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => INITIAL, // server snapshot must be stable
  );
}
```

Used in `store.ts`, `auth.ts`, `sync.ts` and `toast.ts`. When adding a new global state source, copy this shape. Keep the server snapshot a stable module constant to avoid hydration mismatches.

## Safety rules for async work

These exist because an account switch or unmount can make in-flight work land in the wrong place:

- **Epoch guard.** `store.ts` exports `getStoreEpoch()`; `resetLocalData()` increments it. Any async task that reads or writes the library must capture the epoch at start, and bail if it changed before applying results (`refresh.ts`, `notify.ts`, `sync.ts` do this).
- **Persist before apply.** `applyRemote()` and `importBackup()` write to IndexedDB before updating the in-memory map or sync cursor. A failed write must never leave memory claiming data that was not stored.
- **Flush before clear.** `resetLocalData()` calls `idbFlush()` before clearing stores so a stale write cannot leak the previous account's items.
- **Bump timestamps.** `commit()` uses `Math.max(Date.now(), item.updatedAt + 1)`. Do not write `updatedAt: Date.now()` directly on an item — a re-add could be rejected by Supabase's LWW trigger.
- **Check the user after network calls.** `sync.ts` re-reads `getCurrentUser()` after pulling and aborts if it changed.

## Naming and data conventions

- Item id: `` `${type}-${tmdbId}` `` — build it with a template literal, never string concatenation with a different separator.
- Episode key: `` `${season}x${episode}` ``; movies use `"m"`. Use `formatEp()` / `flatEps()` from `src/lib/episodes.ts` rather than re-deriving labels.
- Dates are `YYYY-MM-DD` strings from TMDB. Build/compare them with `todayStr()`, `addDays()` and `relDay()` — do not parse into `Date` for comparisons, and do not use locale-dependent formatting for keys.
- Status values are the exact `Status` union from `types.ts`. There is a `FILTERS`/`STATUSES` array in `Library.tsx`/`Detail.tsx`; keep labels in those arrays.

## UI conventions

For the visual language **and UX rules** — phone-first, gestures and instant navigation as goal one, plus palette, type, layout, motion and the "what not to do" list — see [06-ui-design.md](./06-ui-design.md). Read it before changing any UI or interaction.

- Tailwind 4 theme tokens are declared in `src/app/globals.css` under `@theme` (`bg`, `surface`, `raised`, `line`, `fg`, `dim`, `faint`, `accent`, `warn`, `danger`). Use `bg-surface`, `text-dim`, etc. — no arbitrary hex colours in components.
- The palette is a deliberately restrained AMOLED dark theme (pure `#000` background, one green accent). Don't lighten it casually.
- Build new controls from `ui.tsx` primitives: `ScreenHeader`, `Poster`, `Progress`, `TypeTag`, `Empty`, `SwipeRow` and the inline SVG `Icon*` components. Add an icon there rather than introducing an icon package.
- Posters use a plain `<img>` with an intentional `// eslint-disable-next-line @next/next/no-img-element` — Next's image optimizer is avoided for the external TMDB host. Keep the suppression comment and its reason.
- Safe-area insets (`env(safe-area-inset-*)`) are used in the tab bar, headers and toasts. Preserve them on new fixed-position UI.
- Accessibility is expected: `aria-label`/`aria-pressed`/`aria-current`/`role` on controls, `aria-live` on async status, `role="progressbar"` with values, visible `:focus-visible` outline, and `prefers-reduced-motion` handling in CSS. Follow the existing components.
- `SwipeRow` writes transforms directly to the DOM during a drag (no React re-renders) for 60 fps on cheap phones. Keep gesture work outside React state. Elements inside a swipe row must keep the `data-swipe` marker so the page-level tab swipe ignores them.
- The detail view is navigated with `window.history.pushState` / `popstate`, not the Next router, so the system back button and edge swipe close it. Don't replace this with router pushes.
- Mobile focus (e.g. re-tapping the Search tab) must be triggered inside the click handler to count as a user gesture.

## Error handling and feedback

- User-facing errors from Supabase go through `describeAuthError()` in `src/lib/auth.ts`, which converts technical messages into actionable ones. Extend it there instead of comparing error strings in components.
- Transient success/failure feedback uses `showToast()` (with an optional undo callback). Destructive actions like removal use a two-tap confirmation in `Detail.tsx`.
- Background failures (`initStore`, `initAuth`, `sync`, notification checks) log with `console.error` and degrade gracefully; they must not crash the app.
- Keep comment-only ESLint suppressions with a reason. Existing ones are for `react-hooks/set-state-in-effect` (browser-only APIs, cached results), `react-hooks/exhaustive-deps`, `react-hooks/globals` (module-level `lastFilter`), `react-hooks/preserve-manual-memoization`, `react-hooks/purity` (intentional weekly count) and `@next/next/no-img-element`. A bare disable with no explanation is a smell.

## Dependencies

There are no runtime dependencies beyond Next/React/Supabase. Small utilities are written in-repo (`idb.ts` is ~1 KB, icons are inline SVG, no date library, no state library, no toast library). Before adding a package, check whether a local helper already exists — this is the "replicant" rule from [README.md](./README.md).

## Verification

There is no test framework in this repo. The gates are:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . (the Next 16 CLI no longer has `next lint`)
npm run build       # production build (Turbopack)
npm run dev         # manual smoke test
```

Add a test setup only as a deliberate, documented decision — don't quietly introduce Jest/Vitest as part of an unrelated change.
