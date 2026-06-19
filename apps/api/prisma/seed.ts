import { PrismaClient, Rarity } from '@prisma/client';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
  validatePackModel,
} from '@sobrebox/shared';

const prisma = new PrismaClient();

async function main() {
  const tcgPack = {
    slots: [
      { rarity: Rarity.COMMON, count: 5 },
      { rarity: Rarity.RARE, count: 1 },
    ],
  };
  // itemId references a CollectionItem.id; 'placeholder' is seed-only (not a real id).
  const figurePack = { items: [{ itemId: 'placeholder' }] };
  const blindPack = {
    caseSize: 12,
    assortment: [{ itemId: 'placeholder', count: 11 }],
    chase: { itemId: 'placeholder', odds: 144 },
  };

  for (const [category, model] of [
    [CollectionCategory.TCG, tcgPack],
    [CollectionCategory.FIGURE, figurePack],
    [CollectionCategory.BLIND_BOX, blindPack],
  ] as const) {
    if (!validatePackModel(category, model).success) {
      throw new Error(`Seed pack model invalid for ${category}`);
    }
  }

  const pokemon = await prisma.brand.upsert({
    where: { slug: 'pokemon' }, update: {}, create: { slug: 'pokemon', name: 'Pokémon' },
  });
  const funko = await prisma.brand.upsert({
    where: { slug: 'funko' }, update: {}, create: { slug: 'funko', name: 'Funko' },
  });
  const popmart = await prisma.brand.upsert({
    where: { slug: 'pop-mart' }, update: {}, create: { slug: 'pop-mart', name: 'Pop Mart' },
  });

  await prisma.collection.upsert({
    where: { slug: 'sv-obsidian-flames' },
    update: {},
    create: {
      slug: 'sv-obsidian-flames', name: 'Scarlet & Violet — Obsidian Flames',
      brandId: pokemon.id, category: CollectionCategory.TCG,
      status: CollectionStatus.PUBLISHED, source: CollectionSource.API_IMPORT,
      releaseYear: 2023,
      items: { create: [
        { name: 'Charizard ex', rarity: Rarity.ULTRA_RARE },
        { name: 'Pikachu', rarity: Rarity.COMMON },
      ] },
      packTypes: { create: [{ name: 'Booster', packModel: tcgPack }] },
    },
  });

  await prisma.collection.upsert({
    where: { slug: 'funko-marvel' },
    update: {},
    create: {
      slug: 'funko-marvel', name: 'Funko Pop! — Marvel',
      brandId: funko.id, category: CollectionCategory.FIGURE,
      status: CollectionStatus.PUBLISHED, source: CollectionSource.COMMUNITY,
      items: { create: [{ name: 'Spider-Man', rarity: Rarity.COMMON }] },
      packTypes: { create: [{ name: 'Single Box', packModel: figurePack }] },
    },
  });

  await prisma.collection.upsert({
    where: { slug: 'skullpanda-the-sound' },
    update: {},
    create: {
      slug: 'skullpanda-the-sound', name: 'Skullpanda — The Sound',
      brandId: popmart.id, category: CollectionCategory.BLIND_BOX,
      status: CollectionStatus.PUBLISHED, source: CollectionSource.COMMUNITY,
      items: { create: [
        { name: 'Melody', rarity: Rarity.COMMON },
        { name: 'Secret Chase', rarity: Rarity.SECRET },
      ] },
      packTypes: { create: [{ name: 'Case', packModel: blindPack }] },
    },
  });
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1);
});
