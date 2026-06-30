import { z } from 'zod';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
} from '@sobrebox/shared';
import { Rarity } from '@prisma/client';
import brandsJson from './fixtures/brands.json';
import collectionsJson from './fixtures/collections.json';

export const brandFixtureSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});
export type BrandFixture = z.infer<typeof brandFixtureSchema>;

const itemFixtureSchema = z.object({
  name: z.string().min(1),
  rarity: z.nativeEnum(Rarity),
});

const packTypeFixtureSchema = z.object({
  name: z.string().min(1),
  // packModel is category-specific JSON; validated by validatePackModel in the seed.
  packModel: z.record(z.unknown()),
});

export const collectionFixtureSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  brandSlug: z.string().min(1),
  category: z.nativeEnum(CollectionCategory),
  status: z.nativeEnum(CollectionStatus),
  source: z.nativeEnum(CollectionSource),
  releaseYear: z.number().int().nullable(),
  items: z.array(itemFixtureSchema),
  packTypes: z.array(packTypeFixtureSchema),
});
export type CollectionFixture = z.infer<typeof collectionFixtureSchema>;

export function loadFixtures(): {
  brands: BrandFixture[];
  collections: CollectionFixture[];
} {
  return {
    brands: z.array(brandFixtureSchema).parse(brandsJson),
    collections: z.array(collectionFixtureSchema).parse(collectionsJson),
  };
}
