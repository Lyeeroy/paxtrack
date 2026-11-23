# AI START HERE — read this file first

You have entered the `docs/` folder. **Read this entire file before doing anything else.** This folder is the AI-facing source of truth for how this project works. Its purpose is to let any AI arrive, understand the system immediately, and contribute without re-deriving the codebase from scratch or producing duplicated, unnecessary code.

---

## Why this folder exists

Two failure modes this folder is designed to prevent:

- **Re-derivation.** Every new AI re-reads the whole repo and rebuilds its own mental model from zero. That model is then thrown away when the session ends, and the next AI repeats the work. The understanding that survives should live here.
- **Replicants.** An AI writes a second version of a helper, component, or pattern that already exists, because it did not know the first one was there. Before writing code, check what the project already has and reuse it. New code is the last resort, not the first instinct.

The root `README.md` is a human-facing setup and usage guide. This folder is the AI-facing engineering guide. They are complementary — do not copy one into the other.

## Authority order

When sources disagree, the higher one wins:

1. **The code and the local Next.js docs** (`node_modules/next/dist/docs/`, resolved from the repo root). The root `AGENTS.md` warns that this Next.js version has breaking changes — read the relevant local guide before writing code, and heed deprecation notices.
2. **This `docs/` folder.**
3. **Root `README.md` and root `AGENTS.md`.**
4. **Your training-data assumptions.** These are the least trustworthy here.

If the code contradicts a doc, the code is right and the doc is stale — fix the doc. Never change working code to match an outdated note.

## How to READ

1. Read this file fully on arrival.
2. Follow the index below and open the docs relevant to your task.
3. Read the relevant docs **before** editing code.
4. Verify against the source, not memory. A doc tells you where to look; the code is the final answer.
5. If a doc you need does not exist yet, read the source directly and note the gap — see "How to WRITE".

## How to WRITE

**Write a doc (or update an existing one) when:**

- You discover a convention or pattern that is not obvious from the code.
- You make an architectural decision and there is a reason behind it.
- You hit a non-obvious gotcha that cost you time.
- The same question or confusion comes up repeatedly.
- You had to discover something the hard way and the next AI should not have to.

**Do NOT write when:**

- It duplicates the root `README.md`, root `AGENTS.md`, or another doc. Update that doc instead.
- It is obvious from a glance at the code.
- It is a transient task log, a list of changes, or "what I did today". That does not belong here.
- It contradicts an existing doc. Find that doc and correct it rather than adding a competing version.

**Where and how:**

- Use numbered topic files (`01-...`, `02-...`) so they read in order. Add every new file to the index below.
- Keep one topic per file. Prefer short, evergreen notes over long narratives.
- Cite real paths (`src/lib/sync.ts`, `supabase/schema.sql`) so the reader can jump to the source.
- Show small examples when a pattern is easier to see than describe.
- Date architectural decisions and record *why*, not just *what*.
- Before writing, grep this folder and the codebase so you do not document something that does not exist or that is already covered.

## Anti-replicant checklist — run this before writing code

1. **Read** the relevant docs from the index.
2. **Search** the codebase for an existing implementation, helper, or component that already solves this.
3. **Reuse** it if it fits.
4. **Add new code only if nothing fits.** If you must create a parallel implementation, document why the existing one could not be used.
5. **Leave the docs better than you found them** — update the index and any affected notes before you finish.

## Index

Read in order. Each file links back here and to its siblings.

- [README.md](./README.md) — **start here** — this file; how the docs system works and how to read/write it.
- [01-project-overview.md](./01-project-overview.md) — what the app is, the pinned stack, the file map, boot sequence and config surface.
- [02-architecture.md](./02-architecture.md) — module layering and data flow: store, sync engine, auth, TMDB routes, notifications, service worker, backups.
- [03-data-model.md](./03-data-model.md) — every stored field, IndexedDB store, localStorage cursor and Supabase column.
- [04-conventions.md](./04-conventions.md) — coding patterns, naming, UI/accessibility rules and verification commands.
- [05-gotchas.md](./05-gotchas.md) — traps: Next.js 16 changes, Supabase/LWW pitfalls, auth modes, PWA quirks, product logic.
- [06-ui-design.md](./06-ui-design.md) — UI **and UX**: phone-first, gestures and instant navigation as goal one, plus palette, type, layout, motion and accessibility. **Read before changing any UI or interaction.**
- [decisions/](./decisions/README.md) — dated architecture decision records with the *why* behind the design.
