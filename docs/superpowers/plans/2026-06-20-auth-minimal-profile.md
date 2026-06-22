# Auth (email) + Minimal Public Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship email register + verification, login with rotating refresh tokens and lockout, and a public profile read page — the first slice of Epic 1.

**Architecture:** NestJS modules (`auth`, `mail`, `redis`, `users`) over Prisma/Postgres. Passwords hashed with argon2id; refresh tokens are opaque random strings stored hashed in a `Session` table (rotated, revocable); access tokens are short JWTs. Lockout counters live in Redis. Mail uses a transport switch (Mailpit dev / Resend prod). Contracts are shared Zod schemas. The Next.js web app has register/login/verify forms (React Hook Form + zod), a Zustand access-token store with refresh-on-401, and an RSC profile page.

**Tech Stack:** NestJS 10, Prisma 6, Zod 3, PostgreSQL 16, Redis (ioredis), argon2, @nestjs/jwt, @nestjs/passport + passport-jwt, nodemailer, resend, cookie-parser, Next.js 15, React Hook Form + @hookform/resolvers, Zustand, Jest + supertest, Vitest + RTL.

**Spec:** [docs/superpowers/specs/2026-06-20-auth-minimal-profile-design.md](../specs/2026-06-20-auth-minimal-profile-design.md)

## Global Constraints

- **No `any`** — use `unknown` + guards or domain types.
- **DTOs/enums/schemas only in `packages/shared`** — import compiled JS in api/web. **Rebuild shared (`pnpm build:shared`) after editing it.**
- **CommonJS, no `.js` import extensions** in `apps/api` and `packages/shared`.
- **Coverage gate 80%** (statements/branches/functions/lines); `auth/` target ≥90%. Never lower the gate; exclude with justification in config.
- **TDD** — red → green → refactor for all logic.
- **Conventional Commits (English)**, scope = module. **Never `git push`.**
- **Opaque tokens** (refresh, verification) are random 32-byte base64url strings; only their **SHA-256 hex hash** is persisted. Passwords use **argon2id**.
- **Refresh cookie:** name `refresh_token`, `httpOnly`, `path=/auth`, `sameSite=lax` + non-secure in dev, `sameSite=none` + `secure` when `NODE_ENV=production`.
- Lockout: `LOCKOUT_MAX_ATTEMPTS=5` within `LOCKOUT_WINDOW_MIN=15`.

---

## File map

```text
packages/shared/src/
  schemas/auth.schema.ts            # Task 1
  dto/user.dto.ts  dto/auth.dto.ts  # Task 1
  index.ts                          # Task 1 (append)
apps/api/src/
  redis/{redis.module.ts,redis.service.ts,redis.service.spec.ts}        # Task 3
  mail/{mail.service.ts,smtp-mail.service.ts,resend-mail.service.ts,
        mail.module.ts,mail-templates.ts, *.spec.ts}                    # Task 4
  auth/password.util.ts  auth/token.util.ts  (+ .spec.ts)               # Task 5
  auth/auth.constants.ts                                                # Task 6
  auth/token.service.ts (+ .spec.ts)                                    # Task 6
  auth/auth.service.ts (+ .flow.spec.ts, .errors.spec.ts)              # Task 7
  auth/strategies/jwt.strategy.ts (+ .spec.ts)                          # Task 8
  auth/guards/jwt-auth.guard.ts                                         # Task 8
  auth/decorators/current-user.decorator.ts                            # Task 8
  auth/auth.controller.ts (+ .spec.ts)  auth/auth.module.ts            # Task 9
  users/users.service.ts (+ .spec.ts)                                   # Task 10
  users/users.controller.ts (+ .spec.ts)  users/users.module.ts        # Task 10
  main.ts  app.module.ts                                                # Task 11
  prisma/schema.prisma  prisma/migrations/*                             # Task 2
  test/auth.e2e-spec.ts                                                 # Task 12
apps/web/
  lib/auth-store.ts (+ .test.ts)                                        # Task 13
  lib/api.ts (+ api.test.ts additions)                                  # Task 13
  components/auth/{register-form.tsx,login-form.tsx} (+ .test.tsx)      # Task 14
  app/(auth)/{register,login,verify}/page.tsx                          # Task 14
  app/profile/[username]/page.tsx                                       # Task 15
docs/ENDPOINT_PERMISSIONS.md  docs/FINDINGS.md  .env.example  .env      # Task 16
```

---

## Task 1: Shared Zod contracts (TDD)

**Files:**

- Create: `packages/shared/src/schemas/auth.schema.ts`, `packages/shared/src/dto/user.dto.ts`, `packages/shared/src/dto/auth.dto.ts`
- Test: `packages/shared/src/schemas/auth.schema.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces — Produces:**

- `registerSchema`/`RegisterDto`, `loginSchema`/`LoginDto`, `verifySchema`/`VerifyDto`, `resendVerificationSchema`/`ResendVerificationDto`
- `publicUserSchema`/`PublicUserDto`, `publicProfileSchema`/`PublicProfileDto`
- `authResponseSchema`/`AuthResponseDto`, `messageResponseSchema`/`MessageResponseDto`

- [ ] **Step 1: Write the failing test** — `packages/shared/src/schemas/auth.schema.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema, verifySchema } from './auth.schema';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: 'secret12',
        username: 'neo',
      }).success,
    ).toBe(true);
  });
  it('rejects a password under 8 chars', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'sec1' }).success,
    ).toBe(false);
  });
  it('rejects a password with no number', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'password' })
        .success,
    ).toBe(false);
  });
  it('rejects a username with spaces', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: 'secret12',
        username: 'a b',
      }).success,
    ).toBe(false);
  });
  it('allows an omitted username', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'secret12' })
        .success,
    ).toBe(true);
  });
});

describe('loginSchema', () => {
  it('defaults rememberMe to false', () => {
    const parsed = loginSchema.parse({ email: 'a@b.com', password: 'x' });
    expect(parsed.rememberMe).toBe(false);
  });
});

describe('verifySchema', () => {
  it('rejects an empty token', () => {
    expect(verifySchema.safeParse({ token: '' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/shared run test -- auth.schema`
Expected: FAIL — cannot find `./auth.schema`.

- [ ] **Step 3: Implement the schemas** — `packages/shared/src/schemas/auth.schema.ts`

```ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/\d/, 'Must contain a number'),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^\S+$/, 'No spaces allowed')
    .optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const verifySchema = z.object({ token: z.string().min(1) });
export type VerifyDto = z.infer<typeof verifySchema>;

export const resendVerificationSchema = z.object({ email: z.string().email() });
export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;
```

- [ ] **Step 4: Implement the DTOs** — `packages/shared/src/dto/user.dto.ts`

```ts
import { z } from 'zod';

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
});
export type PublicUserDto = z.infer<typeof publicUserSchema>;

export const publicProfileSchema = z.object({
  username: z.string(),
  avatarUrl: z.string().nullable(),
  memberSince: z.string(), // ISO date string (Prisma DateTime serializes to string)
});
export type PublicProfileDto = z.infer<typeof publicProfileSchema>;
```

`packages/shared/src/dto/auth.dto.ts`:

```ts
import { z } from 'zod';
import { publicUserSchema } from './user.dto';

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
});
export type AuthResponseDto = z.infer<typeof authResponseSchema>;

export const messageResponseSchema = z.object({ message: z.string() });
export type MessageResponseDto = z.infer<typeof messageResponseSchema>;
```

- [ ] **Step 5: Append exports to `packages/shared/src/index.ts`**

```ts
export * from './schemas/auth.schema';
export * from './dto/user.dto';
export * from './dto/auth.dto';
```

- [ ] **Step 6: Run tests, then build**

Run: `pnpm --filter @sobrebox/shared run test -- auth.schema` → PASS.
Run: `pnpm --filter @sobrebox/shared run build` → emits updated `dist`.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add auth + user zod contracts"
```

---

## Task 2: Prisma schema — auth fields + Session + VerificationToken (migration)

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: migration under `apps/api/prisma/migrations/`

**Interfaces — Produces:** Prisma models `Session`, `VerificationToken`; `User.passwordHash/emailVerified/avatarUrl/bio`.

- [ ] **Step 1: Add fields + models to `apps/api/prisma/schema.prisma`**

Add to `model User` (alongside existing fields/relations):

```prisma
  passwordHash       String
  emailVerified      Boolean             @default(false)
  avatarUrl          String?
  bio                String?
  sessions           Session[]
  verificationTokens VerificationToken[]
```

Add two new models:

```prisma
model Session {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tokenHash String    @unique
  userAgent String?
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  @@index([userId])
}

model VerificationToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  tokenHash  String    @unique
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Start infra and create the migration**

Run:

```bash
pnpm infra:up
pnpm db:migrate -- --name add_auth_user_fields
```

Expected: new folder `prisma/migrations/<ts>_add_auth_user_fields/`, `prisma generate` runs. (The seed has no users, so the non-null `passwordHash` needs no backfill.)

- [ ] **Step 3: Verify the client typechecks**

Run: `pnpm --filter @sobrebox/api exec tsc --noEmit`
Expected: clean (Prisma client now exposes `session`, `verificationToken`, new `user` fields).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): add auth user fields, Session and VerificationToken models"
```

---

## Task 3: Redis module + service (TDD)

**Files:**

- Create: `apps/api/src/redis/redis.module.ts`, `apps/api/src/redis/redis.service.ts`
- Test: `apps/api/src/redis/redis.service.spec.ts`

**Interfaces — Produces:**

- `REDIS_CLIENT` injection token
- `RedisService.incrWithTtl(key: string, ttlSeconds: number): Promise<number>`
- `RedisService.get(key: string): Promise<string | null>`
- `RedisService.del(key: string): Promise<void>`

- [ ] **Step 1: Write the failing test** — `apps/api/src/redis/redis.service.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { REDIS_CLIENT } from './redis.module';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  const client = {
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };
  let service: RedisService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [RedisService, { provide: REDIS_CLIENT, useValue: client }],
    }).compile();
    service = moduleRef.get(RedisService);
  });

  it('sets a TTL only on the first increment', async () => {
    client.incr.mockResolvedValueOnce(1);
    await service.incrWithTtl('k', 900);
    expect(client.expire).toHaveBeenCalledWith('k', 900);
  });

  it('does not reset TTL on later increments', async () => {
    client.incr.mockResolvedValueOnce(2);
    await service.incrWithTtl('k', 900);
    expect(client.expire).not.toHaveBeenCalled();
  });

  it('delegates get and del', async () => {
    client.get.mockResolvedValueOnce('3');
    expect(await service.get('k')).toBe('3');
    await service.del('k');
    expect(client.del).toHaveBeenCalledWith('k');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/api run test -- redis.service`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Implement the module** — `apps/api/src/redis/redis.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
```

`apps/api/src/redis/redis.service.ts`:

```ts
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, ttlSeconds);
    return n;
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- redis.service` → PASS.

- [ ] **Step 5: Add `ioredis` and commit**

```bash
pnpm --filter @sobrebox/api add ioredis
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat(api): add redis module with ttl-aware counter service"
```

---

## Task 4: Mail module — transport switch (TDD)

**Files:**

- Create: `apps/api/src/mail/{mail.service.ts,smtp-mail.service.ts,resend-mail.service.ts,mail.module.ts,mail-templates.ts}`
- Test: `apps/api/src/mail/{mail.module.spec.ts,smtp-mail.service.spec.ts,resend-mail.service.spec.ts,mail-templates.spec.ts}`

**Interfaces — Produces:**

- abstract `MailService.sendVerificationEmail(to: string, token: string): Promise<void>` (DI token)
- `selectMailService(): Type<MailService>`
- `buildVerificationEmail(token: string): { subject: string; html: string; text: string }`

- [ ] **Step 1: Write the failing template + selection tests**

`apps/api/src/mail/mail-templates.spec.ts`:

```ts
import { buildVerificationEmail } from './mail-templates';

describe('buildVerificationEmail', () => {
  it('embeds a verify link with the token', () => {
    process.env.WEB_PUBLIC_URL = 'http://localhost:3101';
    const { subject, html, text } = buildVerificationEmail('tok123');
    expect(subject).toMatch(/verif/i);
    expect(html).toContain('http://localhost:3101/verify?token=tok123');
    expect(text).toContain('tok123');
  });
});
```

`apps/api/src/mail/mail.module.spec.ts`:

```ts
import { selectMailService } from './mail.module';
import { SmtpMailService } from './smtp-mail.service';
import { ResendMailService } from './resend-mail.service';

describe('selectMailService', () => {
  const OLD = process.env.MAIL_TRANSPORT;
  afterEach(() => {
    if (OLD === undefined) delete process.env.MAIL_TRANSPORT;
    else process.env.MAIL_TRANSPORT = OLD;
  });

  it('returns ResendMailService when MAIL_TRANSPORT=resend', () => {
    process.env.MAIL_TRANSPORT = 'resend';
    expect(selectMailService()).toBe(ResendMailService);
  });

  it('returns SmtpMailService otherwise', () => {
    delete process.env.MAIL_TRANSPORT;
    expect(selectMailService()).toBe(SmtpMailService);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/api run test -- mail`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement templates** — `apps/api/src/mail/mail-templates.ts`

```ts
export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildVerificationEmail(token: string): MailContent {
  const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3101';
  const link = `${base}/verify?token=${token}`;
  return {
    subject: 'Verify your SobreBox account',
    html: `<p>Welcome to SobreBox!</p><p>Confirm your email: <a href="${link}">${link}</a></p>`,
    text: `Welcome to SobreBox! Confirm your email: ${link}`,
  };
}
```

- [ ] **Step 4: Implement the abstract token** — `apps/api/src/mail/mail.service.ts`

```ts
// Abstract class used as the Nest DI token so consumers depend on the interface,
// not a concrete transport.
export abstract class MailService {
  abstract sendVerificationEmail(to: string, token: string): Promise<void>;
}
```

- [ ] **Step 5: Implement the two transports**

`apps/api/src/mail/smtp-mail.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MailService } from './mail.service';
import { buildVerificationEmail } from './mail-templates';

@Injectable()
export class SmtpMailService extends MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_SMTP_HOST ?? 'localhost',
      port: Number(process.env.MAIL_SMTP_PORT ?? '1025'),
      secure: false,
    });
    this.from = process.env.MAIL_FROM ?? 'no-reply@sobrebox.local';
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(token);
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
    });
  }
}
```

`apps/api/src/mail/resend-mail.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { MailService } from './mail.service';
import { buildVerificationEmail } from './mail-templates';

@Injectable()
export class ResendMailService extends MailService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    super();
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.MAIL_FROM ?? 'no-reply@sobrebox.local';
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(token);
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
      text,
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
  }
}
```

- [ ] **Step 6: Implement the module** — `apps/api/src/mail/mail.module.ts`

```ts
import { Module, Provider, Type } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmtpMailService } from './smtp-mail.service';
import { ResendMailService } from './resend-mail.service';

export function selectMailService(): Type<MailService> {
  return process.env.MAIL_TRANSPORT === 'resend'
    ? ResendMailService
    : SmtpMailService;
}

const mailProvider: Provider = {
  provide: MailService,
  useClass: selectMailService(),
};

@Module({ providers: [mailProvider], exports: [MailService] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MailModule {}
```

- [ ] **Step 7: Write transport unit tests**

`apps/api/src/mail/smtp-mail.service.spec.ts`:

```ts
const sendMail = jest.fn().mockResolvedValue(undefined);
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));

import { SmtpMailService } from './smtp-mail.service';

describe('SmtpMailService', () => {
  it('sends a verification email via the transporter', async () => {
    await new SmtpMailService().sendVerificationEmail('u@test.com', 'tok');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u@test.com',
        subject: expect.stringMatching(/verif/i),
      }),
    );
  });
});
```

`apps/api/src/mail/resend-mail.service.spec.ts`:

```ts
const send = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));

import { ResendMailService } from './resend-mail.service';

describe('ResendMailService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends via Resend', async () => {
    send.mockResolvedValueOnce({ error: null });
    await new ResendMailService().sendVerificationEmail('u@test.com', 'tok');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u@test.com' }),
    );
  });

  it('throws when Resend returns an error', async () => {
    send.mockResolvedValueOnce({ error: { message: 'boom' } });
    await expect(
      new ResendMailService().sendVerificationEmail('u@test.com', 'tok'),
    ).rejects.toThrow(/boom/);
  });
});
```

- [ ] **Step 8: Run tests to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- mail` → PASS.

- [ ] **Step 9: Add deps and commit**

```bash
pnpm --filter @sobrebox/api add nodemailer resend
pnpm --filter @sobrebox/api add -D @types/nodemailer
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat(api): add mail module with mailpit/resend transport switch"
```

---

## Task 5: Auth crypto utils — argon2 + opaque tokens (TDD)

**Files:**

- Create: `apps/api/src/auth/password.util.ts`, `apps/api/src/auth/token.util.ts`
- Test: `apps/api/src/auth/password.util.spec.ts`, `apps/api/src/auth/token.util.spec.ts`

**Interfaces — Produces:**

- `hashPassword(plain: string): Promise<string>`, `verifyPassword(hash: string, plain: string): Promise<boolean>`
- `generateOpaqueToken(): string`, `sha256(value: string): string`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/auth/password.util.spec.ts`:

```ts
import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes to something other than the plaintext and verifies', async () => {
    const hash = await hashPassword('secret12');
    expect(hash).not.toBe('secret12');
    expect(await verifyPassword(hash, 'secret12')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});
```

`apps/api/src/auth/token.util.spec.ts`:

```ts
import { generateOpaqueToken, sha256 } from './token.util';

describe('token.util', () => {
  it('generates distinct url-safe tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('hashes deterministically', () => {
    expect(sha256('x')).toBe(sha256('x'));
    expect(sha256('x')).not.toBe(sha256('y'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/api run test -- "password.util|token.util"`
Expected: FAIL — not found.

- [ ] **Step 3: Implement** — `apps/api/src/auth/password.util.ts`

```ts
import * as argon2 from 'argon2';

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

`apps/api/src/auth/token.util.ts`:

```ts
import { createHash, randomBytes } from 'crypto';

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- "password.util|token.util"` → PASS.

- [ ] **Step 5: Add argon2 and commit**

```bash
pnpm --filter @sobrebox/api add argon2
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat(api): add argon2 password hashing and opaque-token utils"
```

---

## Task 6: Token service — access JWT + rotating refresh sessions (TDD)

**Files:**

- Create: `apps/api/src/auth/auth.constants.ts`, `apps/api/src/auth/token.service.ts`
- Test: `apps/api/src/auth/token.service.spec.ts`

**Interfaces — Consumes:** `sha256`, `generateOpaqueToken` (Task 5); `PrismaService` (foundation); `JwtService` (`@nestjs/jwt`).
**Produces:**

- `AUTH` constants object (`accessTtl`, `refreshDays`, `rememberDays`, `lockoutMax`, `lockoutWindowMin`)
- `TokenService.issueAccessToken(user: { id: string; email: string; username: string }): string`
- `TokenService.issueRefreshToken(userId: string, userAgent: string | undefined, days: number): Promise<string>`
- `TokenService.rotate(rawToken: string, userAgent?: string): Promise<{ userId: string; refreshToken: string }>`
- `TokenService.revoke(rawToken: string): Promise<void>`
- `TokenService.revokeAllForUser(userId: string): Promise<void>`

- [ ] **Step 1: Implement constants** — `apps/api/src/auth/auth.constants.ts`

```ts
export const AUTH = {
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? '7'),
  rememberDays: Number(process.env.JWT_REFRESH_REMEMBER_DAYS ?? '30'),
  lockoutMax: Number(process.env.LOCKOUT_MAX_ATTEMPTS ?? '5'),
  lockoutWindowMin: Number(process.env.LOCKOUT_WINDOW_MIN ?? '15'),
} as const;
```

- [ ] **Step 2: Write the failing test** — `apps/api/src/auth/token.service.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { sha256 } from './token.util';

describe('TokenService', () => {
  const session = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { session } as unknown as PrismaService;
  const jwt = {
    sign: jest.fn().mockReturnValue('access.jwt'),
  } as unknown as JwtService;
  let service: TokenService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(TokenService);
  });

  it('issues an access token from the JWT payload', () => {
    expect(
      service.issueAccessToken({ id: '1', email: 'a@b.com', username: 'neo' }),
    ).toBe('access.jwt');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: '1', email: 'a@b.com', username: 'neo' }),
    );
  });

  it('persists the HASH of a new refresh token', async () => {
    session.create.mockResolvedValueOnce({});
    const raw = await service.issueRefreshToken('1', 'ua', 7);
    expect(session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: '1', tokenHash: sha256(raw) }),
      }),
    );
  });

  it('rotates a valid token: revokes the old, issues a new', async () => {
    const now = Date.now();
    session.findUnique.mockResolvedValueOnce({
      id: 's1',
      userId: '1',
      revokedAt: null,
      expiresAt: new Date(now + 1e6),
      createdAt: new Date(now - 1e6),
    });
    session.create.mockResolvedValueOnce({});
    const out = await service.rotate('rawtok', 'ua');
    expect(session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    expect(out.userId).toBe('1');
    expect(out.refreshToken).toEqual(expect.any(String));
  });

  it('detects reuse of a revoked token and revokes all sessions', async () => {
    session.findUnique.mockResolvedValueOnce({
      id: 's1',
      userId: '1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1e6),
      createdAt: new Date(),
    });
    await expect(service.rotate('rawtok')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: '1' }),
      }),
    );
  });

  it('rejects an unknown token', async () => {
    session.findUnique.mockResolvedValueOnce(null);
    await expect(service.rotate('rawtok')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    session.findUnique.mockResolvedValueOnce({
      id: 's1',
      userId: '1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1),
      createdAt: new Date(Date.now() - 1e6),
    });
    await expect(service.rotate('rawtok')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @sobrebox/api run test -- token.service`
Expected: FAIL — `TokenService` not found.

- [ ] **Step 4: Implement** — `apps/api/src/auth/token.service.ts`

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { generateOpaqueToken, sha256 } from './token.util';

const DAY_MS = 86_400_000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  issueAccessToken(user: {
    id: string;
    email: string;
    username: string;
  }): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
    });
  }

  async issueRefreshToken(
    userId: string,
    userAgent: string | undefined,
    days: number,
  ): Promise<string> {
    const raw = generateOpaqueToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        userAgent,
        expiresAt: new Date(Date.now() + days * DAY_MS),
      },
    });
    return raw;
  }

  async rotate(
    rawToken: string,
    userAgent?: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt) {
      // Reuse of an already-rotated token → assume theft, kill the whole chain.
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (session.expiresAt.getTime() < Date.now())
      throw new UnauthorizedException('Refresh token expired');

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    // Preserve the original remember-window length across rotations.
    const days = Math.max(
      1,
      Math.round(
        (session.expiresAt.getTime() - session.createdAt.getTime()) / DAY_MS,
      ),
    );
    const refreshToken = await this.issueRefreshToken(
      session.userId,
      userAgent,
      days,
    );
    return { userId: session.userId, refreshToken };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- token.service` → PASS.

- [ ] **Step 6: Add @nestjs/jwt and commit**

```bash
pnpm --filter @sobrebox/api add @nestjs/jwt
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat(api): add token service with rotating refresh sessions"
```

---

## Task 7: Auth service — register/verify/login/refresh/logout (TDD)

**Files:**

- Create: `apps/api/src/auth/auth.service.ts`
- Test: `apps/api/src/auth/auth.service.flow.spec.ts`, `apps/api/src/auth/auth.service.errors.spec.ts`

**Interfaces — Consumes:** `PrismaService`; `UsersService.deriveUniqueUsername` (Task 10 — define the method now, used here); `MailService` (Task 4); `RedisService` (Task 3); `TokenService` (Task 6); `hashPassword`/`verifyPassword` (Task 5); `AUTH` (Task 6); shared `RegisterDto`/`LoginDto`/`AuthResponseDto`/`MessageResponseDto`/`PublicUserDto`.
**Produces:**

- `AuthService.register(dto: RegisterDto): Promise<MessageResponseDto>`
- `AuthService.resendVerification(email: string): Promise<MessageResponseDto>`
- `AuthService.verifyEmail(token: string): Promise<MessageResponseDto>`
- `AuthService.login(dto: LoginDto, userAgent?: string): Promise<{ auth: AuthResponseDto; refreshToken: string; rememberMe: boolean }>`
- `AuthService.refresh(rawToken: string, userAgent?: string): Promise<{ accessToken: string; refreshToken: string }>`
- `AuthService.logout(rawToken: string): Promise<MessageResponseDto>`
- `AuthService.toPublicUser(user): PublicUserDto`

> **Note:** `UsersService` is built in Task 10 but `AuthService` depends on its `deriveUniqueUsername(base: string): Promise<string>`. Tests here mock `UsersService`; Task 10 supplies the real one before the module wires together (Task 9 imports both).

- [ ] **Step 1: Write the happy-path test** — `apps/api/src/auth/auth.service.flow.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import * as pw from './password.util';

jest.mock('./password.util');

const VERIFIED_USER = {
  id: '1',
  email: 'a@b.com',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
  passwordHash: 'h',
  bio: null,
  createdAt: new Date(),
};

describe('AuthService (flow)', () => {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    verificationToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: unknown[]) => Promise.all(ops)),
  };
  const users = { deriveUniqueUsername: jest.fn().mockResolvedValue('neo') };
  const mail = { sendVerificationEmail: jest.fn() };
  const redis = { get: jest.fn(), del: jest.fn(), incrWithTtl: jest.fn() };
  const tokens = {
    issueAccessToken: jest.fn().mockReturnValue('access.jwt'),
    issueRefreshToken: jest.fn().mockResolvedValue('refresh.raw'),
  };
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (pw.hashPassword as jest.Mock).mockResolvedValue('hashed');
    (pw.verifyPassword as jest.Mock).mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
        { provide: RedisService, useValue: redis },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('register creates a user and sends a verification email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // email free
    prisma.user.create.mockResolvedValueOnce({ id: '1', email: 'a@b.com' });
    const res = await service.register({
      email: 'a@b.com',
      password: 'secret12',
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'a@b.com',
          username: 'neo',
          passwordHash: 'hashed',
        }),
      }),
    );
    expect(mail.sendVerificationEmail).toHaveBeenCalled();
    expect(res.message).toEqual(expect.any(String));
  });

  it('verifyEmail marks the user verified and consumes the token', async () => {
    prisma.verificationToken.findUnique.mockResolvedValueOnce({
      id: 'vt1',
      userId: '1',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 1e6),
    });
    await service.verifyEmail('rawtok');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('login returns access + refresh for a verified user', async () => {
    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce(VERIFIED_USER);
    const out = await service.login(
      { email: 'a@b.com', password: 'secret12', rememberMe: false },
      'ua',
    );
    expect(out.auth.accessToken).toBe('access.jwt');
    expect(out.refreshToken).toBe('refresh.raw');
    expect(out.auth.user).toEqual(
      expect.objectContaining({
        id: '1',
        email: 'a@b.com',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      }),
    );
    expect(redis.del).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write the error-path test** — `apps/api/src/auth/auth.service.errors.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import * as pw from './password.util';

jest.mock('./password.util');

describe('AuthService (errors)', () => {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    verificationToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const users = { deriveUniqueUsername: jest.fn().mockResolvedValue('neo') };
  const mail = { sendVerificationEmail: jest.fn() };
  const redis = { get: jest.fn(), del: jest.fn(), incrWithTtl: jest.fn() };
  const tokens = { issueAccessToken: jest.fn(), issueRefreshToken: jest.fn() };
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (pw.hashPassword as jest.Mock).mockResolvedValue('hashed');
    (pw.verifyPassword as jest.Mock).mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
        { provide: RedisService, useValue: redis },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'x' });
    await expect(
      service.register({ email: 'a@b.com', password: 'secret12' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an explicit username already taken', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email free
      .mockResolvedValueOnce({ id: 'y' }); // username taken
    await expect(
      service.register({
        email: 'a@b.com',
        password: 'secret12',
        username: 'taken',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('verifyEmail rejects an expired token', async () => {
    prisma.verificationToken.findUnique.mockResolvedValueOnce({
      id: 'vt',
      userId: '1',
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.verifyEmail('t')).rejects.toThrow(BadRequestException);
  });

  it('login rejects a wrong password and counts the attempt', async () => {
    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: '1',
      email: 'a@b.com',
      passwordHash: 'h',
      emailVerified: true,
    });
    (pw.verifyPassword as jest.Mock).mockResolvedValueOnce(false);
    await expect(
      service.login({ email: 'a@b.com', password: 'bad', rememberMe: false }),
    ).rejects.toThrow(UnauthorizedException);
    expect(redis.incrWithTtl).toHaveBeenCalled();
  });

  it('login blocks an unverified user', async () => {
    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: '1',
      email: 'a@b.com',
      passwordHash: 'h',
      emailVerified: false,
    });
    await expect(
      service.login({
        email: 'a@b.com',
        password: 'secret12',
        rememberMe: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('login locks out after too many attempts', async () => {
    redis.get.mockResolvedValueOnce('5');
    await expect(
      service.login({
        email: 'a@b.com',
        password: 'secret12',
        rememberMe: false,
      }),
    ).rejects.toThrow(HttpException);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/api run test -- auth.service`
Expected: FAIL — `AuthService` not found.

- [ ] **Step 4: Implement** — `apps/api/src/auth/auth.service.ts`

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthResponseDto,
  LoginDto,
  MessageResponseDto,
  PublicUserDto,
  RegisterDto,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { hashPassword, verifyPassword } from './password.util';
import { generateOpaqueToken, sha256 } from './token.util';
import { AUTH } from './auth.constants';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

type DbUser = {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  passwordHash: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
  ) {}

  toPublicUser(
    u: Pick<
      DbUser,
      'id' | 'email' | 'username' | 'emailVerified' | 'avatarUrl'
    >,
  ): PublicUserDto {
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      emailVerified: u.emailVerified,
      avatarUrl: u.avatarUrl,
    };
  }

  async register(dto: RegisterDto): Promise<MessageResponseDto> {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('Email already registered');
    }
    if (
      dto.username &&
      (await this.prisma.user.findUnique({ where: { username: dto.username } }))
    ) {
      throw new ConflictException('Username already taken');
    }
    const username = await this.users.deriveUniqueUsername(
      dto.username ?? dto.email.split('@')[0],
    );
    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, username, passwordHash },
    });
    await this.issueVerification(user.id, dto.email);
    return {
      message:
        'Verification email sent. Check your inbox to activate your account.',
    };
  }

  async resendVerification(email: string): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified)
      await this.issueVerification(user.id, user.email);
    // Generic response — never reveal whether the email exists.
    return {
      message:
        'If that account exists and is unverified, a new link has been sent.',
    };
  }

  async verifyEmail(token: string): Promise<MessageResponseDto> {
    const vt = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!vt || vt.consumedAt || vt.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: vt.userId },
        data: { emailVerified: true },
      }),
      this.prisma.verificationToken.update({
        where: { id: vt.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    return { message: 'Email verified. You can now log in.' };
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
  ): Promise<{
    auth: AuthResponseDto;
    refreshToken: string;
    rememberMe: boolean;
  }> {
    const key = `lockout:${dto.email.toLowerCase()}`;
    const attempts = Number(await this.redis.get(key)) || 0;
    if (attempts >= AUTH.lockoutMax) {
      throw new HttpException(
        'Too many failed attempts. Try again later.',
        HttpStatus.LOCKED,
      );
    }

    const user = (await this.prisma.user.findUnique({
      where: { email: dto.email },
    })) as DbUser | null;
    const ok =
      user !== null && (await verifyPassword(user.passwordHash, dto.password));
    if (!user || !ok) {
      await this.redis.incrWithTtl(key, AUTH.lockoutWindowMin * 60);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.emailVerified) throw new ForbiddenException('EMAIL_NOT_VERIFIED');

    await this.redis.del(key);
    const days = dto.rememberMe ? AUTH.rememberDays : AUTH.refreshDays;
    const refreshToken = await this.tokens.issueRefreshToken(
      user.id,
      userAgent,
      days,
    );
    const accessToken = this.tokens.issueAccessToken(user);
    return {
      auth: { accessToken, user: this.toPublicUser(user) },
      refreshToken,
      rememberMe: dto.rememberMe,
    };
  }

  async refresh(
    rawToken: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId, refreshToken } = await this.tokens.rotate(
      rawToken,
      userAgent,
    );
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as DbUser | null;
    if (!user) throw new UnauthorizedException();
    return { accessToken: this.tokens.issueAccessToken(user), refreshToken };
  }

  async logout(rawToken: string): Promise<MessageResponseDto> {
    await this.tokens.revoke(rawToken);
    return { message: 'Logged out' };
  }

  private async issueVerification(
    userId: string,
    email: string,
  ): Promise<void> {
    await this.prisma.verificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const raw = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });
    await this.mail.sendVerificationEmail(email, raw);
  }
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- auth.service` → PASS (flow + errors).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): add auth service (register, verify, login, refresh, logout)"
```

---

## Task 8: Access JWT strategy, guard, decorator (TDD)

**Files:**

- Create: `apps/api/src/auth/strategies/jwt.strategy.ts`, `apps/api/src/auth/guards/jwt-auth.guard.ts`, `apps/api/src/auth/decorators/current-user.decorator.ts`
- Test: `apps/api/src/auth/strategies/jwt.strategy.spec.ts`

**Interfaces — Produces:**

- `JwtStrategy` (passport name `jwt`), `validate` → `{ id: string; email: string; username: string }`
- `JwtAuthGuard` (`AuthGuard('jwt')`)
- `@CurrentUser()` param decorator → `req.user`

- [ ] **Step 1: Write the failing test** — `apps/api/src/auth/strategies/jwt.strategy.spec.ts`

```ts
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps a JWT payload to the request user', () => {
    const user = new JwtStrategy().validate({
      sub: '1',
      email: 'a@b.com',
      username: 'neo',
    });
    expect(user).toEqual({ id: '1', email: 'a@b.com', username: 'neo' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/api run test -- jwt.strategy`
Expected: FAIL — not found.

- [ ] **Step 3: Implement strategy** — `apps/api/src/auth/strategies/jwt.strategy.ts`

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    });
  }

  validate(payload: JwtPayload): {
    id: string;
    email: string;
    username: string;
  } {
    return {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}
```

- [ ] **Step 4: Implement guard + decorator**

`apps/api/src/auth/guards/jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

`apps/api/src/auth/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  email: string;
  username: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    return ctx.switchToHttp().getRequest<{ user: RequestUser }>().user;
  },
);
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- jwt.strategy` → PASS.

- [ ] **Step 6: Add passport deps and commit**

```bash
pnpm --filter @sobrebox/api add @nestjs/passport passport passport-jwt
pnpm --filter @sobrebox/api add -D @types/passport-jwt
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat(api): add access jwt strategy, guard and current-user decorator"
```

---

## Task 9: Auth controller + module (TDD)

**Files:**

- Create: `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/src/auth/auth.controller.spec.ts`

**Interfaces — Consumes:** `AuthService` (Task 7), `JwtAuthGuard`/`CurrentUser` (Task 8), `ZodValidationPipe` (foundation), shared schemas/DTOs, `AUTH` constants.
**Produces:** `AuthController` with routes from the spec; `AuthModule` (imports Prisma is global, registers `JwtModule`, `PassportModule`, `MailModule`, provides `AuthService`/`TokenService`/`JwtStrategy`, imports `UsersModule`).

- [ ] **Step 1: Write the failing controller test** — `apps/api/src/auth/auth.controller.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const auth = {
    register: jest.fn().mockResolvedValue({ message: 'ok' }),
    login: jest.fn().mockResolvedValue({
      auth: { accessToken: 'a', user: { id: '1' } },
      refreshToken: 'r',
      rememberMe: false,
    }),
    refresh: jest
      .fn()
      .mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' }),
    logout: jest.fn().mockResolvedValue({ message: 'bye' }),
    verifyEmail: jest.fn().mockResolvedValue({ message: 'verified' }),
    resendVerification: jest.fn().mockResolvedValue({ message: 'sent' }),
  };
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('login sets the refresh cookie and returns the auth payload', async () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    const out = await controller.login(
      { email: 'a@b.com', password: 'secret12', rememberMe: false },
      { headers: { 'user-agent': 'ua' }, cookies: {} } as never,
      res as never,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'r',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(out).toEqual({ accessToken: 'a', user: { id: '1' } });
  });

  it('refresh reads the cookie and rotates', async () => {
    const res = { cookie: jest.fn() };
    await controller.refresh(
      { headers: {}, cookies: { refresh_token: 'r' } } as never,
      res as never,
    );
    expect(auth.refresh).toHaveBeenCalledWith('r', undefined);
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'r2',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('logout clears the cookie', async () => {
    const res = { clearCookie: jest.fn() };
    await controller.logout(
      { cookies: { refresh_token: 'r' } } as never,
      res as never,
    );
    expect(auth.logout).toHaveBeenCalledWith('r');
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ path: '/auth' }),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/api run test -- auth.controller`
Expected: FAIL — not found.

- [ ] **Step 3: Implement controller** — `apps/api/src/auth/auth.controller.ts`

```ts
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthResponseDto,
  loginSchema,
  LoginDto,
  MessageResponseDto,
  PublicUserDto,
  registerSchema,
  RegisterDto,
  resendVerificationSchema,
  ResendVerificationDto,
  verifySchema,
  VerifyDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from './decorators/current-user.decorator';
import { AUTH } from './auth.constants';

const DAY_MS = 86_400_000;
const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ): Promise<MessageResponseDto> {
    return this.auth.register(dto);
  }

  @Post('resend-verification')
  resend(
    @Body(new ZodValidationPipe(resendVerificationSchema))
    dto: ResendVerificationDto,
  ): Promise<MessageResponseDto> {
    return this.auth.resendVerification(dto.email);
  }

  @Post('verify')
  verify(
    @Body(new ZodValidationPipe(verifySchema)) dto: VerifyDto,
  ): Promise<MessageResponseDto> {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { auth, refreshToken, rememberMe } = await this.auth.login(
      dto,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken, rememberMe);
    return auth;
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = this.readRefreshCookie(req);
    const { accessToken, refreshToken } = await this.auth.refresh(
      token,
      req.headers['user-agent'],
    );
    // Rotation keeps the original window; re-set with the long maxAge is fine.
    this.setRefreshCookie(res, refreshToken, true);
    return { accessToken };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const token = this.readRefreshCookie(req);
    const out = await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return out;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser): PublicUserDto {
    // The strategy already validated the token; echo the identity claims.
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      emailVerified: true,
      avatarUrl: null,
    };
  }

  private readRefreshCookie(req: Request): string {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    if (!token) throw new UnauthorizedException('Missing refresh token');
    return token;
  }

  private setRefreshCookie(
    res: Response,
    token: string,
    rememberMe: boolean,
  ): void {
    const isProd = process.env.NODE_ENV === 'production';
    const days = rememberMe ? AUTH.rememberDays : AUTH.refreshDays;
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/auth',
      maxAge: days * DAY_MS,
    });
  }
}
```

> **Note:** `GET /auth/me` returns identity claims from the access token. A richer
> "me" (fresh `emailVerified`/`avatarUrl` from DB) is a trivial later addition; the
> public profile endpoint (Task 10) already reads fresh data.

- [ ] **Step 4: Implement module** — `apps/api/src/auth/auth.module.ts`

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AUTH } from './auth.constants';

@Module({
  imports: [
    PassportModule,
    MailModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      signOptions: { expiresIn: AUTH.accessTtl },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- auth.controller` → PASS.

- [ ] **Step 6: Add cookie-parser dep and commit** (used by `main.ts` in Task 11)

```bash
pnpm --filter @sobrebox/api add cookie-parser
pnpm --filter @sobrebox/api add -D @types/cookie-parser
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat(api): add auth controller and module"
```

---

## Task 10: Users module — derive username + public profile (TDD)

**Files:**

- Create: `apps/api/src/users/users.service.ts`, `apps/api/src/users/users.controller.ts`, `apps/api/src/users/users.module.ts`
- Test: `apps/api/src/users/users.service.spec.ts`, `apps/api/src/users/users.controller.spec.ts`

**Interfaces — Produces:**

- `UsersService.deriveUniqueUsername(base: string): Promise<string>`
- `UsersService.getPublicProfile(username: string): Promise<PublicProfileDto>`
- `UsersController` route `GET /users/:username`
- `UsersModule` (provides + exports `UsersService`, declares `UsersController`)

- [ ] **Step 1: Write the failing service test** — `apps/api/src/users/users.service.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const user = { findUnique: jest.fn() };
  const prisma = { user } as unknown as PrismaService;
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('returns the cleaned base username when free', async () => {
    user.findUnique.mockResolvedValueOnce(null);
    expect(await service.deriveUniqueUsername('Neo!')).toBe('neo');
  });

  it('appends a numeric suffix when taken', async () => {
    user.findUnique
      .mockResolvedValueOnce({ id: 'x' })
      .mockResolvedValueOnce(null);
    expect(await service.deriveUniqueUsername('neo')).toBe('neo1');
  });

  it('maps a profile and strips private fields', async () => {
    const created = new Date('2026-01-02T03:04:05.000Z');
    user.findUnique.mockResolvedValueOnce({
      username: 'neo',
      avatarUrl: null,
      createdAt: created,
      email: 'secret@b.com',
    });
    const profile = await service.getPublicProfile('neo');
    expect(profile).toEqual({
      username: 'neo',
      avatarUrl: null,
      memberSince: created.toISOString(),
    });
    expect(profile).not.toHaveProperty('email');
  });

  it('throws when the profile is missing', async () => {
    user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getPublicProfile('ghost')).rejects.toThrow(
      NotFoundException,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/api run test -- users.service`
Expected: FAIL — not found.

- [ ] **Step 3: Implement service** — `apps/api/src/users/users.service.ts`

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PublicProfileDto, publicProfileSchema } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async deriveUniqueUsername(base: string): Promise<string> {
    const clean =
      base
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20) || 'user';
    let candidate = clean;
    let i = 0;
    while (
      await this.prisma.user.findUnique({ where: { username: candidate } })
    ) {
      i += 1;
      candidate = `${clean.slice(0, 19 - String(i).length)}${i}`;
    }
    return candidate;
  }

  async getPublicProfile(username: string): Promise<PublicProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return publicProfileSchema.parse({
      username: user.username,
      avatarUrl: user.avatarUrl,
      memberSince: user.createdAt.toISOString(),
    });
  }
}
```

- [ ] **Step 4: Write the failing controller test** — `apps/api/src/users/users.controller.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const users = {
    getPublicProfile: jest.fn().mockResolvedValue({
      username: 'neo',
      avatarUrl: null,
      memberSince: 'x',
    }),
  };
  let controller: UsersController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: users }],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  it('returns the public profile for a username', async () => {
    expect(await controller.profile('neo')).toEqual({
      username: 'neo',
      avatarUrl: null,
      memberSince: 'x',
    });
    expect(users.getPublicProfile).toHaveBeenCalledWith('neo');
  });
});
```

- [ ] **Step 5: Implement controller + module**

`apps/api/src/users/users.controller.ts`:

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { PublicProfileDto } from '@sobrebox/shared';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':username')
  profile(@Param('username') username: string): Promise<PublicProfileDto> {
    return this.users.getPublicProfile(username);
  }
}
```

`apps/api/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- "users.service|users.controller"` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/users
git commit -m "feat(api): add users module with public profile read"
```

---

## Task 11: Wire app module + main.ts (CORS, cookies, Redis/Auth/Users)

**Files:**

- Modify: `apps/api/src/app.module.ts`, `apps/api/src/main.ts`

- [ ] **Step 1: Register modules in `apps/api/src/app.module.ts`**

Add imports so the file reads:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CollectionsModule } from './collections/collections.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CollectionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

> If `CollectionsModule`/`ConfigModule` lines already exist, keep them — only add
> `RedisModule`, `AuthModule`, `UsersModule`.

- [ ] **Step 2: Enable cookies + CORS in `apps/api/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3101')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });
  await app.listen(process.env.API_PORT ?? 3000);
}
void bootstrap();
```

- [ ] **Step 3: Verify the app boots and unit suite passes**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/api run test`
Expected: all unit specs PASS. (`main.ts` and `*.module.ts` are coverage-ignored per the foundation jest config.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat(api): wire redis/auth/users modules, cookies and cors"
```

---

## Task 12: Auth e2e — full flow (TDD against test DB)

**Files:**

- Create: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: Write the e2e test** — `apps/api/test/auth.e2e-spec.ts`

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { sha256 } from '../src/auth/token.util';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e_${Date.now()}@test.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('register → blocks login until verified → verify → login → refresh → profile', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({ email, password: 'secret12' })
      .expect(201);

    await request(server)
      .post('/auth/login')
      .send({ email, password: 'secret12' })
      .expect(403);

    // Pull the raw token out of the DB the same way the email link would carry it.
    const user = await prisma.user.findUnique({ where: { email } });
    const vt = await prisma.verificationToken.findFirst({
      where: { userId: user!.id, consumedAt: null },
    });
    // The stored hash matches sha256(rawToken); we re-mint a token row we can read back
    // is not possible, so verify via a freshly issued token through resend is overkill —
    // instead assert the verify endpoint rejects a bad token and accept the seeded one.
    expect(vt).not.toBeNull();

    // Issue a known token directly so the e2e can complete verification deterministically.
    const known = 'e2e-known-token';
    await prisma.verificationToken.update({
      where: { id: vt!.id },
      data: { tokenHash: sha256(known) },
    });
    await request(server)
      .post('/auth/verify')
      .send({ token: known })
      .expect(201);

    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'secret12' })
      .expect(201);
    expect(login.body.accessToken).toEqual(expect.any(String));
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const refresh = await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(201);
    expect(refresh.body.accessToken).toEqual(expect.any(String));

    const profile = await request(server)
      .get(`/users/${user!.username}`)
      .expect(200);
    expect(profile.body).toEqual(
      expect.objectContaining({
        username: user!.username,
        memberSince: expect.any(String),
      }),
    );
  });
});
```

> The verify step rewrites the token hash to a known value because the raw token
> only exists in the email; this keeps the e2e deterministic without scraping
> Mailpit. (A later slice can add a Mailpit-reading helper if desired.)

- [ ] **Step 2: Run the e2e (infra up + migrated)**

Run:

```bash
pnpm infra:up && pnpm db:deploy
pnpm --filter @sobrebox/shared run build
pnpm test:e2e -- auth
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/auth.e2e-spec.ts
git commit -m "test(api): add auth flow e2e (register, verify, login, refresh, profile)"
```

---

## Task 13: Web — auth API client + Zustand store (TDD)

**Files:**

- Create: `apps/web/lib/auth-store.ts`
- Modify: `apps/web/lib/api.ts`
- Test: `apps/web/lib/auth-store.test.ts`, `apps/web/lib/api.test.ts` (append)

**Interfaces — Produces:**

- `useAuthStore` (Zustand) with `{ accessToken: string | null; user: PublicUserDto | null; setSession(token, user); clear() }`
- `registerUser`, `loginUser`, `verifyEmail`, `resendVerification`, `logoutUser`, `fetchMe`, `fetchPublicProfile` in `lib/api.ts`

- [ ] **Step 1: Write the failing store test** — `apps/web/lib/auth-store.test.ts`

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

describe('useAuthStore', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('stores and clears a session', () => {
    useAuthStore.getState().setSession('tok', {
      id: '1',
      email: 'a@b.com',
      username: 'neo',
      emailVerified: true,
      avatarUrl: null,
    });
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().user?.username).toBe('neo');
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/web run test -- auth-store`
Expected: FAIL — not found.

- [ ] **Step 3: Implement the store** — `apps/web/lib/auth-store.ts`

```ts
import { create } from 'zustand';
import type { PublicUserDto } from '@sobrebox/shared';

interface AuthState {
  accessToken: string | null;
  user: PublicUserDto | null;
  setSession: (accessToken: string, user: PublicUserDto) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));
```

- [ ] **Step 4: Write the failing api-client test** — append to `apps/web/lib/api.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginUser, fetchPublicProfile } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('loginUser', () => {
  it('posts credentials and returns the auth payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'a',
        user: { id: '1', username: 'neo' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await loginUser({
      email: 'a@b.com',
      password: 'secret12',
      rememberMe: false,
    });
    expect(out.accessToken).toBe('a');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('throws the server message on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      }),
    );
    await expect(
      loginUser({ email: 'a@b.com', password: 'x', rememberMe: false }),
    ).rejects.toThrow(/Invalid credentials/);
  });
});

describe('fetchPublicProfile', () => {
  it('returns the profile json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ username: 'neo' }),
      }),
    );
    await expect(fetchPublicProfile('neo')).resolves.toEqual({
      username: 'neo',
    });
  });
});
```

- [ ] **Step 5: Implement the api client additions** — append to `apps/web/lib/api.ts`

```ts
import type {
  AuthResponseDto,
  LoginDto,
  MessageResponseDto,
  PublicProfileDto,
  PublicUserDto,
  RegisterDto,
} from '@sobrebox/shared';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function registerUser(dto: RegisterDto): Promise<MessageResponseDto> {
  return postJson('/auth/register', dto);
}
export function loginUser(dto: LoginDto): Promise<AuthResponseDto> {
  return postJson('/auth/login', dto);
}
export function verifyEmail(token: string): Promise<MessageResponseDto> {
  return postJson('/auth/verify', { token });
}
export function resendVerification(email: string): Promise<MessageResponseDto> {
  return postJson('/auth/resend-verification', { email });
}
export function logoutUser(): Promise<MessageResponseDto> {
  return postJson('/auth/logout', {});
}

export async function fetchPublicProfile(
  username: string,
): Promise<PublicProfileDto> {
  const res = await fetch(`${API_URL}/users/${username}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json() as Promise<PublicProfileDto>;
}

export async function fetchMe(accessToken: string): Promise<PublicUserDto> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to fetch me: ${res.status}`);
  return res.json() as Promise<PublicUserDto>;
}
```

> Reuse the existing `API_URL` constant already defined at the top of `lib/api.ts`.
> If `import` lines for these types are added, merge them with the existing import.

- [ ] **Step 6: Run tests to verify pass**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/web run test -- "auth-store|api"` → PASS.

- [ ] **Step 7: Add zustand and commit**

```bash
pnpm --filter @sobrebox/web add zustand
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat(web): add auth api client and zustand session store"
```

---

## Task 14: Web — register/login/verify pages (TDD on forms)

**Files:**

- Create: `apps/web/components/auth/register-form.tsx`, `apps/web/components/auth/login-form.tsx`
- Test: `apps/web/components/auth/register-form.test.tsx`, `apps/web/components/auth/login-form.test.tsx`
- Create: `apps/web/app/(auth)/register/page.tsx`, `apps/web/app/(auth)/login/page.tsx`, `apps/web/app/(auth)/verify/page.tsx`

**Interfaces — Consumes:** shared `registerSchema`/`loginSchema`, `registerUser`/`loginUser`/`verifyEmail` (Task 13), `useAuthStore` (Task 13).

- [ ] **Step 1: Write the failing login-form test** — `apps/web/components/auth/login-form.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginForm } from './login-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

describe('LoginForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a validation error for an invalid email', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
    expect(api.loginUser).not.toHaveBeenCalled();
  });

  it('submits valid credentials and shows API errors', async () => {
    (
      api.loginUser as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(api.loginUser).toHaveBeenCalled());
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @sobrebox/web run test -- login-form`
Expected: FAIL — not found.

- [ ] **Step 3: Implement login form** — `apps/web/components/auth/login-form.tsx`

```tsx
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@sobrebox/shared';
import { loginUser } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function LoginForm() {
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { accessToken, user } = await loginUser(values);
      setSession(accessToken, user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && (
        <p role="alert">{errors.email.message ?? 'Invalid email'}</p>
      )}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      <label>
        <input type="checkbox" {...register('rememberMe')} /> Remember me
      </label>

      {serverError && <p role="alert">{serverError}</p>}
      <button type="submit" disabled={isSubmitting}>
        Log in
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Write + run the failing register-form test, then implement**

`apps/web/components/auth/register-form.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RegisterForm } from './register-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

describe('RegisterForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a password with no number', async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(await screen.findByText(/number/i)).toBeInTheDocument();
    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it('shows the success message after registering', async () => {
    (
      api.registerUser as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ message: 'Verification email sent' });
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    await waitFor(() => expect(api.registerUser).toHaveBeenCalled());
    expect(
      await screen.findByText(/verification email sent/i),
    ).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @sobrebox/web run test -- register-form` → FAIL.

`apps/web/components/auth/register-form.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterDto } from '@sobrebox/shared';
import { registerUser } from '@/lib/api';

export function RegisterForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await registerUser(values);
      setMessage(res.message);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Registration failed',
      );
    }
  });

  if (message) return <p role="status">{message}</p>;

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && (
        <p role="alert">{errors.email.message ?? 'Invalid email'}</p>
      )}

      <label htmlFor="username">Username (optional)</label>
      <input id="username" {...register('username')} />
      {errors.username && <p role="alert">{errors.username.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      {serverError && <p role="alert">{serverError}</p>}
      <button type="submit" disabled={isSubmitting}>
        Sign up
      </button>
    </form>
  );
}
```

Run: `pnpm --filter @sobrebox/web run test -- "register-form|login-form"` → PASS.

- [ ] **Step 5: Add the route pages**

`apps/web/app/(auth)/register/page.tsx`:

```tsx
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <main>
      <h1>Create your account</h1>
      <RegisterForm />
    </main>
  );
}
```

`apps/web/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main>
      <h1>Log in</h1>
      <LoginForm />
    </main>
  );
}
```

`apps/web/app/(auth)/verify/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/lib/api';

export default function VerifyPage() {
  const params = useSearchParams();
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying…');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('error');
      setMessage('Missing verification token.');
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setState('ok');
        setMessage(res.message);
      })
      .catch((err: unknown) => {
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [params]);

  return (
    <main>
      <h1>Email verification</h1>
      <p role={state === 'error' ? 'alert' : 'status'}>{message}</p>
    </main>
  );
}
```

- [ ] **Step 6: Add deps, build shared, run web tests**

```bash
pnpm --filter @sobrebox/web add react-hook-form @hookform/resolvers
pnpm --filter @sobrebox/web add -D @testing-library/user-event
```

Run: `pnpm --filter @sobrebox/web run test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat(web): add register, login and verify pages"
```

---

## Task 15: Web — public profile page (RSC)

**Files:**

- Create: `apps/web/app/profile/[username]/page.tsx`

- [ ] **Step 1: Implement the page** — `apps/web/app/profile/[username]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { fetchPublicProfile } from '@/lib/api';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let profile;
  try {
    profile = await fetchPublicProfile(username);
  } catch {
    notFound();
  }
  return (
    <main>
      <h1>{profile.username}</h1>
      <p>Member since {new Date(profile.memberSince).toLocaleDateString()}</p>
    </main>
  );
}
```

> `params` is a Promise in Next 15 App Router. The page is excluded from unit
> coverage (App Router pages are integration-tested), consistent with the
> foundation `vitest.config` exclusions — add `app/profile/**` and `app/(auth)/**`
> to that exclude list if coverage flags them.

- [ ] **Step 2: Update web coverage excludes** — `apps/web/vitest.config.mts`

In the `coverage.exclude` array add:

```ts
'app/(auth)/**',
'app/profile/**',
```

- [ ] **Step 3: Verify build + coverage gate**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/web run test:cov`
Expected: PASS with ≥80% on all metrics.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): add public profile page"
```

---

## Task 16: Env, docs, and final verification

**Files:**

- Modify: `.env.example`, `.env`, `docs/ENDPOINT_PERMISSIONS.md`, `docs/FINDINGS.md`

- [ ] **Step 1: Add auth env to `.env.example`** (append; keep canonical defaults)

```text

# Auth
JWT_ACCESS_SECRET=changeme-access
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=7
JWT_REFRESH_REMEMBER_DAYS=30
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_WINDOW_MIN=15
NODE_ENV=development

# Mail
MAIL_TRANSPORT=smtp
MAIL_SMTP_HOST=localhost
MAIL_SMTP_PORT=1025
MAIL_FROM=no-reply@sobrebox.local
RESEND_API_KEY=

# Web ↔ API
WEB_PUBLIC_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3001
```

- [ ] **Step 2: Mirror into local `.env` with shifted values**

Append to `.env`:

```text

# Auth
JWT_ACCESS_SECRET=dev-access-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=7
JWT_REFRESH_REMEMBER_DAYS=30
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_WINDOW_MIN=15
NODE_ENV=development

# Mail (Mailpit on the shifted SMTP port)
MAIL_TRANSPORT=smtp
MAIL_SMTP_HOST=localhost
MAIL_SMTP_PORT=1026
MAIL_FROM=no-reply@sobrebox.local
RESEND_API_KEY=

# Web ↔ API (shifted ports; add the tailnet origin when testing on mobile)
WEB_PUBLIC_URL=http://localhost:3101
CORS_ORIGINS=http://localhost:3101
```

- [ ] **Step 3: Update `docs/ENDPOINT_PERMISSIONS.md`** — add rows + bump date

```markdown
| POST | /auth/register | Public | email, password, username?; sends verification |
| POST | /auth/resend-verification | Public | idempotent; no account enumeration |
| POST | /auth/verify | Public | { token } → marks email verified |
| POST | /auth/login | Public | sets refresh cookie; returns access + user |
| POST | /auth/refresh | Refresh cookie| rotates the refresh token; returns access |
| POST | /auth/logout | Refresh cookie| revokes the session; clears the cookie |
| GET | /auth/me | JWT | current user (access token) |
| GET | /users/:username | Public | public profile |
```

- [ ] **Step 4: Append gotchas to `docs/FINDINGS.md`**

```markdown
## Auth

- Passwords use **argon2id** (`argon2`, native addon with prebuilt binaries).
  High-entropy opaque tokens (refresh, verification) are hashed with **SHA-256**,
  not argon2 — argon2 is only for low-entropy secrets.
- Refresh tokens are **stateful**: random opaque strings, only the SHA-256 hash is
  stored in `Session`, rotated on every `/auth/refresh`; reuse of a rotated token
  revokes the whole chain.
- Cross-origin cookies: web (`:3101`/tailnet) and api (`:3100`) are different
  origins → CORS needs `credentials:true` + explicit `CORS_ORIGINS` (not `*`).
  Same **site** in dev (different ports on one host) so `sameSite='lax'` works;
  prod is cross-site → `sameSite='none'; secure`, gated on `NODE_ENV=production`.
  For mobile-over-tailnet, add the MagicDNS origin to `CORS_ORIGINS`.
- Lockout counters live in Redis (`lockout:<email>`), TTL = `LOCKOUT_WINDOW_MIN`.
- Login is blocked until `emailVerified`; the api returns `403 EMAIL_NOT_VERIFIED`
  so the UI can offer "resend".
```

- [ ] **Step 5: Full gate**

Run:

```bash
pnpm infra:up && pnpm db:deploy
pnpm --filter @sobrebox/shared run build
pnpm lint && pnpm type-check && pnpm test:cov
pnpm test:e2e -- auth
```

Expected: lint clean, types clean, unit coverage ≥80% (auth ≥90%), e2e PASS.

- [ ] **Step 6: graphify + commit**

```bash
graphify update . || true
git add .env.example docs/ENDPOINT_PERMISSIONS.md docs/FINDINGS.md
git commit -m "docs(auth): document auth endpoints, gotchas and env"
```

---

## Self-review (against the spec)

- **Spec §3 data model** → Task 2. **§4.1 redis** → Task 3. **§4.2 mail** → Task 4.
  **§4.3 auth** → Tasks 5–9. **§4.4 users** → Task 10. **§4.5 main/config** → Task 11.
  **§5 shared** → Task 1. **§6 frontend** → Tasks 13–15. **§7 testing** → folded into
  every task + Task 12 e2e. **§8 docs** → Task 16.
- **Deviation from spec §4.3 (documented):** refresh tokens are opaque DB rows, so
  there is **no `jwt-refresh` passport strategy / guard** — the refresh and logout
  endpoints read the httpOnly cookie directly and delegate to `TokenService.rotate`/
  `revoke`. This is the correct mechanism for opaque (non-JWT) refresh tokens and
  keeps the spec's stateful-rotation guarantee. `JWT_REFRESH_SECRET` from the spec
  is dropped for the same reason.
- **Type consistency:** `RegisterDto`/`LoginDto`/`VerifyDto`/`ResendVerificationDto`,
  `AuthResponseDto`/`MessageResponseDto`/`PublicUserDto`/`PublicProfileDto`,
  `AuthService.{register,resendVerification,verifyEmail,login,refresh,logout,toPublicUser}`,
  `TokenService.{issueAccessToken,issueRefreshToken,rotate,revoke,revokeAllForUser}`,
  `UsersService.{deriveUniqueUsername,getPublicProfile}`, `RedisService.{incrWithTtl,get,del}`,
  `MailService.sendVerificationEmail`, web `useAuthStore`/`loginUser`/`registerUser`/
  `verifyEmail`/`fetchPublicProfile`/`fetchMe` — each defined once and referenced by
  the same name across tasks.
- **No placeholders:** every code step carries real code; commands have expected output.

```

```
