# Inventory quantity editor — design

## Problem

In the collection ownership panel, an owned item can only be incremented (`+1`) or
fully removed (destructive button). There is no way to **decrement** or **set an exact
quantity**. Users want to adjust the owned count directly.

## Scope

Frontend only. One component: `apps/web/components/inventory/collection-ownership-panel.tsx`
(+ its test). No backend, shared, or DTO changes.

The backend already supports everything:

- `PATCH /inventory/:id` with `{ quantity }` — sets the **absolute** quantity, `z.number().int().positive()` (min 1). Fetcher: `updateInventoryItem(id, dto, token)` (exists).
- `DELETE /inventory/:id` — removes the row. Fetcher: `deleteInventoryItem(id, token)` (exists).
- `POST /inventory` increments — no longer used by the owned-row `+` (we switch to absolute PATCH).

## Behaviour (owned row)

Replace the current `+1` button + destructive remove with a stepper plus an explicit
remove:

```
Secret Chase   [ − ]  ⌜ 16 ⌟  [ + ]   🗑   Vender
```

- **`+`** → `updateInventoryItem(id, { quantity: N + 1 })`.
- **`−`** with `N > 1` → `updateInventoryItem(id, { quantity: N - 1 })`.
- **`−`** with `N === 1` → `deleteInventoryItem(id)` (quantity would drop to 0 = not owned).
- **Number input** (the count is an editable field): on commit (Enter or blur), parse int:
  - `>= 1` → `updateInventoryItem(id, { quantity: value })`.
  - `<= 0` or empty → `deleteInventoryItem(id)`.
  - non-numeric → reset the field back to the current `N` (no request).
- **🗑 remove** (explicit) → `deleteInventoryItem(id)`. Kept so a large stack can be
  removed in one click; `−`-at-1 and input-`0` are secondary removal paths.

Missing (not-owned) row: unchanged — "La tengo" adds quantity 1, after which the row
renders as owned with the stepper.

## Reuse / consistency

- Reuse the existing mutation pattern in the panel: `useMutation` + `queryClient.invalidateQueries({ queryKey: ['inventory', 'progress'] })` + success/error toasts + `disabled={busy}` while any mutation is pending.
- Add one `updateOwned` mutation (`updateInventoryItem`); reuse the existing `removeOwned`
  (`deleteInventoryItem`) for the trash button and the removal edge cases.
- Enums/strings: none introduced (quantities are numbers).
- Keep motion consistent with the panel's existing `motion/react` usage; a subtle
  animated count transition is acceptable polish but must not change behaviour.

## Edge cases

- Rapid clicks: `disabled={busy}` blocks concurrent mutations (existing pattern).
- Invalid input (letters, negatives, empty): never send a bad PATCH — either delete (≤0)
  or reset the field.
- The `+`/`−` and input never send `quantity: 0` to PATCH (schema rejects it); 0 routes to
  DELETE.

## Testing (TDD)

Extend `apps/web/components/inventory/collection-ownership-panel.test.tsx` (owned-item
case already exists):

1. `+` calls `updateInventoryItem` with `{ quantity: N + 1 }`.
2. `−` with `N > 1` calls `updateInventoryItem` with `{ quantity: N - 1 }`.
3. `−` with `N === 1` calls `deleteInventoryItem` (not a PATCH to 0).
4. Typing an exact quantity and committing calls `updateInventoryItem` with that value.
5. Committing `0`/empty calls `deleteInventoryItem`.
6. The explicit trash button calls `deleteInventoryItem`.
7. Existing owned/missing assertions (Sell link, wishlist, add) stay green.

## Out of scope

- Marketplace/listing quantity (separate).
- The Docker/Next "hangs compiling" issue — tracked and fixed separately (systematic-debugging), not part of this feature.
