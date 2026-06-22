# Auth (email) + Minimal Public Profile — Design Spec

> Epic 1, slice 1. Covers US-01 (registro email/password + verificación),
> US-02 (login JWT + refresh + lockout) and US-03 _lite_ (perfil público de
> lectura: username, avatar, fecha de miembro). **Out of scope (later slices):**
> OAuth (Google/Discord), edición de perfil / settings / privacidad (US-04),
> GDPR export, soft-delete, password reset, follows/reviews/reputation.

**Date:** 2026-06-20
**Status:** approved (brainstorming) → pending implementation plan
**Builds on:** Phase 0 foundation (`apps/api` Nest+Prisma, `apps/web` Next 15,
`packages/shared` Zod, `ZodValidationPipe`, docker infra).

---

## 1. Goals & non-goals

**Goals**

- A visitor can register with email + password, receive a verification email
  (Mailpit in dev, Resend in prod), and verify their account.
- A verified user can log in, receiving a short-lived access JWT (in-memory on
  the client) and a rotating refresh token (httpOnly cookie, hashed in DB).
- Brute-force protection: temporary lockout after repeated failures.
- Anyone can view a public profile page (`/profile/<username>`) with username,
  avatar and member-since date.

**Non-goals (deferred, do not build)**

- OAuth strategies, account/profile editing, privacy toggles, GDPR export,
  soft-delete (US-04). Password reset (no story yet). Avatar **upload** (R2) —
  the field exists and renders, but upload is US-04. Real stats on the profile —
  stubbed to `0`/empty until Epics 3–6 land.

---

## 2. Decisions (locked in brainstorming)

| Topic            | Decision                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password hashing | **argon2id** (`argon2` package).                                                                                                                        |
| Session model    | **Stateful refresh tokens in Postgres** (`Session` table, hashed, rotated, revocable).                                                                  |
| Lockout state    | **Redis** (ephemeral counters, TTL).                                                                                                                    |
| Mail transport   | **Switch** like route-page-app: abstract `MailService` DI token + `SmtpMailService` (Mailpit) / `ResendMailService` (prod), chosen by `MAIL_TRANSPORT`. |
| Validation       | Shared **Zod** schemas + existing `ZodValidationPipe` (api) + `zodResolver` (web RHF).                                                                  |
| Frontend session | Access token in a small **Zustand** store (memory); refresh-on-401 wrapper; refresh token in httpOnly cookie.                                           |

---

## 3. Data model (Prisma + one migration)

`apps/api/prisma/schema.prisma`.

**User — add fields** (keep existing id/email/username/createdAt + relations):

```prisma
passwordHash  String
emailVerified Boolean @default(false)
avatarUrl     String?
bio           String?
```

> `email` and `username` are already `@unique`. `username` constraints
> (3–20 chars, no spaces) are enforced at the Zod layer, not the DB.

**Session (new)** — one row per issued refresh token:

```prisma
model Session {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tokenHash String    @unique          // SHA-256 of the opaque refresh token
  userAgent String?
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  @@index([userId])
}
```

**VerificationToken (new)** — single-use email verification:

```prisma
model VerificationToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  tokenHash  String    @unique          // SHA-256 of the opaque token in the link
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

Add the inverse relations (`sessions Session[]`, `verificationTokens VerificationToken[]`) to `User`. New migration: `add_auth_user_fields`.

> **Token storage rule:** the opaque token (refresh / verification) is a random
> 32-byte base64url string sent to the client; only its **SHA-256 hash** is
> stored. Lookups hash the incoming token and match on `tokenHash`. (argon2 is
> for passwords; high-entropy opaque tokens use fast SHA-256.)

---

## 4. Backend modules (`apps/api/src`)

### 4.1 `redis/`

- `redis.module.ts` (`@Global`) + `redis.service.ts` wrapping a single `ioredis`
  client from `REDIS_URL`. Exposes `incrWithTtl(key, ttlSeconds)`, `get`, `del`.
  Used by the lockout logic. `onModuleDestroy` quits the client.

### 4.2 `mail/` (mirror route-page-app)

- `mail.service.ts` — abstract class (DI token): `sendVerificationEmail(to, token): Promise<void>`.
- `smtp-mail.service.ts` — nodemailer → Mailpit (`MAIL_SMTP_HOST`/`MAIL_SMTP_PORT`).
- `resend-mail.service.ts` — Resend SDK (`RESEND_API_KEY`).
- `mail.module.ts` — `selectMailService()` (pure, testable) returns the class by
  `process.env.MAIL_TRANSPORT === 'resend' ? Resend : Smtp`; provider
  `{ provide: MailService, useClass: selectMailService() }`; exports `MailService`.
- `mail-templates.ts` — `buildVerificationEmail(token)` → `{ subject, html, text }`,
  link = `${WEB_PUBLIC_URL}/verify?token=<token>`.

### 4.3 `auth/`

- `password.util.ts` — `hashPassword`, `verifyPassword` (argon2id).
- `token.util.ts` — `generateOpaqueToken()`, `sha256(token)`.
- `token.service.ts` — issues access JWT (`@nestjs/jwt`, 15 min) and refresh
  tokens; persists hashed refresh in `Session`; `rotate(oldToken)` (validate →
  revoke old → issue new; **reuse of a revoked/!found token revokes all of the
  user's sessions**); `revoke(token)`; `revokeAllForUser(userId)`.
- `auth.service.ts`:
  - `register(dto)` — reject duplicate email/username; derive username from email
    if absent (ensure unique with numeric suffix); hash password; create User
    (`emailVerified=false`); create VerificationToken; send email. Returns
    `{ message }` (no session until verified).
  - `resendVerification(email)` — idempotent; invalidate prior tokens, issue+send
    new (don't leak whether the email exists).
  - `verifyEmail(token)` — hash+lookup, check not expired/!consumed, set
    `emailVerified=true`, mark `consumedAt`.
  - `login(dto, userAgent)` — lockout check (Redis); find user; verify password;
    require `emailVerified` (else `403 EMAIL_NOT_VERIFIED`); on failure
    `incrWithTtl` and after 5 within window → `423 LOCKED` for 15 min; on success
    reset counter and issue access + refresh (7d, or 30d if `rememberMe`).
  - `refresh(token, userAgent)` — `token.service.rotate`; returns new access +
    sets new refresh cookie.
  - `logout(token)` — revoke that session.
- `strategies/jwt.strategy.ts` — access token from `Authorization: Bearer`.
- `strategies/jwt-refresh.strategy.ts` — refresh token from the httpOnly cookie.
- `guards/jwt-auth.guard.ts`, `guards/jwt-refresh.guard.ts`.
- `decorators/current-user.decorator.ts` — `@CurrentUser()`.
- `auth.controller.ts` — endpoints below; bodies validated by `ZodValidationPipe`
  with the shared schemas; refresh/logout use the refresh guard + read the cookie.
  Sets/clears the refresh cookie (`httpOnly`, `sameSite`, `secure` in prod, `path=/auth`).

### 4.4 `users/`

- `users.service.ts` — `create`, `findByEmail`, `findByUsername`, `getPublicProfile(username)`.
- `users.controller.ts` — `GET /users/:username` → `publicProfileSchema` (404 if none).
- `GET /auth/me` (in auth or users) → current user (requires access token).

### 4.5 `main.ts` & config

- `app.use(cookieParser())`.
- `app.enableCors({ origin: <web origin from env>, credentials: true })` — **this
  is the deferred CORS item from the dev-tooling chore**; login is the first
  client-side API call. Origin comes from an env var (e.g. `WEB_PUBLIC_URL`), and
  for tailnet access the mobile origin must be allow-listed too.
- New env (added to `.env.example` + local `.env`): `MAIL_TRANSPORT`,
  `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT` (=`MAILPIT_SMTP_PORT`), `MAIL_FROM`,
  `RESEND_API_KEY`, `WEB_PUBLIC_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL_DAYS=7`, `JWT_REFRESH_REMEMBER_DAYS=30`,
  `LOCKOUT_MAX_ATTEMPTS=5`, `LOCKOUT_WINDOW_MIN=15`.

### Endpoints (also update `docs/ENDPOINT_PERMISSIONS.md`)

| Method | Path                      | Auth           | Notes                                           |
| ------ | ------------------------- | -------------- | ----------------------------------------------- |
| POST   | /auth/register            | Public         | email, password, username? → sends verification |
| POST   | /auth/resend-verification | Public         | idempotent, no enumeration                      |
| POST   | /auth/verify              | Public         | `{ token }` → marks verified                    |
| POST   | /auth/login               | Public         | sets refresh cookie, returns access + user      |
| POST   | /auth/refresh             | Refresh cookie | rotates, returns new access                     |
| POST   | /auth/logout              | Refresh cookie | revokes session, clears cookie                  |
| GET    | /auth/me                  | JWT            | current user                                    |
| GET    | /users/:username          | Public         | public profile                                  |

---

## 5. Shared contracts (`packages/shared`, rebuild `dist`)

- `schemas/auth.schema.ts`:
  - `registerSchema` — `email` (email), `password` (`min(8)` + `regex(/\d/)`),
    `username` optional (`min(3).max(20).regex(/^\S+$/)`).
  - `loginSchema` — `email`, `password`, `rememberMe: boolean().default(false)`.
  - `verifySchema` — `token: string().min(1)`.
  - `resendSchema` — `email`.
- `dto/auth.dto.ts` — `authResponseSchema` = `{ accessToken: string, user: publicUserSchema }`.
- `dto/user.dto.ts` — `publicProfileSchema` = `{ username, avatarUrl: string().nullable(), memberSince: string() }` (ISO date string — Prisma `DateTime` serializes to string over HTTP, per FINDINGS); `publicUserSchema` adds `id`, `email`, `emailVerified` for the authed self.
- Export all from `index.ts`; rebuild dist (consumers import compiled JS).

---

## 6. Frontend (`apps/web`)

- `app/(auth)/register/page.tsx`, `login/page.tsx`, `verify/page.tsx`.
- `components/auth/register-form.tsx`, `login-form.tsx` — RHF + `zodResolver`
  on the **shared** schemas; submit → `lib/api`; render field + API errors
  (incl. `EMAIL_NOT_VERIFIED` with a "resend" action, and `LOCKED`).
- `verify/page.tsx` — reads `?token=`, calls `/auth/verify`, shows success/error.
- `lib/auth-store.ts` — Zustand: `accessToken`, `user`, `setSession`, `clear`.
- `lib/api.ts` — `register/login/verify/resendVerification/refresh/logout/me`
  with `credentials:'include'`; a fetch wrapper that, on `401`, calls `/auth/refresh`
  once and retries. Client calls use `NEXT_PUBLIC_API_URL`.
- `app/profile/[username]/page.tsx` — RSC, public read via `fetchPublicProfile`.

---

## 7. Testing (TDD; gate 80%, `auth/` ≥90%)

**Backend (Jest, mocked Prisma/Mail/Redis/Jwt):**

- `auth.service`: register (happy, dup email, dup username, username derivation),
  resend (idempotent, no enumeration), verify (happy, expired, consumed,
  unknown), login (happy, wrong password, unverified→403, lockout→423 at the
  threshold, counter reset on success), refresh (happy, expired, reuse→revoke-all),
  logout.
- `token.service`: issue, rotate, reuse-detection, revokeAll.
- `password.util` / `token.util`: hash≠plain & verify true/false; token hashing
  deterministic.
- `mail.module` `selectMailService` (resend vs smtp) + each service with mocked
  transporter/Resend (mirror route-page specs).
- strategies/guards: valid / invalid / expired.
- `users.service` + profile mapping (strips private fields); controllers
  (DTO validation 400, status codes, guards applied).

**Backend e2e (supertest, test DB):** register → read token from DB →
verify → login (cookie set) → refresh (rotated) → `GET /users/:username` →
`GET /auth/me`. Plus negative: login before verify → 403.

**Frontend (Vitest + RTL):** register/login forms (zod validation messages,
submit happy path mocked, API-error rendering); `lib/api` auth calls + 401→refresh
retry; profile RSC render (mocked fetch). App-router pages excluded from coverage
as in foundation.

---

## 8. Docs & ops

- `docs/ENDPOINT_PERMISSIONS.md` — add the 8 rows above, bump date.
- `docs/FINDINGS.md` — add: argon2 native build (prebuilt binaries; node-gyp
  fallback); opaque tokens hashed with SHA-256 while passwords use argon2;
  refresh cookie `sameSite`/`secure` and CORS `credentials` needed for the web↔api
  cross-origin call (and the tailnet origin must be allow-listed for mobile);
  `MAIL_TRANSPORT` defaults to `smtp` (Mailpit) in dev.
- New deps (stack-sanctioned): `argon2`, `@nestjs/passport`, `passport`,
  `passport-jwt`, `@nestjs/jwt`, `cookie-parser`, `nodemailer`, `resend`,
  `ioredis` (+ `@types/passport-jwt`, `@types/cookie-parser`); web: `zustand`.

---

## 9. Risks / call-outs

- **CORS + cookies:** web (`:3101`/tailnet) and api (`:3100`) are different
  **origins** (→ CORS with `credentials:true` + explicit origin, not `*`), but the
  **same site** in dev — different ports on the same host (`localhost`, or one
  MagicDNS host) are same-site, so `sameSite='lax'` cookies are sent on XHR.
  **Prod** (web on its domain, api on another) is cross-site → `sameSite='none';
secure`. So: `secure`+`sameSite` driven by env (`lax` dev / `none` prod). The
  plan must verify the refresh cookie round-trips in dev before building the UI.
- **No enumeration:** register/resend must not reveal whether an email exists
  (generic responses).
- **Migration safety:** `passwordHash` is non-null; the table is empty in dev
  (seed has no users), so no backfill needed — but the plan should confirm.
