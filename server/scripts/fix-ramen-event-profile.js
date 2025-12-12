/**
 * Скрипт для проверки и исправления EventProfile для события "ramen"
 * 
 * Использование:
 * DATABASE_URL="postgresql://user:password@host:port/database" node scripts/fix-ramen-event-profile.js
 */

const { PrismaClient } = require('@prisma/client');

// Используем DATABASE_URL из переменных окружения
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не установлен!');
  console.error('Установите DATABASE_URL в переменных окружения:');
  console.error('DATABASE_URL="postgresql://..." node scripts/fix-ramen-event-profile.js');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function fixRamenEventProfile() {
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
          where: {
            status: 'ACCEPTED',
          },
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
    console.log(`   Дата начала: ${event.startTime}`);
    console.log(`   Организатор: ${event.organizer.name || event.organizer.username || event.organizer.email} (${event.organizer.id})`);
    console.log(`   Участников со статусом ACCEPTED: ${event.memberships.length}`);

    // Проверяем, является ли событие прошедшим
    const now = new Date();
    const eventStartTime = new Date(event.startTime);
    const isPast = eventStartTime < now;
    console.log(`   Событие прошедшее: ${isPast ? 'ДА' : 'НЕТ'}`);

    // Проверяем EventProfile
    let eventProfile = await prisma.eventProfile.findUnique({
      where: { eventId: event.id },
      include: {
        participants: true,
      },
    });

    if (!eventProfile && isPast) {
      console.log(`\n📝 EventProfile НЕ найден, но событие прошедшее - создаем профиль...`);
      
      // Создаем EventProfile с полными данными
      const participantIds = [event.organizerId, ...event.memberships.map(m => m.userId)];
      const uniqueParticipantIds = Array.from(new Set(participantIds));
      
      eventProfile = await prisma.eventProfile.create({
        data: {
          eventId: event.id,
          name: event.title,
          description: event.description || '',
          date: event.startTime.toISOString().split('T')[0],
          time: event.startTime.toISOString().slice(11, 16),
          location: event.location || '',
          avatar: event.originalMediaUrl || event.mediaUrl || null,
          participants: {
            create: uniqueParticipantIds.map(participantId => ({
              userId: participantId,
            })),
          },
        },
        include: {
          participants: true,
        },
      });
      
      console.log(`✅ EventProfile создан с ${eventProfile.participants.length} участниками`);
    } else if (eventProfile) {
      console.log(`\n📝 EventProfile найден:`);
      console.log(`   Участников в профиле: ${eventProfile.participants.length}`);
      
      // Получаем список всех ACCEPTED участников (включая организатора)
      const acceptedUserIds = [event.organizerId, ...event.memberships.map(m => m.userId)];
      const uniqueAcceptedUserIds = Array.from(new Set(acceptedUserIds));
      const profileUserIds = eventProfile.participants.map(p => p.userId);
      
      // Находим участников, которых нет в профиле
      const missingUserIds = uniqueAcceptedUserIds.filter(userId => !profileUserIds.includes(userId));
      
      if (missingUserIds.length > 0) {
        console.log(`\n⚠️  Найдено ${missingUserIds.length} участников, которых нет в EventProfile:`);
        missingUserIds.forEach(userId => {
          const membership = event.memberships.find(m => m.userId === userId);
          const userName = membership?.user?.name || membership?.user?.username || membership?.user?.email || 'Без имени';
          console.log(`   - ${userName} (${userId})`);
        });
        
        // Добавляем отсутствующих участников
        console.log(`\n🔧 Добавляем отсутствующих участников в EventProfile...`);
        for (const userId of missingUserIds) {
          await prisma.eventProfileParticipant.create({
            data: {
              eventProfileId: eventProfile.id,
              userId: userId,
            },
          });
          console.log(`   ✅ Добавлен участник: ${userId}`);
        }
        
        // Обновляем профиль
        eventProfile = await prisma.eventProfile.findUnique({
          where: { eventId: event.id },
          include: {
            participants: true,
          },
        });
        
        console.log(`\n✅ EventProfile обновлен. Теперь участников: ${eventProfile.participants.length}`);
      } else {
        console.log(`✅ Все участники уже есть в EventProfile`);
      }
      
      // Показываем всех участников
      console.log(`\n📋 Участники в EventProfile:`);
      for (const participant of eventProfile.participants) {
        // Проверяем, является ли участник организатором
        const isOrganizer = participant.userId === event.organizerId;
        let userName = 'Без имени';
        
        if (isOrganizer) {
          userName = event.organizer.name || event.organizer.username || event.organizer.email || 'Организатор';
        } else {
          const membership = event.memberships.find(m => m.userId === participant.userId);
          const user = membership?.user;
          userName = user?.name || user?.username || user?.email || 'Без имени';
        }
        
        console.log(`   ${eventProfile.participants.indexOf(participant) + 1}. ${userName} (${participant.userId})${isOrganizer ? ' [ОРГАНИЗАТОР]' : ''}`);
      }
    } else {
      console.log(`\n📝 EventProfile не создан, т.к. событие еще не завершилось`);
    }
    
    console.log(`\n✅ Проверка завершена!`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    if (error.code === 'P1001') {
      console.error('❌ Не удалось подключиться к базе данных. Проверьте DATABASE_URL.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixRamenEventProfile();

