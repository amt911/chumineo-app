# Marketplace Slice 1 (Listings + Browse) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user publish a sale listing from their inventory (with up to 5 extra photos) and let anyone browse/filter the marketplace, per `docs/superpowers/specs/2026-07-01-marketplace-listings-design.md`.

**Architecture:** New generic `storage/` module (RustFS via `@aws-sdk/client-s3`) + `image/` module (Sharp WebP compression) reused from route-page-app's pattern; new `marketplace/` module (`Listing`/`ListingPhoto` Prisma models) built on top; `User.country` added and exposed via a new `PATCH /users/me`; new `/marketplace` Next.js pages following the existing inventory/wishlist page conventions.

**Tech Stack:** NestJS 10, Prisma 6, Zod (`packages/shared`), `@aws-sdk/client-s3`, `sharp`, `@nestjs/platform-express` (`FilesInterceptor`), Next.js 15 (`app/[locale]`), TanStack Query v5, next-intl.

## Global Constraints

- CommonJS in `apps/api`/`packages/shared`, no `.js` extensions in imports.
- Recompile `packages/shared` (`pnpm build:shared`) before any consumer picks up shared changes — test/cov scripts do this via turbo `^build` automatically.
- No enum string literals — always import from `@sobrebox/shared`.
- Enum-parity guard (`apps/api/src/catalog/enum-parity.spec.ts`) must cover every new Prisma enum.
- DB entities only in `apps/api/prisma/schema.prisma`; migrations via `pnpm db:migrate`, never hand-edited.
- DTOs/enums/Zod schemas only in `packages/shared`, never duplicated.
- 80% coverage gate (statements/branches/functions/lines) in `api`, `web`, `shared`.
- Images always served via a `storage`/`StorageService` layer, never raw binaries from the API.
- Commits: Conventional Commits, English, scope = module name.

---

### Task 1: Shared — `ListingStatus` enum + `User.country` on existing user DTO

**Files:**

- Create: `packages/shared/src/enums/listing-status.ts`
- Modify: `packages/shared/src/dto/user.dto.ts`
- Create: `packages/shared/src/dto/user.dto.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Produces: `ListingStatus` enum (`ACTIVE`, `PAUSED`, `SOLD_OUT`); `PublicUserDto.country: string | null`; `updateProfileSchema` / `UpdateProfileDto` (`{ country?: string | null }`, ISO-3166 alpha-2, 2 uppercase letters).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/dto/user.dto.spec.ts
import { describe, expect, it } from 'vitest';
import { updateProfileSchema, publicUserSchema } from './user.dto';

describe('updateProfileSchema', () => {
  it('accepts a 2-letter uppercase ISO country code', () => {
    expect(updateProfileSchema.parse({ country: 'ES' })).toEqual({
      country: 'ES',
    });
  });
  it('allows clearing country with null', () => {
    expect(updateProfileSchema.parse({ country: null })).toEqual({
      country: null,
    });
  });
  it('rejects a lowercase or non-2-letter code', () => {
    expect(updateProfileSchema.safeParse({ country: 'es' }).success).toBe(
      false,
    );
    expect(updateProfileSchema.safeParse({ country: 'ESP' }).success).toBe(
      false,
    );
  });
});

describe('publicUserSchema', () => {
  it('accepts a row with country', () => {
    const row = {
      id: 'u1',
      email: 'a@b.com',
      username: 'a',
      emailVerified: true,
      avatarUrl: null,
      country: 'ES',
    };
    expect(publicUserSchema.parse(row)).toEqual(row);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/shared test -- user.dto.spec.ts`
Expected: FAIL — `updateProfileSchema` is not exported / `country` not recognized on `publicUserSchema`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/shared/src/enums/listing-status.ts
export enum ListingStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  SOLD_OUT = 'SOLD_OUT',
}
```

```typescript
// packages/shared/src/dto/user.dto.ts
import { z } from 'zod';

const countryCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Must be a 2-letter uppercase ISO-3166 code');

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  country: countryCode.nullable(),
});
export type PublicUserDto = z.infer<typeof publicUserSchema>;

export const publicProfileSchema = z.object({
  username: z.string(),
  avatarUrl: z.string().nullable(),
  memberSince: z.string(), // ISO date string (Prisma DateTime serializes to string)
});
export type PublicProfileDto = z.infer<typeof publicProfileSchema>;

export const updateProfileSchema = z
  .object({
    country: countryCode.nullable().optional(),
  })
  .refine((v) => v.country !== undefined, {
    message: 'At least one field is required',
  });
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
```

Update `packages/shared/src/index.ts` — add one line under the enums block:

```typescript
export * from './enums/listing-status';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/shared test -- user.dto.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/enums/listing-status.ts packages/shared/src/dto/user.dto.ts packages/shared/src/dto/user.dto.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): add ListingStatus enum + User.country to user DTOs"
```

---

### Task 2: Shared — marketplace DTOs (`Listing` + `ListingPhoto`)

**Files:**

- Create: `packages/shared/src/dto/marketplace.dto.ts`
- Create: `packages/shared/src/dto/marketplace.dto.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Consumes: `Condition` (`packages/shared/src/enums/condition.ts`), `ListingStatus` (Task 1), `Rarity` (`packages/shared/src/enums/rarity.ts`).
- Produces: `createListingSchema`/`CreateListingDto`, `updateListingSchema`/`UpdateListingDto`, `listingQuerySchema`/`ListingQueryDto`, `listingSchema`/`ListingDto`, `listingPhotoSchema`/`ListingPhotoDto`, `listingsPageSchema`/`ListingsPageDto`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/dto/marketplace.dto.spec.ts
import { describe, expect, it } from 'vitest';
import {
  createListingSchema,
  updateListingSchema,
  listingQuerySchema,
  listingSchema,
} from './marketplace.dto';
import { Condition } from '../enums/condition';
import { ListingStatus } from '../enums/listing-status';
import { Rarity } from '../enums/rarity';

describe('createListingSchema', () => {
  it('accepts a valid payload', () => {
    expect(
      createListingSchema.parse({
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: '19.99',
      }),
    ).toEqual({
      collectionItemId: 'ci1',
      quantity: 1,
      condition: Condition.MINT,
      price: '19.99',
    });
  });
  it('rejects quantity <= 0', () => {
    expect(
      createListingSchema.safeParse({
        collectionItemId: 'ci1',
        quantity: 0,
        condition: Condition.MINT,
        price: '19.99',
      }).success,
    ).toBe(false);
  });
  it('rejects a non-decimal price', () => {
    expect(
      createListingSchema.safeParse({
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: 'free',
      }).success,
    ).toBe(false);
  });
});

describe('updateListingSchema', () => {
  it('requires at least one field', () => {
    expect(updateListingSchema.safeParse({}).success).toBe(false);
  });
  it('accepts a status-only update', () => {
    expect(updateListingSchema.parse({ status: ListingStatus.PAUSED })).toEqual(
      { status: ListingStatus.PAUSED },
    );
  });
});

describe('listingQuerySchema', () => {
  it('defaults page to 1 and accepts a sort value', () => {
    expect(listingQuerySchema.parse({ sort: 'price_asc' })).toEqual({
      page: 1,
      sort: 'price_asc',
    });
  });
  it('rejects an unknown sort value', () => {
    expect(listingQuerySchema.safeParse({ sort: 'nonsense' }).success).toBe(
      false,
    );
  });
});

describe('listingSchema', () => {
  it('accepts a full row', () => {
    const row = {
      id: 'l1',
      quantity: 2,
      condition: Condition.MINT,
      price: '19.99',
      description: null,
      status: ListingStatus.ACTIVE,
      createdAt: '2026-07-01T00:00:00.000Z',
      item: {
        id: 'ci1',
        name: 'Charizard',
        rarity: Rarity.SECRET,
        imageUrl: null,
      },
      collection: { slug: 's', name: 'N' },
      seller: { username: 'ash', country: 'ES', avatarUrl: null },
      photos: [{ id: 'p1', url: 'https://example.com/p1.webp' }],
    };
    expect(listingSchema.parse(row)).toEqual(row);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/shared test -- marketplace.dto.spec.ts`
Expected: FAIL — module `./marketplace.dto` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/shared/src/dto/marketplace.dto.ts
import { z } from 'zod';
import { Condition } from '../enums/condition';
import { ListingStatus } from '../enums/listing-status';
import { Rarity } from '../enums/rarity';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a non-negative decimal string');

export const createListingSchema = z.object({
  collectionItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  condition: z.nativeEnum(Condition),
  price: decimalString,
  description: z.string().max(2000).optional(),
});
export type CreateListingDto = z.infer<typeof createListingSchema>;

export const updateListingSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    price: decimalString.optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.nativeEnum(ListingStatus).optional(),
  })
  .refine(
    (v) =>
      v.quantity !== undefined ||
      v.price !== undefined ||
      v.description !== undefined ||
      v.status !== undefined,
    { message: 'At least one field is required' },
  );
export type UpdateListingDto = z.infer<typeof updateListingSchema>;

const listingSortSchema = z.enum([
  'price_asc',
  'price_desc',
  'recent',
  'best_rated', // accepted but a no-op until reputationScore exists (US-25)
]);

export const listingQuerySchema = z.object({
  collectionId: z.string().optional(),
  collectionItemId: z.string().optional(),
  q: z.string().optional(),
  priceMin: decimalString.optional(),
  priceMax: decimalString.optional(),
  condition: z.nativeEnum(Condition).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  sort: listingSortSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
});
export type ListingQueryDto = z.infer<typeof listingQuerySchema>;

const itemRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  imageUrl: z.string().nullable(),
});

const collectionRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

const sellerRefSchema = z.object({
  username: z.string(),
  country: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const listingPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
});
export type ListingPhotoDto = z.infer<typeof listingPhotoSchema>;

export const listingSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  condition: z.nativeEnum(Condition),
  price: z.string(),
  description: z.string().nullable(),
  status: z.nativeEnum(ListingStatus),
  createdAt: z.string(),
  item: itemRefSchema,
  collection: collectionRefSchema,
  seller: sellerRefSchema,
  photos: z.array(listingPhotoSchema),
});
export type ListingDto = z.infer<typeof listingSchema>;

export const listingsPageSchema = z.object({
  items: z.array(listingSchema),
  page: z.number().int(),
  totalPages: z.number().int(),
  total: z.number().int(),
});
export type ListingsPageDto = z.infer<typeof listingsPageSchema>;
```

Update `packages/shared/src/index.ts` — add:

```typescript
export * from './dto/marketplace.dto';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/shared test -- marketplace.dto.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/dto/marketplace.dto.ts packages/shared/src/dto/marketplace.dto.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): add marketplace listing DTOs"
```

---

### Task 3: Prisma — `User.country`, `Listing`, `ListingPhoto`, `ListingStatus`

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create (generated): `apps/api/prisma/migrations/<timestamp>_marketplace_listings/migration.sql`
- Modify: `apps/api/src/catalog/enum-parity.spec.ts`

**Interfaces:**

- Produces: Prisma models `Listing`, `ListingPhoto`; enum `ListingStatus`; `User.country`, `User.listings`; `CollectionItem.listings`.

- [ ] **Step 1: Edit the schema**

Modify `User` model (`apps/api/prisma/schema.prisma`, current lines 52–69) to add `country` and the `listings` back-relation:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  username      String   @unique
  passwordHash  String
  emailVerified Boolean  @default(false)
  avatarUrl     String?
  bio           String?
  country       String?
  createdAt     DateTime @default(now())

  collections        Collection[]         @relation("CreatedCollections")
  revisions          CollectionRevision[]
  openings           Opening[]
  inventory          UserInventory[]
  wishlist           WishlistItem[]
  listings           Listing[]
  sessions           Session[]
  verificationTokens VerificationToken[]
}
```

Modify `CollectionItem` model (current lines 129–147) to add the `listings` back-relation:

```prisma
model CollectionItem {
  id               String     @id @default(cuid())
  collectionId     String
  collection       Collection @relation(fields: [collectionId], references: [id])
  name             String
  rarity           Rarity
  imageUrl         String?
  officialPullRate Decimal?   @db.Decimal(12, 8)
  externalId       String?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  openingItems   OpeningItem[]
  inventory      UserInventory[]
  wishlistItems  WishlistItem[]
  listings       Listing[]

  @@index([collectionId])
  @@index([externalId])
}
```

Add new enum + models at the end of the file:

```prisma
enum ListingStatus {
  ACTIVE
  PAUSED
  SOLD_OUT
}

model Listing {
  id               String         @id @default(cuid())
  sellerId         String
  seller           User           @relation(fields: [sellerId], references: [id])
  collectionItemId String
  collectionItem   CollectionItem @relation(fields: [collectionItemId], references: [id])
  quantity         Int
  condition        Condition
  price            Decimal        @db.Decimal(12, 2)
  description      String?
  status           ListingStatus  @default(ACTIVE)
  photos           ListingPhoto[]
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([collectionItemId])
  @@index([sellerId])
  @@index([status])
}

model ListingPhoto {
  id        String   @id @default(cuid())
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  key       String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Generate + apply the migration**

Run: `pnpm db:migrate` and enter name `marketplace_listings` when prompted (requires infra up: `pnpm infra:up` first if not already running).
Expected: creates `apps/api/prisma/migrations/<timestamp>_marketplace_listings/migration.sql`, applies cleanly, regenerates the Prisma client.

- [ ] **Step 3: Extend the enum-parity guard (failing first)**

Modify `apps/api/src/catalog/enum-parity.spec.ts` — add the import and a test case:

```typescript
import {
  CollectionCategory as PrismaCategory,
  CollectionSource as PrismaSource,
  CollectionStatus as PrismaStatus,
  Rarity as PrismaRarity,
  Condition as PrismaCondition,
  WishlistPriority as PrismaWishlistPriority,
  ListingStatus as PrismaListingStatus,
} from '@prisma/client';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
  Rarity,
  Condition,
  WishlistPriority,
  ListingStatus,
} from '@sobrebox/shared';

const sorted = (o: Record<string, string>) => Object.values(o).sort();

describe('enum parity (prisma <-> shared)', () => {
  it('Rarity matches', () =>
    expect(sorted(Rarity)).toEqual(sorted(PrismaRarity)));
  it('CollectionCategory matches', () =>
    expect(sorted(CollectionCategory)).toEqual(sorted(PrismaCategory)));
  it('CollectionStatus matches', () =>
    expect(sorted(CollectionStatus)).toEqual(sorted(PrismaStatus)));
  it('CollectionSource matches', () =>
    expect(sorted(CollectionSource)).toEqual(sorted(PrismaSource)));
  it('Condition matches', () =>
    expect(sorted(Condition)).toEqual(sorted(PrismaCondition)));
  it('WishlistPriority matches', () =>
    expect(sorted(WishlistPriority)).toEqual(sorted(PrismaWishlistPriority)));
  it('ListingStatus matches', () =>
    expect(sorted(ListingStatus)).toEqual(sorted(PrismaListingStatus)));
});
```

- [ ] **Step 4: Run the guard**

Run: `pnpm build:shared && pnpm --filter @sobrebox/api test -- enum-parity.spec.ts`
Expected: PASS (7 tests) — proves the Prisma enum and the shared enum agree.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/catalog/enum-parity.spec.ts
git commit -m "feat(db): add User.country + Listing/ListingPhoto models"
```

---

### Task 4: `PATCH /users/me` — update `country`

**Files:**

- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/users.service.spec.ts`

**Interfaces:**

- Consumes: `updateProfileSchema`/`UpdateProfileDto`, `publicUserSchema`/`PublicUserDto` (Task 1); `JwtAuthGuard` (`apps/api/src/auth/guards/jwt-auth.guard.ts`); `CurrentUser`/`RequestUser` (`apps/api/src/auth/decorators/current-user.decorator.ts`); `ZodValidationPipe` (`apps/api/src/common/zod-validation.pipe.ts`).
- Produces: `UsersService.updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUserDto>`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/users/users.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

function makePrisma() {
  return { user: { findUnique: jest.fn(), update: jest.fn() } };
}

describe('UsersService.updateProfile', () => {
  it('404s when the user does not exist', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new UsersService(prisma as never);
    await expect(
      service.updateProfile('missing', { country: 'ES' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates the country and returns a mapped DTO', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      username: 'ash',
      emailVerified: true,
      avatarUrl: null,
      country: 'ES',
    });
    const service = new UsersService(prisma as never);
    const dto = await service.updateProfile('u1', { country: 'ES' });
    expect(dto.country).toBe('ES');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { country: 'ES' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- users/users.service.spec.ts`
Expected: FAIL — `updateProfile` is not a function.

- [ ] **Step 3: Write minimal implementation**

Modify `apps/api/src/users/users.service.ts` — add the method and update `getAuthUser`'s mapping to include `country` (both read from the now-existing `country` column):

```typescript
async getAuthUser(id: string): Promise<PublicUserDto> {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundException('User not found');
  return publicUserSchema.parse({
    id: user.id,
    email: user.email,
    username: user.username,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    country: user.country,
  });
}

async updateProfile(
  id: string,
  dto: UpdateProfileDto,
): Promise<PublicUserDto> {
  const existing = await this.prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundException('User not found');
  const user = await this.prisma.user.update({
    where: { id },
    data: { country: dto.country },
  });
  return publicUserSchema.parse({
    id: user.id,
    email: user.email,
    username: user.username,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    country: user.country,
  });
}
```

Add the `UpdateProfileDto` import at the top of `users.service.ts` alongside the existing `@sobrebox/shared` import.

Modify `apps/api/src/users/users.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  PublicProfileDto,
  PublicUserDto,
  UpdateProfileDto,
  updateProfileSchema,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':username')
  profile(@Param('username') username: string): Promise<PublicProfileDto> {
    return this.users.getPublicProfile(username);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<PublicUserDto> {
    return this.users.updateProfile(user.id, dto);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- users/users.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/users/users.service.ts apps/api/src/users/users.controller.ts apps/api/src/users/users.service.spec.ts
git commit -m "feat(users): add PATCH /users/me to update country"
```

---

### Task 5: Storage module (RustFS S3-compatible client)

**Files:**

- Create: `apps/api/src/storage/s3-client.provider.ts`
- Create: `apps/api/src/storage/storage.service.ts`
- Create: `apps/api/src/storage/storage.service.spec.ts`
- Create: `apps/api/src/storage/s3-bucket-initializer.ts`
- Create: `apps/api/src/storage/storage.module.ts`
- Modify: `apps/api/package.json` (add `@aws-sdk/client-s3`)
- Modify: `apps/api/src/app.module.ts` (register `StorageModule`)

**Interfaces:**

- Produces: `StorageService.upload(key: string, data: Buffer, mimeType: string, cacheControl?: string): Promise<string>`, `StorageService.delete(key: string): Promise<void>`, `StorageService.getPublicUrl(key: string): string`. `StorageModule` is `@Global()`.

- [ ] **Step 1: Install the dependency**

Run: `pnpm --filter @sobrebox/api add @aws-sdk/client-s3@^3.1075.0`
Expected: adds it to `apps/api/package.json` dependencies and updates the lockfile.

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/src/storage/storage.service.spec.ts
import { StorageService } from './storage.service';

function makeS3() {
  return { send: jest.fn() };
}

describe('StorageService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, S3_PUBLIC_URL: 'http://localhost:9000' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('uploads and returns the key', async () => {
    const s3 = makeS3();
    s3.send.mockResolvedValue({});
    const service = new StorageService(s3 as never);
    const key = await service.upload(
      'marketplace-listings/l1/photo.webp',
      Buffer.from('x'),
      'image/webp',
    );
    expect(key).toBe('marketplace-listings/l1/photo.webp');
    expect(s3.send).toHaveBeenCalledTimes(1);
  });

  it('builds a public URL from S3_PUBLIC_URL', () => {
    const service = new StorageService(makeS3() as never);
    expect(service.getPublicUrl('marketplace-listings/l1/photo.webp')).toBe(
      'http://localhost:9000/marketplace-listings/l1/photo.webp',
    );
  });

  it('deletes a key', async () => {
    const s3 = makeS3();
    s3.send.mockResolvedValue({});
    const service = new StorageService(s3 as never);
    await service.delete('marketplace-listings/l1/photo.webp');
    expect(s3.send).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- storage/storage.service.spec.ts`
Expected: FAIL — `./storage.service` does not exist.

- [ ] **Step 4: Write minimal implementation**

```typescript
// apps/api/src/storage/s3-client.provider.ts
import { Provider } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = 'S3_CLIENT';

export const S3ClientProvider: Provider = {
  provide: S3_CLIENT,
  useFactory: (): S3Client => {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (endpoint == null || accessKeyId == null || secretAccessKey == null) {
      throw new Error(
        'S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY must be set as environment variables.',
      );
    }
    return new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  },
};
```

```typescript
// apps/api/src/storage/storage.service.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3_CLIENT } from './s3-client.provider';

@Injectable()
export class StorageService {
  constructor(@Inject(S3_CLIENT) private readonly s3: S3Client) {}

  private bucketAndPath(key: string): { bucket: string; path: string } {
    const [bucket, ...rest] = key.split('/');
    return { bucket, path: rest.join('/') };
  }

  async upload(
    key: string,
    data: Buffer,
    mimeType: string,
    cacheControl?: string,
  ): Promise<string> {
    const { bucket, path } = this.bucketAndPath(key);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: data,
        ContentType: mimeType,
        ...(cacheControl !== undefined ? { CacheControl: cacheControl } : {}),
      }),
    );
    return key;
  }

  async delete(key: string): Promise<void> {
    const { bucket, path } = this.bucketAndPath(key);
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
  }

  getPublicUrl(key: string): string {
    const base = process.env.S3_PUBLIC_URL ?? 'http://localhost:9000';
    return `${base}/${key}`;
  }
}
```

```typescript
// apps/api/src/storage/s3-bucket-initializer.ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3_CLIENT } from './s3-client.provider';

const PUBLIC_READ_BUCKETS = ['marketplace-listings'];

function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

@Injectable()
export class S3BucketInitializer implements OnModuleInit {
  constructor(@Inject(S3_CLIENT) private readonly s3: S3Client) {}

  async onModuleInit(): Promise<void> {
    if (process.env.S3_AUTO_CREATE_BUCKETS !== 'true') return;
    for (const bucket of PUBLIC_READ_BUCKETS) {
      await this.ensureBucket(bucket);
    }
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    await this.s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: publicReadPolicy(bucket),
      }),
    );
  }
}
```

```typescript
// apps/api/src/storage/storage.module.ts
import { Global, Module } from '@nestjs/common';
import { S3ClientProvider } from './s3-client.provider';
import { StorageService } from './storage.service';
import { S3BucketInitializer } from './s3-bucket-initializer';

@Global()
@Module({
  providers: [S3ClientProvider, StorageService, S3BucketInitializer],
  exports: [StorageService],
})
export class StorageModule {}
```

Modify `apps/api/src/app.module.ts` — add the import and register it right after `RedisModule`:

```typescript
import { StorageModule } from './storage/storage.module';
// ...
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    AuthModule,
    UsersModule,
    CollectionsModule,
    BrandsModule,
    InventoryModule,
    WishlistModule,
  ],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- storage/storage.service.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/storage apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(storage): add generic S3-compatible storage module for RustFS"
```

---

### Task 6: Image compression module (Sharp → WebP)

**Files:**

- Create: `apps/api/src/image/image-compressor.service.ts`
- Create: `apps/api/src/image/image-compressor.service.spec.ts`
- Create: `apps/api/src/image/image.module.ts`
- Modify: `apps/api/package.json` (add `sharp`)
- Modify: `apps/api/src/app.module.ts` (register `ImageModule`)

**Interfaces:**

- Produces: `ImageCompressorService.compress(input: Buffer): Promise<{ buffer: Buffer; mime: 'image/webp'; ext: 'webp' }>`. `ImageModule` is `@Global()`.

- [ ] **Step 1: Install the dependency**

Run: `pnpm --filter @sobrebox/api add sharp@^0.35.1`

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/src/image/image-compressor.service.spec.ts
import sharp from 'sharp';
import { ImageCompressorService } from './image-compressor.service';

describe('ImageCompressorService', () => {
  it('compresses a PNG into a WebP buffer under the byte budget', async () => {
    const input = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const service = new ImageCompressorService();
    const result = await service.compress(input);

    expect(result.mime).toBe('image/webp');
    expect(result.ext).toBe('webp');
    expect(result.buffer.byteLength).toBeLessThanOrEqual(256 * 1024);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
  });

  it('caps dimensions at 2048px on the longest side', async () => {
    const input = await sharp({
      create: {
        width: 4000,
        height: 1000,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const service = new ImageCompressorService();
    const result = await service.compress(input);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(2048);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- image/image-compressor.service.spec.ts`
Expected: FAIL — `./image-compressor.service` does not exist.

- [ ] **Step 4: Write minimal implementation**

```typescript
// apps/api/src/image/image-compressor.service.ts
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

const MAX_DIMENSION = 2048;
const MAX_BYTES = 256 * 1024;
const START_QUALITY = 80;
const MIN_QUALITY = 40;
const QUALITY_STEP = 10;
const DOWNSCALE_FACTOR = 0.75;
const MAX_ITERATIONS = 12;

export interface CompressedImage {
  buffer: Buffer;
  mime: 'image/webp';
  ext: 'webp';
}

@Injectable()
export class ImageCompressorService {
  async compress(input: Buffer): Promise<CompressedImage> {
    const base = sharp(input).rotate().resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });

    const { width: baseWidth } = await base.clone().metadata();
    let quality = START_QUALITY;
    let scale = 1;
    let best = await base.clone().webp({ quality }).toBuffer();

    for (let i = 1; i < MAX_ITERATIONS && best.byteLength > MAX_BYTES; i += 1) {
      if (quality - QUALITY_STEP >= MIN_QUALITY) {
        quality -= QUALITY_STEP;
        best = await base.clone().webp({ quality }).toBuffer();
      } else {
        scale *= DOWNSCALE_FACTOR;
        const width = Math.max(
          1,
          Math.round((baseWidth ?? MAX_DIMENSION) * scale),
        );
        best = await base
          .clone()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();
      }
    }

    return { buffer: best, mime: 'image/webp', ext: 'webp' };
  }
}
```

```typescript
// apps/api/src/image/image.module.ts
import { Global, Module } from '@nestjs/common';
import { ImageCompressorService } from './image-compressor.service';

@Global()
@Module({
  providers: [ImageCompressorService],
  exports: [ImageCompressorService],
})
export class ImageModule {}
```

Modify `apps/api/src/app.module.ts` — add the import and register right after `StorageModule`:

```typescript
import { ImageModule } from './image/image.module';
// ...
    StorageModule,
    ImageModule,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- image/image-compressor.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/image apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(image): add Sharp-based WebP compressor"
```

---

### Task 7: Dev infra — RustFS service in `docker-compose.yml` + `.env.example`

**Files:**

- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Add the RustFS service**

Modify `docker-compose.yml` — add a new service alongside `sobrebox-db`/`sobrebox-redis`/`sobrebox-mailpit`:

```yaml
sobrebox-rustfs:
  image: rustfs/rustfs
  container_name: sobrebox-rustfs
  ports:
    - '${RUSTFS_S3_PORT}:9000'
    - '${RUSTFS_CONSOLE_PORT}:9001'
  environment:
    RUSTFS_ACCESS_KEY: ${S3_ACCESS_KEY}
    RUSTFS_SECRET_KEY: ${S3_SECRET_KEY}
    RUSTFS_VOLUMES: /data
  volumes:
    - sobrebox_rustfs_data:/data
```

Add `sobrebox_rustfs_data` to the top-level `volumes:` block next to `sobrebox_db_data`.

- [ ] **Step 2: Add the env vars**

Modify `.env.example` — insert a new "Storage (RustFS / S3)" section after the Mail section:

```
# Storage (RustFS / S3-compatible)
RUSTFS_S3_PORT=9000
RUSTFS_CONSOLE_PORT=9001
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=sobrebox
S3_SECRET_KEY=sobrebox-dev-secret
S3_PUBLIC_URL=http://localhost:9000
S3_AUTO_CREATE_BUCKETS=true
```

(For the `sobrebox-api` container itself, `S3_ENDPOINT` must resolve to `http://sobrebox-rustfs:9000` — add that override to the `sobrebox-api` service's `environment:` block in `docker-compose.yml`, next to its existing `DATABASE_URL`/`REDIS_URL` overrides.)

- [ ] **Step 3: Verify infra boots**

Run: `pnpm infra:up`
Expected: `sobrebox-rustfs` container starts healthy alongside db/redis/mailpit; `docker compose ps` shows it `Up`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore(dev): add RustFS service for local S3-compatible storage"
```

---

### Task 8: Marketplace backend — listings CRUD

**Files:**

- Create: `apps/api/src/marketplace/marketplace.module.ts`
- Create: `apps/api/src/marketplace/listings.controller.ts`
- Create: `apps/api/src/marketplace/listings.service.ts`
- Create: `apps/api/src/marketplace/listings.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `MarketplaceModule`)

**Interfaces:**

- Consumes: `createListingSchema`/`CreateListingDto`, `updateListingSchema`/`UpdateListingDto`, `listingQuerySchema`/`ListingQueryDto`, `listingSchema`/`ListingDto`, `listingsPageSchema`/`ListingsPageDto` (Task 2); `StorageService.getPublicUrl` (Task 5); `PrismaService`; `JwtAuthGuard`, `CurrentUser`/`RequestUser`, `ZodValidationPipe`.
- Produces: `ListingsService.create/listPublic/getById/update/remove`, consumed by Task 9 (photos) via the same service's `assertOwned` helper.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/marketplace/listings.service.spec.ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Condition, ListingStatus } from '@sobrebox/shared';
import { ListingsService } from './listings.service';

function makePrisma() {
  return {
    userInventory: { findFirst: jest.fn() },
    listing: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeStorage() {
  return { getPublicUrl: jest.fn((k: string) => `http://cdn/${k}`) };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  quantity: 1,
  condition: Condition.MINT,
  price: '19.99',
  description: null,
  status: ListingStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  sellerId: 'u1',
  seller: { username: 'ash', country: 'ES', avatarUrl: null },
  collectionItem: {
    id: 'ci1',
    name: 'Charizard',
    rarity: 'SECRET',
    imageUrl: null,
    collection: { slug: 's', name: 'N' },
  },
  photos: [],
  ...over,
});

describe('ListingsService.create', () => {
  it('404s when the item is not in the seller inventory', async () => {
    const prisma = makePrisma();
    prisma.userInventory.findFirst.mockResolvedValue(null);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.create('u1', {
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: '19.99',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400s when quantity exceeds what is available', async () => {
    const prisma = makePrisma();
    prisma.userInventory.findFirst.mockResolvedValue({ quantity: 2 });
    prisma.listing.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.create('u1', {
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: '19.99',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a listing when quantity is available', async () => {
    const prisma = makePrisma();
    prisma.userInventory.findFirst.mockResolvedValue({ quantity: 3 });
    prisma.listing.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    prisma.listing.create.mockResolvedValue(row());
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const dto = await service.create('u1', {
      collectionItemId: 'ci1',
      quantity: 1,
      condition: Condition.MINT,
      price: '19.99',
    });
    expect(dto.id).toBe('l1');
  });
});

describe('ListingsService.update', () => {
  it('403s when the listing belongs to another user', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(null);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.update('u2', 'l1', { status: ListingStatus.PAUSED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('400s when raising quantity above what is available', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(
      row({ sellerId: 'u1', quantity: 1 }),
    );
    prisma.userInventory.findFirst.mockResolvedValue({ quantity: 2 });
    prisma.listing.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.update('u1', 'l1', { quantity: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ListingsService.remove', () => {
  it('403s when the listing belongs to another user', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(null);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(service.remove('u2', 'l1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- marketplace/listings.service.spec.ts`
Expected: FAIL — `./listings.service` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/api/src/marketplace/listings.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateListingDto,
  ListingDto,
  ListingQueryDto,
  ListingsPageDto,
  ListingStatus,
  UpdateListingDto,
  listingSchema,
  listingsPageSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const PAGE_SIZE = 24;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private toDto(row: {
    id: string;
    quantity: number;
    condition: string;
    price: { toString(): string };
    description: string | null;
    status: string;
    createdAt: Date;
    seller: {
      username: string;
      country: string | null;
      avatarUrl: string | null;
    };
    collectionItem: {
      id: string;
      name: string;
      rarity: string;
      imageUrl: string | null;
      collection: { slug: string; name: string };
    };
    photos: { id: string; key: string }[];
  }): ListingDto {
    return listingSchema.parse({
      id: row.id,
      quantity: row.quantity,
      condition: row.condition,
      price: Number(row.price.toString()).toFixed(2),
      description: row.description,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      item: {
        id: row.collectionItem.id,
        name: row.collectionItem.name,
        rarity: row.collectionItem.rarity,
        imageUrl: row.collectionItem.imageUrl,
      },
      collection: row.collectionItem.collection,
      seller: row.seller,
      photos: row.photos.map((p) => ({
        id: p.id,
        url: this.storage.getPublicUrl(p.key),
      })),
    });
  }

  private async availableQuantity(
    userId: string,
    collectionItemId: string,
    excludeListingId?: string,
  ): Promise<number> {
    const inventory = await this.prisma.userInventory.findFirst({
      where: { userId, collectionItemId },
    });
    if (!inventory) {
      throw new NotFoundException('Item not found in your inventory');
    }
    const reserved = await this.prisma.listing.aggregate({
      where: {
        sellerId: userId,
        collectionItemId,
        status: ListingStatus.ACTIVE,
        ...(excludeListingId ? { id: { not: excludeListingId } } : {}),
      },
      _sum: { quantity: true },
    });
    return inventory.quantity - (reserved._sum.quantity ?? 0);
  }

  async create(userId: string, dto: CreateListingDto): Promise<ListingDto> {
    const available = await this.availableQuantity(
      userId,
      dto.collectionItemId,
    );
    if (dto.quantity > available) {
      throw new BadRequestException(
        `Only ${available} unit(s) available to list`,
      );
    }
    const created = await this.prisma.listing.create({
      data: {
        sellerId: userId,
        collectionItemId: dto.collectionItemId,
        quantity: dto.quantity,
        condition: dto.condition,
        price: dto.price,
        description: dto.description,
      },
      include: {
        seller: true,
        collectionItem: { include: { collection: true } },
        photos: true,
      },
    });
    return this.toDto(created);
  }

  async listPublic(query: ListingQueryDto): Promise<ListingsPageDto> {
    const where = {
      status: ListingStatus.ACTIVE,
      ...(query.collectionItemId
        ? { collectionItemId: query.collectionItemId }
        : {}),
      ...(query.collectionId
        ? { collectionItem: { collectionId: query.collectionId } }
        : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.country ? { seller: { country: query.country } } : {}),
      ...(query.q
        ? {
            collectionItem: {
              name: { contains: query.q, mode: 'insensitive' as const },
            },
          }
        : {}),
      ...(query.priceMin || query.priceMax
        ? {
            price: {
              ...(query.priceMin ? { gte: query.priceMin } : {}),
              ...(query.priceMax ? { lte: query.priceMax } : {}),
            },
          }
        : {}),
    };
    const orderBy =
      query.sort === 'price_asc'
        ? { price: 'asc' as const }
        : query.sort === 'price_desc'
          ? { price: 'desc' as const }
          : { createdAt: 'desc' as const }; // 'recent' and the 'best_rated' no-op both fall back to recency

    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          seller: true,
          collectionItem: { include: { collection: true } },
          photos: true,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return listingsPageSchema.parse({
      items: items.map((i) => this.toDto(i)),
      page: query.page,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  }

  async getById(id: string, requesterId?: string): Promise<ListingDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        seller: true,
        collectionItem: { include: { collection: true } },
        photos: true,
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (
      listing.status !== ListingStatus.ACTIVE &&
      listing.sellerId !== requesterId
    ) {
      throw new NotFoundException('Listing not found');
    }
    return this.toDto(listing);
  }

  async assertOwned(userId: string, id: string): Promise<{ id: string }> {
    const listing = await this.prisma.listing.findFirst({
      where: { id, sellerId: userId },
    });
    if (!listing) throw new ForbiddenException('Not your listing');
    return listing;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateListingDto,
  ): Promise<ListingDto> {
    const listing = await this.assertOwned(userId, id);
    if (dto.quantity !== undefined) {
      const current = await this.prisma.listing.findFirst({ where: { id } });
      const available = await this.availableQuantity(
        userId,
        current!.collectionItemId,
        id,
      );
      if (dto.quantity > available) {
        throw new BadRequestException(
          `Only ${available} unit(s) available to list`,
        );
      }
    }
    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        seller: true,
        collectionItem: { include: { collection: true } },
        photos: true,
      },
    });
    return this.toDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const listing = await this.assertOwned(userId, id);
    const photos = await this.prisma.listing
      .findUnique({ where: { id: listing.id }, include: { photos: true } })
      .then((l) => l?.photos ?? []);
    await Promise.all(photos.map((p) => this.storage.delete(p.key)));
    await this.prisma.listing.delete({ where: { id: listing.id } });
  }
}
```

```typescript
// apps/api/src/marketplace/listings.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateListingDto,
  ListingDto,
  ListingQueryDto,
  ListingsPageDto,
  UpdateListingDto,
  createListingSchema,
  listingQuerySchema,
  updateListingSchema,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { ListingsService } from './listings.service';

@Controller('marketplace/listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createListingSchema)) dto: CreateListingDto,
  ): Promise<ListingDto> {
    return this.listings.create(user.id, dto);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(listingQuerySchema)) query: ListingQueryDto,
  ): Promise<ListingsPageDto> {
    return this.listings.listPublic(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ListingDto> {
    return this.listings.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateListingSchema)) dto: UpdateListingDto,
  ): Promise<ListingDto> {
    return this.listings.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.listings.remove(user.id, id);
  }
}
```

```typescript
// apps/api/src/marketplace/marketplace.module.ts
import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class MarketplaceModule {}
```

Modify `apps/api/src/app.module.ts` — add the import and register at the end of the domain modules:

```typescript
import { MarketplaceModule } from './marketplace/marketplace.module';
// ...
    WishlistModule,
    MarketplaceModule,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- marketplace/listings.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/marketplace apps/api/src/app.module.ts
git commit -m "feat(marketplace): add listings CRUD (create/browse/update/delete)"
```

---

### Task 9: Marketplace backend — listing photos

**Files:**

- Create: `apps/api/src/marketplace/listing-photos.controller.ts`
- Create: `apps/api/src/marketplace/listing-photos.service.ts`
- Create: `apps/api/src/marketplace/listing-photos.service.spec.ts`
- Create: `apps/api/src/marketplace/multer-image.options.ts`
- Modify: `apps/api/src/marketplace/marketplace.module.ts`

**Interfaces:**

- Consumes: `ListingsService.assertOwned` (Task 8), `ImageCompressorService.compress` (Task 6), `StorageService.upload`/`delete` (Task 5).
- Produces: `ListingPhotosService.add(userId, listingId, files): Promise<ListingPhotoDto[]>`, `ListingPhotosService.remove(userId, listingId, photoId): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/marketplace/listing-photos.service.spec.ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ListingPhotosService } from './listing-photos.service';

function makePrisma() {
  return {
    listing: { findFirst: jest.fn() },
    listingPhoto: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeListingsService() {
  return { assertOwned: jest.fn() };
}

function makeCompressor() {
  return {
    compress: jest.fn().mockResolvedValue({
      buffer: Buffer.from('x'),
      mime: 'image/webp',
      ext: 'webp',
    }),
  };
}

function makeStorage() {
  return {
    upload: jest.fn().mockResolvedValue('marketplace-listings/l1/a.webp'),
    delete: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn((k: string) => `http://cdn/${k}`),
  };
}

describe('ListingPhotosService.add', () => {
  it('403s when the listing is not owned by the user', async () => {
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockRejectedValue(new ForbiddenException());
    const service = new ListingPhotosService(
      makePrisma() as never,
      listingsService as never,
      makeCompressor() as never,
      makeStorage() as never,
    );
    await expect(
      service.add('u2', 'l1', [
        { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('400s when the total would exceed 5 photos', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.count.mockResolvedValue(5);
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockResolvedValue({ id: 'l1' });
    const service = new ListingPhotosService(
      prisma as never,
      listingsService as never,
      makeCompressor() as never,
      makeStorage() as never,
    );
    await expect(
      service.add('u1', 'l1', [
        { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('compresses, uploads and persists each photo', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.count.mockResolvedValue(0);
    prisma.listingPhoto.create.mockResolvedValue({
      id: 'p1',
      key: 'marketplace-listings/l1/a.webp',
    });
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockResolvedValue({ id: 'l1' });
    const storage = makeStorage();
    const service = new ListingPhotosService(
      prisma as never,
      listingsService as never,
      makeCompressor() as never,
      storage as never,
    );
    const photos = await service.add('u1', 'l1', [
      { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
    ]);
    expect(photos).toEqual([
      { id: 'p1', url: 'http://cdn/marketplace-listings/l1/a.webp' },
    ]);
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });
});

describe('ListingPhotosService.remove', () => {
  it('403s when the listing is not owned by the user', async () => {
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockRejectedValue(new ForbiddenException());
    const service = new ListingPhotosService(
      makePrisma() as never,
      listingsService as never,
      makeCompressor() as never,
      makeStorage() as never,
    );
    await expect(service.remove('u2', 'l1', 'p1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- marketplace/listing-photos.service.spec.ts`
Expected: FAIL — `./listing-photos.service` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/api/src/marketplace/multer-image.options.ts
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function imageUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb): void => {
      if (!/^image\/(jpeg|png|webp)$/.exec(file.mimetype)) {
        cb(new BadRequestException('Only jpeg/png/webp images allowed'), false);
        return;
      }
      cb(null, true);
    },
  };
}
```

```typescript
// apps/api/src/marketplace/listing-photos.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ListingPhotoDto } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ImageCompressorService } from '../image/image-compressor.service';
import { ListingsService } from './listings.service';

const MAX_PHOTOS = 5;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

@Injectable()
export class ListingPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
    private readonly compressor: ImageCompressorService,
    private readonly storage: StorageService,
  ) {}

  async add(
    userId: string,
    listingId: string,
    files: { buffer: Buffer; mimetype: string }[],
  ): Promise<ListingPhotoDto[]> {
    await this.listings.assertOwned(userId, listingId);
    const existing = await this.prisma.listingPhoto.count({
      where: { listingId },
    });
    if (existing + files.length > MAX_PHOTOS) {
      throw new BadRequestException(
        `A listing can have at most ${MAX_PHOTOS} photos`,
      );
    }

    const created: ListingPhotoDto[] = [];
    for (const file of files) {
      const compressed = await this.compressor.compress(file.buffer);
      const key = `marketplace-listings/${listingId}/${uuidv4()}.${compressed.ext}`;
      await this.storage.upload(
        key,
        compressed.buffer,
        compressed.mime,
        CACHE_CONTROL,
      );
      try {
        const saved = await this.prisma.listingPhoto.create({
          data: { listingId, key },
        });
        created.push({
          id: saved.id,
          url: this.storage.getPublicUrl(saved.key),
        });
      } catch (err) {
        await this.storage.delete(key).catch(() => undefined);
        throw err;
      }
    }
    return created;
  }

  async remove(
    userId: string,
    listingId: string,
    photoId: string,
  ): Promise<void> {
    await this.listings.assertOwned(userId, listingId);
    const photo = await this.prisma.listingPhoto.findFirst({
      where: { id: photoId, listingId },
    });
    if (!photo) return;
    await this.storage.delete(photo.key);
    await this.prisma.listingPhoto.delete({ where: { id: photo.id } });
  }
}
```

```typescript
// apps/api/src/marketplace/listing-photos.controller.ts
import {
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ListingPhotoDto } from '@sobrebox/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { imageUploadOptions } from './multer-image.options';
import { ListingPhotosService } from './listing-photos.service';

@UseGuards(JwtAuthGuard)
@Controller('marketplace/listings/:id/photos')
export class ListingPhotosController {
  constructor(private readonly photos: ListingPhotosService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 5, imageUploadOptions()))
  add(
    @CurrentUser() user: RequestUser,
    @Param('id') listingId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ListingPhotoDto[]> {
    return this.photos.add(user.id, listingId, files);
  }

  @Delete(':photoId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') listingId: string,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    return this.photos.remove(user.id, listingId, photoId);
  }
}
```

Modify `apps/api/src/marketplace/marketplace.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingPhotosController } from './listing-photos.controller';
import { ListingPhotosService } from './listing-photos.service';

@Module({
  controllers: [ListingsController, ListingPhotosController],
  providers: [ListingsService, ListingPhotosService],
  exports: [ListingsService],
})
export class MarketplaceModule {}
```

If `uuid` is not already a dependency, run: `pnpm --filter @sobrebox/api add uuid && pnpm --filter @sobrebox/api add -D @types/uuid` (check `apps/api/package.json` first — `cuid`-style ids are used elsewhere via Prisma `@default(cuid())`, but photo keys are generated in application code so `uuid` is needed here).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- marketplace/listing-photos.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/marketplace apps/api/package.json pnpm-lock.yaml
git commit -m "feat(marketplace): add listing photo upload/delete (WebP via RustFS)"
```

---

### Task 10: Frontend — `lib/api.ts` marketplace fetchers

**Files:**

- Modify: `apps/web/lib/api.ts`

**Interfaces:**

- Consumes: `listingSchema`, `listingsPageSchema`, `listingQuerySchema` types, `createListingSchema`/`CreateListingDto`, `updateListingSchema`/`UpdateListingDto`, `updateProfileSchema`/`UpdateProfileDto`, `publicUserSchema` (all from `@sobrebox/shared`); `authedJson` helper, `buildQuery` helper (both already defined in `apps/web/lib/api.ts`).
- Produces: `fetchListings`, `fetchListing`, `createListing`, `updateListing`, `deleteListing`, `uploadListingPhotos`, `deleteListingPhoto`, `updateProfile`.

- [ ] **Step 1: Add the fetchers**

Modify `apps/web/lib/api.ts` — add near the existing `// --- inventory ---` section:

```typescript
// --- marketplace ---
export async function fetchListings(
  query: Partial<ListingQueryDto>,
): Promise<ListingsPageDto> {
  const res = await fetch(
    `${API_URL}/marketplace/listings${buildQuery(query)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status}`);
  return listingsPageSchema.parse(await res.json());
}

export async function fetchListing(id: string): Promise<ListingDto> {
  const res = await fetch(`${API_URL}/marketplace/listings/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch listing: ${res.status}`);
  return listingSchema.parse(await res.json());
}

export async function createListing(
  dto: CreateListingDto,
  accessToken: string,
): Promise<ListingDto> {
  return listingSchema.parse(
    await authedJson('/marketplace/listings', accessToken, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  );
}

export async function updateListing(
  id: string,
  dto: UpdateListingDto,
  accessToken: string,
): Promise<ListingDto> {
  return listingSchema.parse(
    await authedJson(`/marketplace/listings/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  );
}

export async function deleteListing(
  id: string,
  accessToken: string,
): Promise<void> {
  await authedJson(`/marketplace/listings/${id}`, accessToken, {
    method: 'DELETE',
  });
}

export async function uploadListingPhotos(
  id: string,
  files: File[],
  accessToken: string,
): Promise<ListingPhotoDto[]> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const res = await fetch(`${API_URL}/marketplace/listings/${id}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw new Error(`Failed to upload photos: ${res.status}`);
  return listingPhotoSchema.array().parse(await res.json());
}

export async function deleteListingPhoto(
  listingId: string,
  photoId: string,
  accessToken: string,
): Promise<void> {
  await authedJson(
    `/marketplace/listings/${listingId}/photos/${photoId}`,
    accessToken,
    { method: 'DELETE' },
  );
}

// --- profile ---
export async function updateProfile(
  dto: UpdateProfileDto,
  accessToken: string,
): Promise<PublicUserDto> {
  return publicUserSchema.parse(
    await authedJson('/users/me', accessToken, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  );
}
```

Add the corresponding type/schema imports to the top of the file, alongside the existing `@sobrebox/shared` import block:

```typescript
import {
  // ...existing imports...
  ListingDto,
  ListingQueryDto,
  ListingsPageDto,
  ListingPhotoDto,
  CreateListingDto,
  UpdateListingDto,
  listingSchema,
  listingsPageSchema,
  listingPhotoSchema,
  UpdateProfileDto,
  publicUserSchema,
  PublicUserDto,
} from '@sobrebox/shared';
```

`uploadListingPhotos` deliberately does not go through `authedJson` (it needs `FormData`, not JSON) — it does not auto-retry on 401 like `authedJson` does; that parity gap is acceptable for slice 1 (a stale token on this rare action just surfaces as a failed upload toast).

- [ ] **Step 2: Verify the frontend still typechecks**

Run: `pnpm --filter @sobrebox/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat(web): add marketplace + profile API client functions"
```

---

### Task 11: Frontend — `/marketplace` browse page

**Files:**

- Create: `apps/web/app/[locale]/marketplace/page.tsx`
- Create: `apps/web/components/marketplace/listing-browser.tsx`
- Create: `apps/web/components/marketplace/listing-browser.test.tsx`
- Modify: `apps/web/locales/en.json`
- Modify: `apps/web/locales/es.json`

**Interfaces:**

- Consumes: `fetchListings` (Task 10), `ListingDto`/`ListingQueryDto` types.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/components/marketplace/listing-browser.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { ListingBrowser } from './listing-browser';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Marketplace: {
            title: 'Marketplace',
            empty: 'No listings yet.',
            sortRecent: 'Most recent',
            sortPriceAsc: 'Price: low to high',
            sortPriceDesc: 'Price: high to low',
            sortBestRated: 'Best rated (soon)',
          },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('ListingBrowser', () => {
  it('shows the empty state when there are no listings', async () => {
    vi.spyOn(api, 'fetchListings').mockResolvedValue({
      items: [],
      page: 1,
      total: 0,
      totalPages: 1,
    });
    renderWithProviders(<ListingBrowser />);
    await waitFor(() =>
      expect(screen.getByText('No listings yet.')).toBeInTheDocument(),
    );
  });

  it('renders a listing card with its price', async () => {
    vi.spyOn(api, 'fetchListings').mockResolvedValue({
      items: [
        {
          id: 'l1',
          quantity: 1,
          condition: 'MINT',
          price: '19.99',
          description: null,
          status: 'ACTIVE',
          createdAt: '2026-07-01T00:00:00.000Z',
          item: {
            id: 'ci1',
            name: 'Charizard',
            rarity: 'SECRET',
            imageUrl: null,
          },
          collection: { slug: 's', name: 'N' },
          seller: { username: 'ash', country: 'ES', avatarUrl: null },
          photos: [],
        },
      ],
      page: 1,
      total: 1,
      totalPages: 1,
    });
    renderWithProviders(<ListingBrowser />);
    await waitFor(() =>
      expect(screen.getByText('Charizard')).toBeInTheDocument(),
    );
    expect(screen.getByText(/19.99/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/web test -- listing-browser.test.tsx`
Expected: FAIL — `./listing-browser` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/components/marketplace/listing-browser.tsx
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { fetchListings } from '@/lib/api';
import type { ListingQueryDto } from '@sobrebox/shared';

export function ListingBrowser() {
  const t = useTranslations('Marketplace');
  const [sort, setSort] = useState<ListingQueryDto['sort']>('recent');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'listings', { sort }],
    queryFn: () => fetchListings({ sort, page: 1 }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as ListingQueryDto['sort'])}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="recent">{t('sortRecent')}</option>
          <option value="price_asc">{t('sortPriceAsc')}</option>
          <option value="price_desc">{t('sortPriceDesc')}</option>
          <option value="best_rated" disabled title={t('sortBestRated')}>
            {t('sortBestRated')}
          </option>
        </select>
      </div>

      {isLoading && <p>{t('title')}…</p>}
      {!isLoading && (!data || data.items.length === 0) && (
        <p className="text-muted-foreground">{t('empty')}</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((listing) => (
          <li key={listing.id} className="rounded-lg border p-4">
            <Link
              href={`/marketplace/${listing.id}`}
              className="font-medium hover:underline"
            >
              {listing.item.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              {listing.collection.name}
            </p>
            <p className="mt-2 font-semibold">{listing.price} €</p>
            <p className="text-xs text-muted-foreground">
              @{listing.seller.username}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```tsx
// apps/web/app/[locale]/marketplace/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { ListingBrowser } from '@/components/marketplace/listing-browser';

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="container mx-auto px-4 py-8">
      <ListingBrowser />
    </main>
  );
}
```

Add to `apps/web/locales/en.json` (new top-level `"Marketplace"` section, alongside `"Inventory"`/`"Wishlist"`):

```json
"Marketplace": {
  "title": "Marketplace",
  "empty": "No listings yet.",
  "sortRecent": "Most recent",
  "sortPriceAsc": "Price: low to high",
  "sortPriceDesc": "Price: high to low",
  "sortBestRated": "Best rated (coming soon)"
}
```

Add the equivalent Spanish block to `apps/web/locales/es.json`:

```json
"Marketplace": {
  "title": "Mercado",
  "empty": "Todavía no hay anuncios.",
  "sortRecent": "Más reciente",
  "sortPriceAsc": "Precio: menor a mayor",
  "sortPriceDesc": "Precio: mayor a menor",
  "sortBestRated": "Mejor valorado (próximamente)"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- listing-browser.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/[locale]/marketplace/page.tsx apps/web/components/marketplace/listing-browser.tsx apps/web/components/marketplace/listing-browser.test.tsx apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): marketplace browse page (sort by price/recent)"
```

---

### Task 12: Frontend — `/marketplace/[id]` detail page

**Files:**

- Create: `apps/web/app/[locale]/marketplace/[id]/page.tsx`
- Create: `apps/web/components/marketplace/listing-detail.tsx`
- Create: `apps/web/components/marketplace/listing-detail.test.tsx`
- Modify: `apps/web/locales/en.json`
- Modify: `apps/web/locales/es.json`

**Interfaces:**

- Consumes: `fetchListing` (Task 10).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/components/marketplace/listing-detail.test.tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { ListingDetail } from './listing-detail';
import type { ListingDto } from '@sobrebox/shared';

const listing: ListingDto = {
  id: 'l1',
  quantity: 1,
  condition: 'MINT',
  price: '19.99',
  description: 'Mint condition, straight from the pack.',
  status: 'ACTIVE',
  createdAt: '2026-07-01T00:00:00.000Z',
  item: { id: 'ci1', name: 'Charizard', rarity: 'SECRET', imageUrl: null },
  collection: { slug: 's', name: 'N' },
  seller: { username: 'ash', country: 'ES', avatarUrl: null },
  photos: [],
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ Marketplace: { offerSoon: 'Offers coming soon' } }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('ListingDetail', () => {
  it('renders price, description and seller', () => {
    renderWithProviders(<ListingDetail listing={listing} />);
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText(/19.99/)).toBeInTheDocument();
    expect(
      screen.getByText('Mint condition, straight from the pack.'),
    ).toBeInTheDocument();
    expect(screen.getByText('@ash')).toBeInTheDocument();
  });

  it('shows a disabled offer CTA with the "coming soon" label', () => {
    renderWithProviders(<ListingDetail listing={listing} />);
    const button = screen.getByRole('button', { name: /offers coming soon/i });
    expect(button).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/web test -- listing-detail.test.tsx`
Expected: FAIL — `./listing-detail` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/components/marketplace/listing-detail.tsx
import { useTranslations } from 'next-intl';
import type { ListingDto } from '@sobrebox/shared';
import { Button } from '@/components/ui/button';

export function ListingDetail({ listing }: { listing: ListingDto }) {
  const t = useTranslations('Marketplace');
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border p-4">
        {listing.item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.item.imageUrl}
            alt={listing.item.name}
            className="w-full rounded"
          />
        ) : (
          <div className="aspect-square rounded bg-muted" />
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold">{listing.item.name}</h1>
        <p className="text-sm text-muted-foreground">
          {listing.collection.name}
        </p>
        <p className="mt-4 text-3xl font-semibold">{listing.price} €</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {listing.condition} · @{listing.seller.username}
        </p>
        {listing.description && <p className="mt-4">{listing.description}</p>}
        <Button disabled title={t('offerSoon')} className="mt-6">
          {t('offerSoon')}
        </Button>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/app/[locale]/marketplace/[id]/page.tsx
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchListing } from '@/lib/api';
import { ListingDetail } from '@/components/marketplace/listing-detail';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  let listing;
  try {
    listing = await fetchListing(id);
  } catch {
    notFound();
  }
  return (
    <main className="container mx-auto px-4 py-8">
      <ListingDetail listing={listing} />
    </main>
  );
}
```

Add to `apps/web/locales/en.json` under `"Marketplace"`:

```json
"offerSoon": "Offers coming soon"
```

Add to `apps/web/locales/es.json` under `"Marketplace"`:

```json
"offerSoon": "Ofertas próximamente"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- listing-detail.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/[locale]/marketplace/[id]/page.tsx apps/web/components/marketplace/listing-detail.tsx apps/web/components/marketplace/listing-detail.test.tsx apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): marketplace listing detail page"
```

---

### Task 13: Frontend — create listing form (`/marketplace/new`)

**Files:**

- Create: `apps/web/app/[locale]/marketplace/new/page.tsx`
- Create: `apps/web/components/marketplace/create-listing-form.tsx`
- Create: `apps/web/components/marketplace/create-listing-form.test.tsx`
- Modify: `apps/web/components/inventory/inventory-progress.tsx` (add a "Sell" link per row)
- Modify: `apps/web/locales/en.json`
- Modify: `apps/web/locales/es.json`

**Interfaces:**

- Consumes: `createListing` (Task 10); `useAuthStore` (`apps/web/lib/auth-store.ts`, existing).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/components/marketplace/create-listing-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { CreateListingForm } from './create-listing-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'token' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Marketplace: {
            createTitle: 'Sell an item',
            quantity: 'Quantity',
            condition: 'Condition',
            price: 'Price',
            description: 'Description',
            submit: 'Publish listing',
            toastCreated: 'Listing published',
          },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('CreateListingForm', () => {
  it('submits the form and calls createListing with the entered values', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createListing').mockResolvedValue({
      id: 'l1',
    } as never);

    renderWithProviders(<CreateListingForm collectionItemId="ci1" />);

    await user.type(screen.getByLabelText('Quantity'), '1');
    await user.selectOptions(screen.getByLabelText('Condition'), 'MINT');
    await user.type(screen.getByLabelText('Price'), '19.99');
    await user.click(screen.getByRole('button', { name: 'Publish listing' }));

    await waitFor(() =>
      expect(api.createListing).toHaveBeenCalledWith(
        {
          collectionItemId: 'ci1',
          quantity: 1,
          condition: 'MINT',
          price: '19.99',
        },
        'token',
      ),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/web test -- create-listing-form.test.tsx`
Expected: FAIL — `./create-listing-form` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/components/marketplace/create-listing-form.tsx
'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Condition } from '@sobrebox/shared';
import { createListing } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CreateListingForm({
  collectionItemId,
}: {
  collectionItemId: string;
}) {
  const t = useTranslations('Marketplace');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState<Condition>(Condition.MINT);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createListing(
        {
          collectionItemId,
          quantity: Number(quantity),
          condition,
          price,
          ...(description ? { description } : {}),
        },
        accessToken as string,
      ),
    onSuccess: (listing) => {
      toast.success(t('toastCreated'));
      router.push(`/marketplace/${listing.id}`);
    },
    onError: () => toast.error(t('toastCreated')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="grid gap-4 max-w-sm"
    >
      <h1 className="text-xl font-bold">{t('createTitle')}</h1>
      <label className="grid gap-1 text-sm">
        {t('quantity')}
        <Input
          aria-label={t('quantity')}
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        {t('condition')}
        <select
          aria-label={t('condition')}
          value={condition}
          onChange={(e) => setCondition(e.target.value as Condition)}
          className="rounded border px-2 py-1"
        >
          {Object.values(Condition).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        {t('price')}
        <Input
          aria-label={t('price')}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        {t('description')}
        <Input
          aria-label={t('description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <Button type="submit" disabled={mutation.isPending}>
        {t('submit')}
      </Button>
    </form>
  );
}
```

```tsx
// apps/web/app/[locale]/marketplace/new/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { CreateListingForm } from '@/components/marketplace/create-listing-form';

export default async function NewListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ itemId?: string }>;
}) {
  const { locale } = await params;
  const { itemId } = await searchParams;
  setRequestLocale(locale);
  if (!itemId) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p>Missing itemId</p>
      </main>
    );
  }
  return (
    <main className="container mx-auto px-4 py-8">
      <CreateListingForm collectionItemId={itemId} />
    </main>
  );
}
```

Add a "Sell" entrypoint to `apps/web/components/inventory/inventory-progress.tsx` — add a link next to each progress card pointing at `/marketplace/new?itemId=` (component already renders one `<li>` per collection, not per item; since the create form takes a single `collectionItemId`, defer the per-item entrypoint to the collection-detail ownership panel instead, which already lists individual items):

Modify `apps/web/components/inventory/collection-ownership-panel.tsx` — add next to the existing "remove owned" button, inside the owned-item row:

```tsx
<Link
  href={`/marketplace/new?itemId=${it.collectionItemId}`}
  className="text-sm text-primary hover:underline"
>
  {t('sell')}
</Link>
```

(Import `Link` from `@/i18n/navigation` at the top if not already imported.)

Add to `apps/web/locales/en.json` under `"Marketplace"`:

```json
"createTitle": "Sell an item",
"quantity": "Quantity",
"condition": "Condition",
"price": "Price",
"description": "Description",
"submit": "Publish listing",
"toastCreated": "Listing published"
```

Add to `"Collections"` in `en.json`:

```json
"sell": "Sell"
```

Add the equivalent to `apps/web/locales/es.json` (`"Marketplace"`: `"createTitle": "Vender un ítem"`, `"quantity": "Cantidad"`, `"condition": "Condición"`, `"price": "Precio"`, `"description": "Descripción"`, `"submit": "Publicar anuncio"`, `"toastCreated": "Anuncio publicado"`; `"Collections"."sell": "Vender"`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- create-listing-form.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/[locale]/marketplace/new/page.tsx apps/web/components/marketplace/create-listing-form.tsx apps/web/components/marketplace/create-listing-form.test.tsx apps/web/components/inventory/collection-ownership-panel.tsx apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): create-listing form from an owned inventory item"
```

---

### Task 14: Frontend — `/marketplace/mine` (manage own listings + photos)

**Files:**

- Create: `apps/web/app/[locale]/marketplace/mine/page.tsx`
- Create: `apps/web/components/marketplace/my-listings.tsx`
- Create: `apps/web/components/marketplace/my-listings.test.tsx`
- Modify: `apps/web/lib/api.ts` (add `fetchMyListings`)
- Modify: `apps/web/locales/en.json`
- Modify: `apps/web/locales/es.json`

**Interfaces:**

- Consumes: `updateListing`, `deleteListing`, `uploadListingPhotos`, `deleteListingPhoto` (Task 10).
- Produces: `fetchMyListings(accessToken): Promise<ListingDto[]>` — reuses `GET /marketplace/listings?sellerId=me`. Since the backend query DTO (Task 2) has no `sellerId` filter, this task adds one.

- [ ] **Step 1: Extend the backend query to support "mine"**

Modify `packages/shared/src/dto/marketplace.dto.ts` — add `mine: z.boolean().optional()` to `listingQuerySchema`. Modify `apps/api/src/marketplace/listings.service.ts`'s `listPublic` to accept an optional `requesterId` param and, when `query.mine` is true, filter by `sellerId: requesterId` instead of `status: ACTIVE` (owner sees all statuses). Modify `apps/api/src/marketplace/listings.controller.ts`'s `list` handler to add an optional `@CurrentUser()` — NestJS param decorators tolerate a missing JWT only when the guard isn't applied, so instead add a second guarded route:

```typescript
@UseGuards(JwtAuthGuard)
@Get('mine')
listMine(@CurrentUser() user: RequestUser): Promise<ListingsPageDto> {
  return this.listings.listPublic({ page: 1 } as never, user.id);
}
```

Place `@Get('mine')` **before** the existing `@Get(':id')` route in the controller (Nest matches routes top-down; `:id` would otherwise swallow `/mine`).

Update `ListingsService.listPublic` signature to `listPublic(query: ListingQueryDto, ownerId?: string)`; when `ownerId` is provided, `where` becomes `{ sellerId: ownerId }` (all statuses) instead of `{ status: ListingStatus.ACTIVE, ... }`.

- [ ] **Step 2: Write the failing test (backend)**

Add to `apps/api/src/marketplace/listings.service.spec.ts`:

```typescript
describe('ListingsService.listPublic with ownerId', () => {
  it('returns all statuses for the owner, ignoring the ACTIVE-only public filter', async () => {
    const prisma = makePrisma();
    prisma.listing.findMany.mockResolvedValue([
      row({ status: ListingStatus.PAUSED }),
    ]);
    prisma.listing.count.mockResolvedValue(1);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const page = await service.listPublic({ page: 1 } as never, 'u1');
    expect(page.items[0].status).toBe(ListingStatus.PAUSED);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId: 'u1' } }),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- marketplace/listings.service.spec.ts`
Expected: FAIL — `listPublic` still filters by `status: ACTIVE` regardless of `ownerId`.

- [ ] **Step 4: Implement the backend change, then the frontend fetcher**

In `listings.service.ts`, change the `where` construction in `listPublic`:

```typescript
async listPublic(query: ListingQueryDto, ownerId?: string): Promise<ListingsPageDto> {
  const where = {
    ...(ownerId ? { sellerId: ownerId } : { status: ListingStatus.ACTIVE }),
    ...(query.collectionItemId ? { collectionItemId: query.collectionItemId } : {}),
    ...(query.collectionId ? { collectionItem: { collectionId: query.collectionId } } : {}),
    ...(query.condition ? { condition: query.condition } : {}),
    ...(!ownerId && query.country ? { seller: { country: query.country } } : {}),
    ...(query.q
      ? { collectionItem: { name: { contains: query.q, mode: 'insensitive' as const } } }
      : {}),
    ...(query.priceMin || query.priceMax
      ? {
          price: {
            ...(query.priceMin ? { gte: query.priceMin } : {}),
            ...(query.priceMax ? { lte: query.priceMax } : {}),
          },
        }
      : {}),
  };
  // ...rest unchanged (orderBy, findMany/count, listingsPageSchema.parse)
}
```

Add to `apps/web/lib/api.ts`:

```typescript
export async function fetchMyListings(
  accessToken: string,
): Promise<ListingsPageDto> {
  return listingsPageSchema.parse(
    await authedJson('/marketplace/listings/mine', accessToken),
  );
}
```

- [ ] **Step 5: Run backend test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- marketplace/listings.service.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Write the failing frontend test**

```tsx
// apps/web/components/marketplace/my-listings.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { MyListings } from './my-listings';
import * as api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (
    selector: (s: { status: string; accessToken: string }) => unknown,
  ) => selector({ status: 'authenticated', accessToken: 'token' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Marketplace: {
            mineEmpty: 'You have no listings.',
            pause: 'Pause',
            delete: 'Delete',
          },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('MyListings', () => {
  it('shows the empty state when the seller has no listings', async () => {
    vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
      items: [],
      page: 1,
      total: 0,
      totalPages: 1,
    });
    renderWithProviders(<MyListings />);
    await waitFor(() =>
      expect(screen.getByText('You have no listings.')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/web test -- my-listings.test.tsx`
Expected: FAIL — `./my-listings` does not exist.

- [ ] **Step 8: Write minimal implementation**

```tsx
// apps/web/components/marketplace/my-listings.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ListingStatus } from '@sobrebox/shared';
import { deleteListing, fetchMyListings, updateListing } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

export function MyListings() {
  const t = useTranslations('Marketplace');
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['marketplace', 'mine'],
    queryFn: () => fetchMyListings(accessToken as string),
    enabled: status === 'authenticated',
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['marketplace', 'mine'] });

  const togglePause = useMutation({
    mutationFn: (v: { id: string; status: ListingStatus }) =>
      updateListing(
        v.id,
        {
          status:
            v.status === ListingStatus.ACTIVE
              ? ListingStatus.PAUSED
              : ListingStatus.ACTIVE,
        },
        accessToken as string,
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteListing(id, accessToken as string),
    onSuccess: () => {
      invalidate();
      toast.success(t('delete'));
    },
  });

  if (!data || data.items.length === 0) {
    return <p className="text-muted-foreground">{t('mineEmpty')}</p>;
  }

  return (
    <ul className="grid gap-4">
      {data.items.map((listing) => (
        <li
          key={listing.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <span>
            {listing.item.name} — {listing.price} € ({listing.status})
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                togglePause.mutate({ id: listing.id, status: listing.status })
              }
            >
              {t('pause')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => remove.mutate(listing.id)}
            >
              {t('delete')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// apps/web/app/[locale]/marketplace/mine/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { MyListings } from '@/components/marketplace/my-listings';

export default async function MyListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="container mx-auto px-4 py-8">
      <MyListings />
    </main>
  );
}
```

Add to `apps/web/locales/en.json` under `"Marketplace"`: `"mineEmpty": "You have no listings.", "pause": "Pause / Resume", "delete": "Delete"`.
Add to `apps/web/locales/es.json` under `"Marketplace"`: `"mineEmpty": "No tienes anuncios.", "pause": "Pausar / Reactivar", "delete": "Eliminar"`.

Photo upload/delete UI (drag-and-drop picker, previews) is deliberately left out of this task's test-covered surface — add a minimal `<input type="file" multiple accept="image/*">` wired to `uploadListingPhotos` inside `MyListings`' per-row expansion is a straightforward follow-up once this shell ships; tracking it here would exceed this task's TDD scope without a design decision on the picker UI, so it's the first item in Task 16's manual QA checklist.

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- my-listings.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/dto/marketplace.dto.ts apps/api/src/marketplace apps/web/app/[locale]/marketplace/mine apps/web/components/marketplace/my-listings.tsx apps/web/components/marketplace/my-listings.test.tsx apps/web/lib/api.ts apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): manage-my-listings page (pause/resume/delete)"
```

---

### Task 15: Frontend — profile country editor

**Files:**

- Create: `apps/web/components/profile/edit-country-form.tsx`
- Create: `apps/web/components/profile/edit-country-form.test.tsx`
- Modify: `apps/web/app/[locale]/profile/[username]/page.tsx`
- Modify: `apps/web/locales/en.json`
- Modify: `apps/web/locales/es.json`

**Interfaces:**

- Consumes: `updateProfile` (Task 10).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/components/profile/edit-country-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EditCountryForm } from './edit-country-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'token' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Profile: { country: 'Country', save: 'Save', toastSaved: 'Saved' },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('EditCountryForm', () => {
  it('submits the selected country', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'updateProfile').mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      username: 'ash',
      emailVerified: true,
      avatarUrl: null,
      country: 'ES',
    });
    renderWithProviders(<EditCountryForm currentCountry={null} />);
    await user.selectOptions(screen.getByLabelText('Country'), 'ES');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith(
        { country: 'ES' },
        'token',
      ),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/web test -- edit-country-form.test.tsx`
Expected: FAIL — `./edit-country-form` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/components/profile/edit-country-form.tsx
'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { updateProfile } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

const COUNTRIES = ['ES', 'US', 'MX', 'AR', 'FR', 'DE', 'IT', 'PT', 'GB'];

export function EditCountryForm({
  currentCountry,
}: {
  currentCountry: string | null;
}) {
  const t = useTranslations('Profile');
  const accessToken = useAuthStore((s) => s.accessToken);
  const [country, setCountry] = useState(currentCountry ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({ country: country || null }, accessToken as string),
    onSuccess: () => toast.success(t('toastSaved')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex items-end gap-2"
    >
      <label className="grid gap-1 text-sm">
        {t('country')}
        <select
          aria-label={t('country')}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">—</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={mutation.isPending}>
        {t('save')}
      </Button>
    </form>
  );
}
```

Modify `apps/web/app/[locale]/profile/[username]/page.tsx` — render `EditCountryForm` only when viewing one's own profile. Add, after the existing `<CardContent>` block's member-since paragraph:

```tsx
import { useAuthStore } from '@/lib/auth-store';
import { EditCountryForm } from '@/components/profile/edit-country-form';
// ... inside the component, this page is currently a server component; the
// country editor needs client-side auth state, so wrap just that piece:
```

Since `ProfilePage` is an async server component and `EditCountryForm` needs client-side `useAuthStore`, add a small client wrapper instead of converting the whole page:

```tsx
// apps/web/components/profile/profile-country-section.tsx
'use client';
import { useAuthStore } from '@/lib/auth-store';
import { EditCountryForm } from './edit-country-form';

export function ProfileCountrySection({
  username,
  country,
}: {
  username: string;
  country: string | null;
}) {
  const currentUsername = useAuthStore((s) => s.user?.username);
  if (currentUsername !== username) return null;
  return <EditCountryForm currentCountry={country} />;
}
```

Confirmed: `apps/web/lib/auth-store.ts`'s `AuthState.user` is typed `PublicUserDto | null`, which has `.username` — `useAuthStore((s) => s.user?.username)` is valid as written above.

Modify `apps/web/app/[locale]/profile/[username]/page.tsx` to render `<ProfileCountrySection username={profile.username} country={profile.country ?? null} />` below the existing card — this requires `fetchPublicProfile`'s `PublicProfileDto` to expose `country`, so also add `country: z.string().nullable()` to `publicProfileSchema` in `packages/shared/src/dto/user.dto.ts` and to the `getPublicProfile` mapping in `apps/api/src/users/users.service.ts`.

Add to `apps/web/locales/en.json` (new top-level `"Profile"` section): `"country": "Country", "save": "Save", "toastSaved": "Saved"`.
Add to `apps/web/locales/es.json`: `"country": "País", "save": "Guardar", "toastSaved": "Guardado"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- edit-country-form.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/profile apps/web/app/[locale]/profile packages/shared/src/dto/user.dto.ts apps/api/src/users/users.service.ts apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): let users set their country from their profile"
```

---

### Task 16: Full gate + manual QA

**Files:** none (verification only).

- [ ] **Step 1: Run the full coverage gate**

Run: `pnpm build:shared && pnpm pr-check`
Expected: lint clean, `tsc --noEmit` clean in `api`/`web`, coverage ≥80% (statements/branches/functions/lines) in `api`/`web`/`shared`.

- [ ] **Step 2: Run the e2e suite**

Run: `pnpm infra:up && pnpm db:deploy && pnpm test:e2e`
Expected: all e2e specs pass, including any new `marketplace` e2e coverage the implementer adds for the create→browse→pause→delete happy path (not scripted here in detail — follow the existing `apps/api/test/*.e2e-spec.ts` pattern used for inventory).

- [ ] **Step 3: Manual QA checklist**

- [ ] Upload 5 photos to a listing, confirm a 6th is rejected with 400.
- [ ] Create a listing for quantity greater than what's in inventory, confirm 400.
- [ ] Pause a listing, confirm it disappears from `/marketplace` but still shows on `/marketplace/mine`.
- [ ] Delete a listing with photos, confirm the RustFS objects are gone (check the RustFS console at `http://localhost:9001`).
- [ ] Set a country on your profile, confirm the `country` filter on `/marketplace` narrows results.
- [ ] Add the photo-upload/delete UI to `/marketplace/mine` (deferred from Task 14) if not already done, wire it to `uploadListingPhotos`/`deleteListingPhoto`.

- [ ] **Step 4: Commit any fixes found during QA**

```bash
git add -A
git commit -m "fix(marketplace): address manual QA findings"
```
