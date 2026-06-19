import {
  CollectionCategory as PrismaCategory,
  CollectionSource as PrismaSource,
  CollectionStatus as PrismaStatus,
  Rarity as PrismaRarity,
} from '@prisma/client';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
  Rarity,
} from '@sobrebox/shared';

const sorted = (o: Record<string, string>) => Object.values(o).sort();

describe('enum parity (prisma <-> shared)', () => {
  it('Rarity matches', () => expect(sorted(Rarity)).toEqual(sorted(PrismaRarity)));
  it('CollectionCategory matches', () =>
    expect(sorted(CollectionCategory)).toEqual(sorted(PrismaCategory)));
  it('CollectionStatus matches', () =>
    expect(sorted(CollectionStatus)).toEqual(sorted(PrismaStatus)));
  it('CollectionSource matches', () =>
    expect(sorted(CollectionSource)).toEqual(sorted(PrismaSource)));
});
