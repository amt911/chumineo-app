# RESUME — auth slice (subagent-driven execution)

> Portable resume note (committed, travels with the branch). The live ledger at
> `.superpowers/sdd/progress.md` is git-ignored and machine-local — this file
> mirrors it so work can continue on another machine. Trust `git log` + this file.

**Branch:** `feat/auth`
**Plan:** `docs/superpowers/plans/2026-06-20-auth-minimal-profile.md` (16 TDD tasks)
**Spec:** `docs/superpowers/specs/2026-06-20-auth-minimal-profile-design.md`
**Method:** superpowers `subagent-driven-development` (fresh implementer + reviewer per task).

## Progress (as of 2026-06-20)

- **Task 1** — shared zod contracts — ✅ complete, reviewed clean (commit `224804a`)
- **Task 2** — prisma `Session`/`VerificationToken` + migration — ✅ complete, reviewed clean (commit `0185e8d`)
- **Task 3** — redis module — ⚠️ IMPLEMENTED (commit `f2a023c`) but review returned **1 Important, NOT yet complete**.
- **Tasks 4–16** + final whole-branch review — pending.

## Resume here

1. **Fix Task 3 first:** `apps/api/src/redis/redis.service.spec.ts` instantiates the
   service directly (`new RedisService(client)`); switch to
   `Test.createTestingModule({ providers: [RedisService, { provide: REDIS_CLIENT, useValue: client }] })`
   so the `@Inject(REDIS_CLIENT)` DI wiring is actually exercised. Re-run the
   focused test, then it's clean.
2. Continue Tasks 4 → 16 from the plan, then the final whole-branch review (use a
   capable model).

## Carry-forward minors (triage at final review)

- `Session`/`VerificationToken` FK `onDelete` is RESTRICT — revisit when a
  user-deletion flow lands.
- `pnpm db:migrate -- --name <x>` forwards the name incorrectly (Prisma went
  interactive); the Task 2 migration was created by invoking prisma directly.

## Bootstrapping on a fresh machine

1. `git pull` the `feat/auth` branch (it must have been pushed).
2. Create `.env`: `cp .env.example .env`, then shift ports if running alongside
   another stack (see `.env.example` header; e.g. api 3100 / web 3101 / pg 5433 /
   redis 6380 / mailpit 1026·8026).
3. `pnpm install`
4. `pnpm infra:up && pnpm db:deploy && pnpm db:seed`
5. `pnpm dev:tailscale` (or `pnpm dev`) to run the stack.
