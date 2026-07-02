import { z } from 'zod';
import { WishlistPriority } from '../enums/wishlist-priority';
import { Rarity } from '../enums/rarity';
import { listingSchema } from './marketplace.dto';

// A marketplace listing that matches a wishlist item, tagged with whether its
// price fits the wishlist item's maxPrice budget.
export const matchListingSchema = listingSchema.extend({
  inBudget: z.boolean(),
});
export type MatchListingDto = z.infer<typeof matchListingSchema>;

// A wishlist item that has at least one active listing from another seller.
// `item`/`collection` are duplicated inside each listing intentionally so the
// web can reuse the existing marketplace listing card unchanged.
export const matchItemSchema = z.object({
  wishlistItemId: z.string(),
  priority: z.nativeEnum(WishlistPriority),
  maxPrice: z.string().nullable(),
  item: z.object({
    id: z.string(),
    name: z.string(),
    rarity: z.nativeEnum(Rarity),
    imageUrl: z.string().nullable(),
  }),
  collection: z.object({ slug: z.string(), name: z.string() }),
  listingCount: z.number().int(),
  inBudgetCount: z.number().int(),
  cheapestPrice: z.string(),
  listings: z.array(matchListingSchema),
});
export type MatchItemDto = z.infer<typeof matchItemSchema>;

export const matchesResponseSchema = z.array(matchItemSchema);
export type MatchesResponseDto = z.infer<typeof matchesResponseSchema>;
