# Marketplace Listing Photos UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built listing-photos backend into the web UI — a navegable gallery on the listing detail and per-listing photo upload/delete on "My listings".

**Architecture:** Frontend-only. Two existing React components change. `listing-detail.tsx` becomes a client component with a main-image + thumbnail-strip gallery built from `listing.photos` (seller) + `item.imageUrl` (catalog fallback). `my-listings.tsx` gains a per-row `ListingPhotos` child that renders thumbnails with a delete button and an upload button backed by a hidden file input, driven by TanStack Query mutations against the existing `uploadListingPhotos` / `deleteListingPhoto` api wrappers. New i18n keys in both locales.

**Tech Stack:** Next.js 15 (App Router), React 19, TanStack Query v5, next-intl, sonner, Vitest + Testing Library + userEvent, Tailwind v4, shadcn `Button`.

## Global Constraints

- No hardcoded UI strings — every user-facing string via `useTranslations('Marketplace')`; add keys to `apps/web/locales/en.json` **and** `apps/web/locales/es.json`.
- No `any` — use domain types (`ListingDto`, `ListingPhotoDto`) or `unknown` + guards.
- TDD: failing test first, minimal impl, green, commit. Run `pnpm --filter @sobrebox/web test` before declaring a task done.
- Coverage gate: web ≥80% statements/branches/functions/lines — do not lower it.
- Frontend-only: do NOT touch `apps/api`, `apps/web/lib/api.ts`, Prisma, or `packages/shared`. The api wrappers `uploadListingPhotos(id, files, token)`, `deleteListingPhoto(listingId, photoId, token)` and `ListingDto.photos: {id,url}[]` already exist.
- Photo max = 5 (server-enforced; client disables the upload button as UX).
- Commits: Conventional Commits, English, scope `web`.

---

## File Structure

- **Modify** `apps/web/components/marketplace/listing-detail.tsx` — add `'use client'`, gallery state + thumbnail strip.
- **Modify** `apps/web/components/marketplace/listing-detail.test.tsx` — gallery tests.
- **Modify** `apps/web/components/marketplace/my-listings.tsx` — add a `ListingPhotos` child component + render it per row.
- **Modify** `apps/web/components/marketplace/my-listings.test.tsx` — photo strip / upload / delete / disabled tests.
- **Modify** `apps/web/locales/en.json` and `apps/web/locales/es.json` — new `Marketplace` keys.

---

## Task 1: Gallery on the listing detail

**Files:**
- Modify: `apps/web/components/marketplace/listing-detail.tsx`
- Test: `apps/web/components/marketplace/listing-detail.test.tsx`
- Modify: `apps/web/locales/en.json`, `apps/web/locales/es.json`

**Interfaces:**
- Consumes: `ListingDto` from `@sobrebox/shared` (`listing.photos: {id,url}[]`, `listing.item.imageUrl: string | null`, `listing.item.name`). `cn` from `@/lib/utils`.
- Produces: nothing consumed by later tasks (independent component).

Gallery array = seller photos first, catalog image last:
`[...listing.photos.map(p => p.url), ...(listing.item.imageUrl ? [listing.item.imageUrl] : [])]`.
Main image = `gallery[selected]` (`selected` state, default 0). Thumbnail strip shown only when `gallery.length > 1`. Empty gallery → existing `bg-muted` placeholder. Main image keeps `alt={listing.item.name}` (so tests can target it by accessible name); thumbnail `<img>` use `alt=""` and sit inside a `<button>` labelled `viewPhoto`.

- [ ] **Step 1: Add the `viewPhoto` i18n key to both locales**

In `apps/web/locales/en.json`, inside `"Marketplace"`, add:

```json
    "viewPhoto": "View photo {n}"
```

In `apps/web/locales/es.json`, inside `"Marketplace"`, add:

```json
    "viewPhoto": "Ver foto {n}"
```

- [ ] **Step 2: Write the failing gallery tests**

Replace the `listing` fixture's `photos: []` usage by adding photo-bearing cases. Add these tests inside the `describe('ListingDetail', …)` block in `apps/web/components/marketplace/listing-detail.test.tsx`. Extend the inline messages in `renderWithProviders` to include `viewPhoto`:

```tsx
messages={{
  Marketplace: { offerSoon: 'Offers coming soon', viewPhoto: 'View photo {n}' },
}}
```

Add a helper + tests:

```tsx
const withPhotos: ListingDto = {
  ...listing,
  item: { ...listing.item, imageUrl: 'https://cdn/catalog.webp' },
  photos: [
    { id: 'p1', url: 'https://cdn/p1.webp' },
    { id: 'p2', url: 'https://cdn/p2.webp' },
  ],
};

it('shows the first seller photo as the main image', () => {
  renderWithProviders(<ListingDetail listing={withPhotos} />);
  const main = screen.getByRole('img', { name: 'Charizard' });
  expect(main).toHaveAttribute('src', 'https://cdn/p1.webp');
});

it('renders a thumbnail button per gallery image (photos + catalog)', () => {
  renderWithProviders(<ListingDetail listing={withPhotos} />);
  expect(screen.getAllByRole('button', { name: /view photo/i })).toHaveLength(3);
});

it('switches the main image when a thumbnail is clicked', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ListingDetail listing={withPhotos} />);
  await user.click(screen.getByRole('button', { name: 'View photo 3' }));
  expect(screen.getByRole('img', { name: 'Charizard' })).toHaveAttribute(
    'src',
    'https://cdn/catalog.webp',
  );
});

it('falls back to the catalog image when there are no seller photos', () => {
  renderWithProviders(
    <ListingDetail
      listing={{
        ...listing,
        item: { ...listing.item, imageUrl: 'https://cdn/catalog.webp' },
      }}
    />,
  );
  expect(screen.getByRole('img', { name: 'Charizard' })).toHaveAttribute(
    'src',
    'https://cdn/catalog.webp',
  );
  expect(
    screen.queryByRole('button', { name: /view photo/i }),
  ).not.toBeInTheDocument();
});

it('renders a placeholder when there are no images at all', () => {
  const { container } = renderWithProviders(<ListingDetail listing={listing} />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(container.querySelector('.bg-muted')).toBeInTheDocument();
});
```

Add the userEvent import at the top of the test file:

```tsx
import userEvent from '@testing-library/user-event';
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @sobrebox/web test listing-detail`
Expected: FAIL — the new gallery tests fail (main image not found by src / no thumbnail buttons).

- [ ] **Step 4: Implement the gallery**

Replace the whole contents of `apps/web/components/marketplace/listing-detail.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ListingDto } from '@sobrebox/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ListingDetail({ listing }: { listing: ListingDto }) {
  const t = useTranslations('Marketplace');
  const gallery = [
    ...listing.photos.map((p) => p.url),
    ...(listing.item.imageUrl ? [listing.item.imageUrl] : []),
  ];
  const [selected, setSelected] = useState(0);
  const main = gallery[selected];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border p-4">
        {main ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main} alt={listing.item.name} className="w-full rounded" />
            {gallery.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {gallery.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-label={t('viewPhoto', { n: i + 1 })}
                    className={cn(
                      'h-16 w-16 overflow-hidden rounded border',
                      i === selected && 'ring-2 ring-primary',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
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
          {listing.condition} · <span>@{listing.seller.username}</span>
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @sobrebox/web test listing-detail`
Expected: PASS — all ListingDetail tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/marketplace/listing-detail.tsx apps/web/components/marketplace/listing-detail.test.tsx apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): photo gallery on marketplace listing detail"
```

---

## Task 2: Photo upload/delete on My listings

**Files:**
- Modify: `apps/web/components/marketplace/my-listings.tsx`
- Test: `apps/web/components/marketplace/my-listings.test.tsx`
- Modify: `apps/web/locales/en.json`, `apps/web/locales/es.json`

**Interfaces:**
- Consumes: `uploadListingPhotos(id: string, files: File[], accessToken: string): Promise<ListingPhotoDto[]>` and `deleteListingPhoto(listingId: string, photoId: string, accessToken: string): Promise<void>` from `@/lib/api` (already exist). `ListingDto.photos: {id,url}[]`.
- Produces: a `ListingPhotos` child component (local to the file — not exported).

Each row renders the existing name/price/status + pause/delete actions, and below them a `ListingPhotos` strip: one thumbnail per `listing.photos` with a `×` delete button, plus an "Add photos" button that opens a hidden `<input type="file" accept="image/*" multiple>`. Upload/delete success invalidates `['marketplace','mine']`. Upload button disabled when `photos.length >= 5`.

- [ ] **Step 1: Add the photo i18n keys to both locales**

In `apps/web/locales/en.json`, inside `"Marketplace"`, add:

```json
    "uploadPhotos": "Add photos",
    "deletePhoto": "Delete photo",
    "photoLimit": "Maximum 5 photos",
    "photosUploaded": "Photos uploaded",
    "photoUploadError": "Couldn't upload photos"
```

In `apps/web/locales/es.json`, inside `"Marketplace"`, add:

```json
    "uploadPhotos": "Añadir fotos",
    "deletePhoto": "Borrar foto",
    "photoLimit": "Máximo 5 fotos",
    "photosUploaded": "Fotos subidas",
    "photoUploadError": "No se pudieron subir las fotos"
```

- [ ] **Step 2: Write the failing tests**

In `apps/web/components/marketplace/my-listings.test.tsx`, extend the inline messages in `renderWithProviders` to include the new keys:

```tsx
Marketplace: {
  mineEmpty: 'You have no listings.',
  pause: 'Pause',
  delete: 'Delete',
  uploadPhotos: 'Add photos',
  deletePhoto: 'Delete photo',
  photoLimit: 'Maximum 5 photos',
  photosUploaded: 'Photos uploaded',
  photoUploadError: "Couldn't upload photos",
},
```

Add these tests inside `describe('MyListings', …)`:

```tsx
it('renders a thumbnail per listing photo', async () => {
  vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
    items: [
      makeListing({
        photos: [
          { id: 'p1', url: 'https://cdn/p1.webp' },
          { id: 'p2', url: 'https://cdn/p2.webp' },
        ],
      }),
    ],
    page: 1,
    total: 1,
    totalPages: 1,
  });
  const { container } = renderWithProviders(<MyListings />);
  await waitFor(() =>
    expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
  );
  expect(container.querySelectorAll('img')).toHaveLength(2);
});

it('deletes a photo via its delete button', async () => {
  const user = userEvent.setup();
  vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
    items: [
      makeListing({ id: 'l1', photos: [{ id: 'p1', url: 'https://cdn/p1.webp' }] }),
    ],
    page: 1,
    total: 1,
    totalPages: 1,
  });
  vi.spyOn(api, 'deleteListingPhoto').mockResolvedValue(undefined);
  renderWithProviders(<MyListings />);
  await waitFor(() =>
    expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
  );
  await user.click(screen.getByRole('button', { name: 'Delete photo' }));
  await waitFor(() =>
    expect(api.deleteListingPhoto).toHaveBeenCalledWith('l1', 'p1', 'token'),
  );
});

it('uploads chosen files via the hidden file input', async () => {
  const user = userEvent.setup();
  vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
    items: [makeListing({ id: 'l1', photos: [] })],
    page: 1,
    total: 1,
    totalPages: 1,
  });
  vi.spyOn(api, 'uploadListingPhotos').mockResolvedValue([
    { id: 'p1', url: 'https://cdn/p1.webp' },
  ]);
  const { container } = renderWithProviders(<MyListings />);
  await waitFor(() =>
    expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
  );
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File(['x'], 'card.png', { type: 'image/png' });
  await user.upload(input, file);
  await waitFor(() =>
    expect(api.uploadListingPhotos).toHaveBeenCalledWith('l1', [file], 'token'),
  );
});

it('disables the upload button when the listing already has 5 photos', async () => {
  vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
    items: [
      makeListing({
        photos: [1, 2, 3, 4, 5].map((n) => ({
          id: `p${n}`,
          url: `https://cdn/p${n}.webp`,
        })),
      }),
    ],
    page: 1,
    total: 1,
    totalPages: 1,
  });
  renderWithProviders(<MyListings />);
  await waitFor(() =>
    expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
  );
  expect(screen.getByRole('button', { name: 'Add photos' })).toBeDisabled();
});

it('shows an error toast when the upload fails', async () => {
  const user = userEvent.setup();
  vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
    items: [makeListing({ id: 'l1', photos: [] })],
    page: 1,
    total: 1,
    totalPages: 1,
  });
  vi.spyOn(api, 'uploadListingPhotos').mockRejectedValue(new Error('boom'));
  const { container } = renderWithProviders(<MyListings />);
  await waitFor(() =>
    expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
  );
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  await user.upload(input, new File(['x'], 'card.png', { type: 'image/png' }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Couldn't upload photos"),
  );
});
```

At the top of the test file, mock `sonner` so `toast.error` / `toast.success` are spies:

```tsx
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
```

(If a `sonner` mock already exists in the file, extend it to include both `success` and `error` rather than adding a second mock.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @sobrebox/web test my-listings`
Expected: FAIL — no photo thumbnails / no "Add photos" button / no file input.

- [ ] **Step 4: Implement the `ListingPhotos` child and render it**

In `apps/web/components/marketplace/my-listings.tsx`:

Update the imports at the top to add `useRef`, the two photo api wrappers, and `ListingPhotoDto`/`ListingDto` types:

```tsx
'use client';
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ListingStatus, type ListingDto } from '@sobrebox/shared';
import {
  deleteListing,
  deleteListingPhoto,
  fetchMyListings,
  updateListing,
  uploadListingPhotos,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
```

Add the child component above `export function MyListings` (same file):

```tsx
const MAX_PHOTOS = 5;

function ListingPhotos({
  listing,
  accessToken,
}: {
  listing: ListingDto;
  accessToken: string;
}) {
  const t = useTranslations('Marketplace');
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['marketplace', 'mine'] });

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      uploadListingPhotos(listing.id, files, accessToken),
    onSuccess: () => {
      invalidate();
      toast.success(t('photosUploaded'));
    },
    onError: () => toast.error(t('photoUploadError')),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) =>
      deleteListingPhoto(listing.id, photoId, accessToken),
    onSuccess: invalidate,
  });

  const atMax = listing.photos.length >= MAX_PHOTOS;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {listing.photos.map((photo) => (
        <div key={photo.id} className="relative h-16 w-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            className="h-full w-full rounded object-cover"
          />
          <button
            type="button"
            aria-label={t('deletePhoto')}
            onClick={() => remove.mutate(photo.id)}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
          >
            ×
          </button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) upload.mutate(files);
          e.target.value = '';
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={atMax}
        title={atMax ? t('photoLimit') : undefined}
        onClick={() => inputRef.current?.click()}
      >
        {t('uploadPhotos')}
      </Button>
    </div>
  );
}
```

Then restructure the `<li>` in `MyListings` from a single flex row into a column with the actions row on top and the photo strip below:

```tsx
      {data.items.map((listing) => (
        <li key={listing.id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
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
          </div>
          <ListingPhotos listing={listing} accessToken={accessToken as string} />
        </li>
      ))}
```

Note: `remove` inside `MyListings` (the listing-delete mutation) is unchanged; the photo-delete mutation is the separate `remove` local to `ListingPhotos`. They don't collide (different scopes).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @sobrebox/web test my-listings`
Expected: PASS — all MyListings tests green, including the new photo tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/marketplace/my-listings.tsx apps/web/components/marketplace/my-listings.test.tsx apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): upload and delete photos on my listings"
```

---

## Task 3: Full gate

**Files:** none (verification only).

- [ ] **Step 1: Run the web suite with coverage**

Run: `pnpm --filter @sobrebox/web test`
Expected: all suites pass.

- [ ] **Step 2: Run the PR gate**

Run: `pnpm pr-check`
Expected: lint + type-check + coverage (api/web/shared ≥80%) all green. If web coverage dropped below 80% on the changed files, add the missing-branch test (most likely the upload-error path in Task 2) rather than lowering the gate.

- [ ] **Step 3: Manual QA (optional, needs the app up)**

With infra + servers running (see handoff): open a listing you own in `/marketplace/mine`, add 1–2 photos, confirm thumbnails appear and the count caps at 5; delete one; open `/marketplace/[id]` and confirm the seller photo is the main image with a working thumbnail strip.

---

## Self-Review

**Spec coverage:**
- Detail gallery (main + thumbnails, seller-first, catalog fallback, placeholder) → Task 1. ✓
- My-listings thumbnails + delete + upload + disable at 5 → Task 2. ✓
- `fetchMyListings` returns photos → relied on by Task 2 tests (mock includes photos; real endpoint already returns them via `listingSchema`). The "renders a thumbnail per listing photo" test is the explicit check. ✓
- i18n keys in both locales → Task 1 (`viewPhoto`) + Task 2 (rest). ✓
- Non-atomic upload / reorder / cover photo → explicitly out of scope, no task. ✓
- Coverage ≥80% → Task 3. ✓

**Placeholder scan:** none — every code step shows full code.

**Type consistency:** `uploadListingPhotos(id, files, token)` / `deleteListingPhoto(listingId, photoId, token)` used exactly as defined in `api.ts`. `listing.photos` items are `{id,url}`. `ListingPhotos` props `{listing: ListingDto, accessToken: string}` consistent between definition and call site.
