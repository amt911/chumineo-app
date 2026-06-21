# RESUME — auth slice (subagent-driven execution)

> Portable resume note (committed, travels with the branch). The live ledger at
> `.superpowers/sdd/progress.md` is git-ignored and machine-local — this file
> mirrors it. Trust `git log` + this file.

**Branch:** `feat/auth`
**Plan:** `docs/superpowers/plans/2026-06-20-auth-minimal-profile.md` (16 TDD tasks)
**Spec:** `docs/superpowers/specs/2026-06-20-auth-minimal-profile-design.md`
**Method:** superpowers `subagent-driven-development` (fresh implementer + reviewer per task).

## Progress (as of 2026-06-21)

**Backend — COMPLETE and reviewed clean (Tasks 1–12):**

- T1 shared zod contracts ✅ · T2 prisma Session/VerificationToken + migration ✅
- T3 redis module ✅ · T4 mail transport switch ✅ · T5 argon2 + token utils ✅
- T6 token service (rotating refresh) ✅ · T7 auth service ✅ · T8 jwt strategy/guard ✅
- T9 auth controller + module ✅ · T10 users module ✅ (ran before T7 — see note)
- T11 wire app.module + main.ts (cookies/CORS) ✅ · T12 auth e2e (register→verify→login→refresh→profile) ✅ GREEN

**Frontend — in progress:**

- T13 web auth client + zustand store ✅ reviewed clean
- **T14 register/login/verify pages — IMPLEMENTED (commit `dcc51a8`) but NOT yet reviewed.** ← resume here

## Resume here (next session)

1. **Review Task 14** (range `4f2e603..dcc51a8`). Two implementer notes to check:
   - `register-form.tsx` username input uses `setValueAs (''→undefined)` so an empty optional username passes Zod — justified, confirm in review.
   - **FIX:** `app/(auth)/verify/page.tsx` uses `useSearchParams` without a `<Suspense>` boundary → Next 15 warns/errors on a production build. Wrap the component in `<Suspense>`.
2. **Task 15** — web public profile page (`app/profile/[username]/page.tsx`, RSC) + add `app/(auth)/**` and `app/profile/**` to web vitest coverage excludes.
3. **Task 16** — env (`.env.example` + local `.env` auth/mail/CORS vars), docs (`ENDPOINT_PERMISSIONS.md` + `FINDINGS.md`), final gate (`pnpm lint && type-check && test:cov`, e2e). FINDINGS to add: argon2 needs `argon2:true` in pnpm-workspace allowBuilds; `HttpStatus.LOCKED` absent in @nestjs/common@10 (use literal 423); `esModuleInterop:true` required for default imports (cookie-parser); refresh `REDIS_CLIENT` token lives in `redis.constants.ts` to avoid a module↔service circular import.
4. **Final whole-branch review** (capable model) → `finishing-a-development-branch`.

## Ordering note

UsersService is a compile-time dependency of AuthService, so Task 10 was run **before** Task 7 (the plan numbered it 10). No other reordering.

## Carry-forward minors (triage at final review)

- `Session`/`VerificationToken` FK `onDelete` RESTRICT — revisit at user-deletion.
- `pnpm db:migrate -- --name <x>` forwards the name wrong (Prisma goes interactive).
- argon2 native build needs `argon2: true` in `pnpm-workspace.yaml` allowBuilds.
- auth client responses not Zod-validated at runtime (unlike `fetchCollections`).
- `reflect-metadata` imported in some service files (redundant; bootstrapped in main.ts).

## Bootstrapping on a fresh machine

1. `git pull` the `feat/auth` branch (must have been pushed).
2. `cp .env.example .env`, shift ports if running beside another stack (api 3100 / web 3101 / pg 5433 / redis 6380 / mailpit 1026·8026) + set the auth/mail/CORS vars.
3. `pnpm install`
4. `pnpm infra:up && pnpm db:deploy && pnpm db:seed`
5. `pnpm dev:tailscale` (or `pnpm dev`).
