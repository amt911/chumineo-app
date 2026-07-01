import { PrismaClient, Prisma } from '@prisma/client';
import { validatePackModel } from '@sobrebox/shared';
import { loadFixtures } from './fixtures';

const prisma = new PrismaClient();

async function main() {
  const { brands, collections } = loadFixtures();

  // Validate every pack model against its category schema before writing.
  for (const c of collections) {
    for (const pt of c.packTypes) {
      if (!validatePackModel(c.category, pt.packModel).success) {
        throw new Error(
          `Seed pack model invalid for ${c.slug} / ${pt.name} (${c.category})`,
        );
      }
    }
  }

  // Brands: idempotent upsert by slug → slug→id map for collection FKs.
  const brandIdBySlug = new Map<string, string>();
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: {},
      create: { slug: b.slug, name: b.name },
    });
    brandIdBySlug.set(b.slug, row.id);
  }

  for (const c of collections) {
    const brandId = brandIdBySlug.get(c.brandSlug);
    if (!brandId) throw new Error(`Unknown brandSlug "${c.brandSlug}"`);
    await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        name: c.name,
        brandId,
        category: c.category,
        status: c.status,
        source: c.source,
        releaseYear: c.releaseYear ?? null,
        items: {
          create: c.items.map((i) => ({ name: i.name, rarity: i.rarity })),
        },
        packTypes: {
          create: c.packTypes.map((pt) => ({
            name: pt.name,
            packModel: pt.packModel as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
