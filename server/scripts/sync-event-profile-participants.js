/**
 * Синхронизация участников EventProfile с организатором и принятыми участниками (EventMembership).
 * Исправляет случаи, когда событие было создано по старой логике и в профиле нет участников.
 *
 * Использование:
 *   cd server && DATABASE_URL="postgresql://..." node scripts/sync-event-profile-participants.js
 *   cd server && DATABASE_URL="postgresql://..." node scripts/sync-event-profile-participants.js "Погулять с колясками"  # только для одного события по названию
 */

const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL не установлен.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

// Опционально: фильтр по названию события (первый аргумент)
const titleFilter = process.argv[2] || null;

async function main() {
  console.log('🔍 Синхронизация участников EventProfile с EventMembership (организатор + ACCEPTED)...\n');

  let eventIdsToProcess;
  if (titleFilter) {
    const found = await prisma.event.findMany({
      where: { title: { contains: titleFilter, mode: 'insensitive' } },
      select: { id: true, profile: { select: { id: true } } },
    });
    eventIdsToProcess = found.filter((e) => e.profile).map((e) => e.id);
    if (eventIdsToProcess.length === 0) {
      console.log(`❌ События по названию "${titleFilter}" с профилем не найдены.`);
      return;
    }
  } else {
    eventIdsToProcess = (await prisma.eventProfile.findMany({ select: { eventId: true } })).map((p) => p.eventId);
  }

  const eventsToProcess = await prisma.event.findMany({
    where: { id: { in: eventIdsToProcess } },
    include: {
      profile: { include: { participants: true } },
      memberships: {
        where: { status: 'ACCEPTED' },
        select: { userId: true },
      },
      organizer: { select: { id: true, username: true, name: true } },
    },
  });

  let fixedCount = 0;
  let totalAdded = 0;

  for (const event of eventsToProcess) {
    const profile = event.profile;
    if (!profile) continue;

    const shouldHaveIds = [
      event.organizerId,
      ...event.memberships.map((m) => m.userId),
    ];
    const uniqueShouldHave = [...new Set(shouldHaveIds)];
    const currentIds = profile.participants.map((p) => p.userId);
    const missing = uniqueShouldHave.filter((id) => !currentIds.includes(id));

    if (missing.length === 0) continue;

    console.log(`📌 Событие: "${event.title}" (${event.id})`);
    console.log(`   Организатор: ${event.organizer?.username || event.organizerId}`);
    console.log(`   В профиле было: ${currentIds.length}, должно быть: ${uniqueShouldHave.length}, отсутствуют: ${missing.length}`);

    for (const userId of missing) {
      try {
        await prisma.eventProfileParticipant.create({
          data: { profileId: profile.id, userId },
        });
        console.log(`   ✅ Добавлен участник: ${userId}`);
        totalAdded++;
      } catch (err) {
        if (err.code === 'P2002') {
          console.log(`   ⏭️ Уже есть: ${userId}`);
        } else {
          console.error(`   ❌ Ошибка добавления ${userId}:`, err.message);
        }
      }
    }
    fixedCount++;
    console.log('');
  }

  console.log(`\n✅ Готово. Обновлено событий: ${fixedCount}, добавлено записей участников: ${totalAdded}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
