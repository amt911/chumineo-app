import { Rarity } from '@prisma/client';
import { loadFixtures, collectionFixtureSchema } from '../prisma/fixtures';

describe('seed fixtures', () => {
  it('loads and coerces the real fixture files', () => {
    const { brands, collections } = loadFixtures();
    expect(brands.map((b) => b.slug)).toContain('pokemon');
    const obsidian = collections.find((c) => c.slug === 'sv-obsidian-flames');
    expect(obsidian?.brandSlug).toBe('pokemon');
    expect(obsidian?.items[0].rarity).toBe(Rarity.ULTRA_RARE);
  });

  it('rejects an invalid rarity', () => {
    expect(
      collectionFixtureSchema.safeParse({
        slug: 's',
        name: 'N',
        brandSlug: 'b',
        category: 'TCG',
        status: 'PUBLISHED',
        source: 'COMMUNITY',
        releaseYear: null,
        items: [{ name: 'X', rarity: 'NOT_A_RARITY' }],
        packTypes: [],
      }).success,
    ).toBe(false);
  });
});
