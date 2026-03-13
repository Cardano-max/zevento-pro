import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Upsert Markets with lat/lng
  const surat = await prisma.market.upsert({
    where: { city_state: { city: 'Surat', state: 'Gujarat' } },
    update: { latitude: 21.1702, longitude: 72.8311, status: 'ACTIVE' },
    create: {
      city: 'Surat',
      state: 'Gujarat',
      status: 'ACTIVE',
      latitude: 21.1702,
      longitude: 72.8311,
    },
  });
  console.log(`  Market: ${surat.city} (${surat.id})`);

  const ahmedabad = await prisma.market.upsert({
    where: { city_state: { city: 'Ahmedabad', state: 'Gujarat' } },
    update: { latitude: 23.0225, longitude: 72.5714, status: 'ACTIVE' },
    create: {
      city: 'Ahmedabad',
      state: 'Gujarat',
      status: 'ACTIVE',
      latitude: 23.0225,
      longitude: 72.5714,
    },
  });
  console.log(`  Market: ${ahmedabad.city} (${ahmedabad.id})`);

  // Upsert Event Categories
  const birthday = await prisma.eventCategory.upsert({
    where: { slug: 'birthday-decoration' },
    update: {},
    create: {
      name: 'Birthday Decoration',
      slug: 'birthday-decoration',
      description: 'Birthday party decorations and setups',
      isActive: true,
      sortOrder: 1,
    },
  });
  console.log(`  Category: ${birthday.name} (${birthday.id})`);

  const balloon = await prisma.eventCategory.upsert({
    where: { slug: 'balloon-decor' },
    update: {},
    create: {
      name: 'Balloon Decor',
      slug: 'balloon-decor',
      description: 'Balloon decoration services',
      isActive: true,
      sortOrder: 2,
    },
  });
  console.log(`  Category: ${balloon.name} (${balloon.id})`);

  // Upsert Subscription Plans
  const plans = [
    {
      name: 'Planner Basic',
      vendorRole: 'PLANNER',
      tier: 'BASIC',
      amountPaise: 1200000,
      periodMonths: 1,
    },
    {
      name: 'Planner Premium',
      vendorRole: 'PLANNER',
      tier: 'PREMIUM',
      amountPaise: 1800000,
      periodMonths: 1,
    },
    {
      name: 'Supplier Basic',
      vendorRole: 'SUPPLIER',
      tier: 'BASIC',
      amountPaise: 3600000,
      periodMonths: 1,
    },
    {
      name: 'Supplier Premium',
      vendorRole: 'SUPPLIER',
      tier: 'PREMIUM',
      amountPaise: 5000000,
      periodMonths: 1,
    },
  ];

  for (const plan of plans) {
    const result = await prisma.subscriptionPlan.upsert({
      where: {
        vendorRole_tier: {
          vendorRole: plan.vendorRole,
          tier: plan.tier,
        },
      },
      update: { amountPaise: plan.amountPaise },
      create: plan,
    });
    console.log(`  Plan: ${result.name} - Rs.${result.amountPaise / 100} (${result.id})`);
  }

  // Create default VendorStats for any existing vendor profiles without stats
  const vendorsWithoutStats = await prisma.vendorProfile.findMany({
    where: { stats: null },
    select: { id: true },
  });

  for (const vendor of vendorsWithoutStats) {
    await prisma.vendorStats.upsert({
      where: { vendorId: vendor.id },
      update: {},
      create: {
        vendorId: vendor.id,
        averageRating: 3.0,
        responseRate: 0.5,
      },
    });
  }

  if (vendorsWithoutStats.length > 0) {
    console.log(
      `  VendorStats: created defaults for ${vendorsWithoutStats.length} vendor(s)`,
    );
  }

  // Seed Product Categories (Phase 6)
  await seedProductCategories();

  console.log('Seed complete.');
}

async function seedProductCategories() {
  const categories = [
    { name: 'Balloons', slug: 'balloons', sortOrder: 1 },
    { name: 'Ribbons & Bows', slug: 'ribbons-bows', sortOrder: 2 },
    { name: 'Tableware', slug: 'tableware', sortOrder: 3 },
    { name: 'Decorative Lights', slug: 'decorative-lights', sortOrder: 4 },
    { name: 'Banners & Backdrops', slug: 'banners-backdrops', sortOrder: 5 },
    { name: 'Party Favors', slug: 'party-favors', sortOrder: 6 },
    { name: 'Floral Supplies', slug: 'floral-supplies', sortOrder: 7 },
    { name: 'Craft & DIY', slug: 'craft-diy', sortOrder: 8 },
  ];

  for (const cat of categories) {
    const result = await prisma.productCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        isActive: true,
        sortOrder: cat.sortOrder,
      },
    });
    console.log(`  Product Category: ${result.name} (${result.id})`);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
