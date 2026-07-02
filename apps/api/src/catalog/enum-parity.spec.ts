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
