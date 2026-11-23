<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AI onboarding — read `docs/README.md` first

Before doing any work in this repo, open [docs/README.md](docs/README.md). It is the entry point to the `docs/` folder, the AI-facing source of truth for how this project works. It explains how to read and update the docs and contains an index of:

- `docs/01-project-overview.md` — what the app is, stack, file map, boot sequence.
- `docs/02-architecture.md` — data flow, sync engine, auth, TMDB routes, notifications.
- `docs/03-data-model.md` — stored fields, IndexedDB, localStorage cursors, Supabase schema.
- `docs/04-conventions.md` — code patterns, naming, verification commands.
- `docs/05-gotchas.md` — Next.js 16, Supabase, sync and PWA traps.
- `docs/06-ui-design.md` — UI **and UX** specification.
- `docs/decisions/` — ADRs recording the *why* behind the design.

**Goal number one: phone-first UX.** Gestures and near-instant navigation outrank extra features and desktop conventions. Read `docs/06-ui-design.md` before changing any UI or interaction, and `docs/decisions/0005-phone-first-gesture-navigation.md` for why.

Search the docs and the codebase for an existing implementation before writing new code — reuse it, and never add a duplicate helper or component ("replicant" code). Update the relevant doc when you learn something non-obvious. The block above is managed by `next dev`; keep your additions below it.
