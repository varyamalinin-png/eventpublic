const { PrismaClient } = require('@prisma/client');

// Используем DATABASE_URL из переменных окружения, если он установлен
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не установлен!');
  console.error('Установите DATABASE_URL в переменных окружения:');
  console.error('DATABASE_URL="postgresql://..." node scripts/check-ramen-event.js');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function checkRamenEvent() {
  try {
    console.log('🔍 Ищем событие "ramen"...\n');

    // Ищем событие по названию
    const event = await prisma.event.findFirst({
      where: {
        title: {
          contains: 'ramen',
          mode: 'insensitive',
        },
      },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      console.log('❌ Событие "ramen" не найдено');
      return;
    }

    console.log('✅ Событие найдено:');
    console.log(`   ID: ${event.id}`);
    console.log(`   Название: ${event.title}`);
    console.log(`   Дата: ${event.startTime}`);
    console.log(`   Организатор: ${event.organizer.name || event.organizer.username || event.organizer.email} (${event.organizer.id})`);
    console.log(`   Статус: ${event.isCancelled ? 'ОТМЕНЕНО' : 'АКТИВНО'}`);
    console.log(`\n📊 Участники (${event.memberships.length}):`);

    event.memberships.forEach((membership, index) => {
      const user = membership.user;
      const userName = user.name || user.username || user.email || 'Без имени';
      console.log(`   ${index + 1}. ${userName} (${user.id})`);
      console.log(`      Статус: ${membership.status}`);
      console.log(`      Приглашен: ${membership.invitedBy ? 'Да' : 'Нет'}`);
      if (membership.invitedBy) {
        console.log(`      Пригласил: ${membership.invitedBy}`);
      }
      console.log(`      Создан: ${membership.createdAt}`);
      console.log(`      Обновлен: ${membership.updatedAt}`);
      console.log('');
    });

    // Проверяем EventProfile
    const eventProfile = await prisma.eventProfile.findUnique({
      where: { eventId: event.id },
      include: {
        participants: true,
      },
    });

    if (eventProfile) {
      console.log(`\n📝 EventProfile найден:`);
      console.log(`   Участников в профиле: ${eventProfile.participants.length}`);
      eventProfile.participants.forEach((participant, index) => {
        console.log(`   ${index + 1}. User ID: ${participant.userId}`);
      });
    } else {
      console.log(`\n📝 EventProfile НЕ найден (событие еще не завершилось или профиль не создан)`);
    }

    // Проверяем, какие пользователи имеют ACCEPTED статус
    const acceptedMemberships = event.memberships.filter(m => m.status === 'ACCEPTED');
    console.log(`\n✅ Участники со статусом ACCEPTED: ${acceptedMemberships.length}`);
    acceptedMemberships.forEach((membership, index) => {
      const user = membership.user;
      const userName = user.name || user.username || user.email || 'Без имени';
      console.log(`   ${index + 1}. ${userName} (${user.id})`);
    });

    // Проверяем, какие пользователи имеют PENDING статус
    const pendingMemberships = event.memberships.filter(m => m.status === 'PENDING');
    console.log(`\n⏳ Участники со статусом PENDING: ${pendingMemberships.length}`);
    pendingMemberships.forEach((membership, index) => {
      const user = membership.user;
      const userName = user.name || user.username || user.email || 'Без имени';
      console.log(`   ${index + 1}. ${userName} (${user.id})`);
      console.log(`      Приглашен: ${membership.invitedBy ? 'Да' : 'Нет'}`);
    });

    // Проверяем, какие пользователи имеют REJECTED статус
    const rejectedMemberships = event.memberships.filter(m => m.status === 'REJECTED');
    console.log(`\n❌ Участники со статусом REJECTED: ${rejectedMemberships.length}`);
    rejectedMemberships.forEach((membership, index) => {
      const user = membership.user;
      const userName = user.name || user.username || user.email || 'Без имени';
      console.log(`   ${index + 1}. ${userName} (${user.id})`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRamenEvent();

