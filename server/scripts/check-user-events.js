const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserEvents(username) {
  try {
    console.log(`\n🔍 Проверка событий пользователя: ${username}\n`);

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      console.log(`❌ Пользователь ${username} не найден`);
      return;
    }

    console.log(`✅ Пользователь найден:`, user);
    console.log(`\n📊 События, где пользователь является организатором:\n`);

    // События, где пользователь организатор
    const organizedEvents = await prisma.event.findMany({
      where: { organizerId: user.id },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        _count: {
          select: {
            memberships: {
              where: { status: 'ACCEPTED' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Всего организованных событий: ${organizedEvents.length}`);
    organizedEvents.forEach((event, index) => {
      const isPast = new Date(event.endTime || event.startTime) < new Date();
      const status = isPast ? 'ПРОШЕДШЕЕ' : 'ПРЕДСТОЯЩЕЕ';
      console.log(
        `${index + 1}. [${status}] ${event.title} (ID: ${event.id})`,
      );
      console.log(`   Участников: ${event._count.memberships}`);
      console.log(`   Создано: ${event.createdAt}`);
      console.log(`   Начало: ${event.startTime}`);
      if (event.endTime) {
        console.log(`   Конец: ${event.endTime}`);
      }
      console.log('');
    });

    console.log(`\n👥 Участие в событиях (memberships):\n`);

    // Memberships пользователя
    const memberships = await prisma.eventMembership.findMany({
      where: { userId: user.id },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            organizerId: true,
            organizer: {
              select: {
                username: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Всего memberships: ${memberships.length}`);
    memberships.forEach((membership, index) => {
      const event = membership.event;
      const isPast = new Date(event.endTime || event.startTime) < new Date();
      const status = isPast ? 'ПРОШЕДШЕЕ' : 'ПРЕДСТОЯЩЕЕ';
      const isOrganizer = event.organizerId === user.id;
      console.log(
        `${index + 1}. [${status}] ${event.title} (ID: ${event.id})`,
      );
      console.log(`   Статус membership: ${membership.status}`);
      console.log(`   Роль: ${membership.role}`);
      console.log(`   Организатор: ${isOrganizer ? 'ДА (это вы)' : event.organizer.username}`);
      console.log(`   Создано: ${membership.createdAt}`);
      console.log(`   Начало события: ${event.startTime}`);
      if (event.endTime) {
        console.log(`   Конец события: ${event.endTime}`);
      }
      console.log('');
    });

    console.log(`\n🚫 Отклоненные/отмененные запросы:\n`);

    // Отклоненные memberships
    const rejectedMemberships = memberships.filter(
      (m) => m.status === 'REJECTED' || m.status === 'CANCELLED',
    );
    console.log(`Всего отклоненных/отмененных: ${rejectedMemberships.length}`);
    rejectedMemberships.forEach((membership, index) => {
      const event = membership.event;
      console.log(
        `${index + 1}. ${event.title} (ID: ${event.id}) - Статус: ${membership.status}`,
      );
    });

    console.log(`\n✅ Принятые memberships:\n`);

    // Принятые memberships
    const acceptedMemberships = memberships.filter(
      (m) => m.status === 'ACCEPTED',
    );
    console.log(`Всего принятых: ${acceptedMemberships.length}`);
    acceptedMemberships.forEach((membership, index) => {
      const event = membership.event;
      const isOrganizer = event.organizerId === user.id;
      console.log(
        `${index + 1}. ${event.title} (ID: ${event.id}) - ${isOrganizer ? 'ОРГАНИЗАТОР' : 'УЧАСТНИК'}`,
      );
    });

    console.log(`\n📋 Сводка:\n`);
    console.log(`Организованных событий: ${organizedEvents.length}`);
    console.log(`Всего memberships: ${memberships.length}`);
    console.log(`Принятых: ${acceptedMemberships.length}`);
    console.log(`Отклоненных/отмененных: ${rejectedMemberships.length}`);
    console.log(`Ожидающих: ${memberships.filter((m) => m.status === 'PENDING').length}`);

    // Проверяем, есть ли события, которые были удалены, но memberships остались
    console.log(`\n⚠️  Проверка на "мертвые" memberships (событие удалено, но membership остался):\n`);
    const allEventIds = new Set(organizedEvents.map((e) => e.id));
    const membershipEventIds = new Set(memberships.map((m) => m.eventId));
    const allEvents = await prisma.event.findMany({
      where: { id: { in: Array.from(membershipEventIds) } },
      select: { id: true },
    });
    const existingEventIds = new Set(allEvents.map((e) => e.id));
    const deadMemberships = memberships.filter(
      (m) => !existingEventIds.has(m.eventId),
    );
    if (deadMemberships.length > 0) {
      console.log(`❌ Найдено ${deadMemberships.length} "мертвых" memberships:`);
      deadMemberships.forEach((m) => {
        console.log(`   - Event ID: ${m.eventId}, Status: ${m.status}`);
      });
    } else {
      console.log(`✅ "Мертвых" memberships не найдено`);
    }

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем username из аргументов командной строки
const username = process.argv[2] || 'alan';

checkUserEvents(username);

