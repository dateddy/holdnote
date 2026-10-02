# HoldNote

Sổ Tay Hand — poker hand journal (PWA). Log a hand in under 30 seconds, get an AI review, track leaks across sessions.

Requirements: `docs/spec.md`. Task list: `docs/tasks.md`. Contributor/agent rules: `CLAUDE.md`.

## Layout

- `apps/web` — Next.js (App Router, TypeScript, Tailwind).
- `packages/poker-core` — pure TypeScript poker logic (shorthand parser, pot, result, eff stack, SPR, pot odds). No React.
- `legacy/` — the old single-file app. `legacy/data/` holds real hands and is gitignored.

## Setup

Node 20+ and pnpm 9 (`npm i -g pnpm@9` if `corepack enable` is blocked).

```sh
pnpm install
cp .env.example .env.local   # fill in keys (not needed for poker-core)
pnpm dev                     # web on http://localhost:3000
```

## Scripts

| Command                         | What it does                             |
| ------------------------------- | ---------------------------------------- |
| `pnpm test`                     | all tests (Vitest)                       |
| `pnpm --filter poker-core test` | core tests only                          |
| `pnpm typecheck`                | `tsc --noEmit` in every package          |
| `pnpm lint`                     | ESLint in every package + Prettier check |
| `pnpm format`                   | Prettier write                           |

Tests that compare against real legacy hands read `legacy/data/` directly and are skipped when that folder is absent.
