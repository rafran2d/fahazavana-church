/* Données de démonstration — npm run seed */
import { PlatformRole, PrismaClient, StaffRole, SubscriptionStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);

  // Quotas indicatifs du CDC (à valider après chiffrage infra/IA). Prix en ariary, à définir.
  const plans = [
    { name: 'Basic', priceCents: 0, storageQuotaGb: 10, liveQuotaMinutes: 600, aiQuotaMinutes: 600, memberQuota: 100 },
    { name: 'Standard', priceCents: 0, storageQuotaGb: 50, liveQuotaMinutes: 3000, aiQuotaMinutes: 3000, memberQuota: 500 },
    { name: 'Premium', priceCents: 0, storageQuotaGb: 200, liveQuotaMinutes: 12000, aiQuotaMinutes: 12000, memberQuota: 2000 },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { name: p.name }, create: p, update: p });
  }
  const standard = await prisma.plan.findUniqueOrThrow({ where: { name: 'Standard' } });

  const user = (email: string, name: string, platformRole: PlatformRole = PlatformRole.USER) =>
    prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, platformRole },
      update: {},
    });

  await user('superadmin@fahazavana.test', 'Super Admin', PlatformRole.SUPER_ADMIN);
  const admin = await user('admin@eglise-demo.test', 'Admin Église Démo');
  const preacher = await user('predicateur@eglise-demo.test', 'Pasteur Démo');
  const members = await Promise.all(
    [1, 2, 3].map((i) => user(`membre${i}@eglise-demo.test`, `Membre ${i}`)),
  );

  const church = await prisma.church.upsert({
    where: { slug: 'eglise-demo' },
    create: {
      name: 'Église Démo',
      slug: 'eglise-demo',
      description: 'Église de démonstration du MVP',
      sourceLanguage: 'mg',
      targetLanguages: ['fr', 'en'],
    },
    update: {},
  });

  await prisma.churchStaff.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, churchId: church.id, role: StaffRole.ADMIN },
    update: {},
  });
  await prisma.churchStaff.upsert({
    where: { userId: preacher.id },
    create: {
      userId: preacher.id,
      churchId: church.id,
      role: StaffRole.PREACHER,
      bio: 'Prédicateur de démonstration',
    },
    update: {},
  });
  for (const m of members) {
    await prisma.membership.upsert({
      where: { userId_churchId: { userId: m.id, churchId: church.id } },
      create: { userId: m.id, churchId: church.id },
      update: {},
    });
  }

  const hasSub = await prisma.subscription.findFirst({ where: { churchId: church.id } });
  if (!hasSub) {
    const now = new Date();
    await prisma.subscription.create({
      data: {
        churchId: church.id,
        planId: standard.id,
        status: SubscriptionStatus.ACTIVE,
        startAt: now,
        endAt: new Date(now.getTime() + 365 * 86_400_000),
      },
    });
  }

  console.log(`Seed OK — mot de passe commun : ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
