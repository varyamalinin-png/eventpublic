import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingEventChats() {
  console.log('🔍 Проверяем события без чатов...');

  // Находим все события, у которых есть ACCEPTED участники (кроме организатора), но нет чата
  const eventsWithoutChats = await prisma.event.findMany({
    where: {
      chat: null, // Нет связанного чата
      memberships: {
        some: {
          status: 'ACCEPTED',
        },
      },
    },
    include: {
      organizer: {
        select: {
          id: true,
          name: true,
          username: true,
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
            },
          },
        },
      },
    },
  });

  console.log(`Найдено событий без чатов: ${eventsWithoutChats.length}`);

  for (const event of eventsWithoutChats) {
    // Исключаем организатора из списка участников
    const participants = event.memberships
      .filter(m => m.userId !== event.organizerId)
      .map(m => m.userId);

    // Если есть хотя бы один участник (кроме организатора), создаем чат
    if (participants.length > 0) {
      const participantIds = [event.organizerId, ...participants];
      
      console.log(`\n📝 Создаем чат для события "${event.title}" (${event.id})`);
      console.log(`   Организатор: ${event.organizer.name || event.organizer.username} (${event.organizerId})`);
      console.log(`   Участники: ${participants.length}`);
      participantIds.forEach(id => {
        const member = event.memberships.find(m => m.userId === id) || { user: event.organizer };
        console.log(`     - ${member.user.name || member.user.username} (${id})`);
      });

      try {
        // Создаем чат
        const chat = await prisma.chat.create({
          data: {
            type: 'EVENT',
            eventId: event.id,
            name: `${event.title} - ${new Date(event.startTime).toLocaleDateString()}`,
            participants: {
              create: participantIds.map(userId => ({
                userId: userId,
              })),
            },
          },
          include: {
            participants: {
              include: {
                user: true,
              },
            },
          },
        });

        console.log(`   ✅ Чат создан: ${chat.id}`);
      } catch (error: any) {
        console.error(`   ❌ Ошибка при создании чата:`, error.message);
      }
    } else {
      console.log(`\n⚠️  Событие "${event.title}" (${event.id}) не имеет участников (кроме организатора)`);
    }
  }

  // Проверяем конкретное событие "dyhhf"
  console.log('\n\n🔍 Проверяем событие "dyhhf"...');
  const dyhhfEvent = await prisma.event.findUnique({
    where: { id: 'dyhhf' },
    include: {
      organizer: {
        select: {
          id: true,
          name: true,
          username: true,
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
            },
          },
        },
      },
      chat: {
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (dyhhfEvent) {
    console.log(`Событие найдено: "${dyhhfEvent.title}"`);
    console.log(`Организатор: ${dyhhfEvent.organizer.name || dyhhfEvent.organizer.username} (${dyhhfEvent.organizerId})`);
    console.log(`Участников (ACCEPTED): ${dyhhfEvent.memberships.length}`);
    dyhhfEvent.memberships.forEach(m => {
      console.log(`  - ${m.user.name || m.user.username} (${m.userId})`);
    });
    
    if (dyhhfEvent.chat) {
      console.log(`Чат существует: ${dyhhfEvent.chat.id}`);
      console.log(`Участников в чате: ${dyhhfEvent.chat.participants.length}`);
      dyhhfEvent.chat.participants.forEach(p => {
        console.log(`  - ${p.user.name || p.user.username} (${p.userId})`);
      });
    } else {
      console.log('❌ Чат не существует');
      
      // Проверяем, есть ли участники (кроме организатора)
      const participants = dyhhfEvent.memberships
        .filter(m => m.userId !== dyhhfEvent.organizerId)
        .map(m => m.userId);

      if (participants.length > 0) {
        console.log(`Создаем чат для события "dyhhf"...`);
        const participantIds = [dyhhfEvent.organizerId, ...participants];
        
        try {
          const chat = await prisma.chat.create({
            data: {
              type: 'EVENT',
              eventId: dyhhfEvent.id,
              name: `${dyhhfEvent.title} - ${new Date(dyhhfEvent.startTime).toLocaleDateString()}`,
              participants: {
                create: participantIds.map(userId => ({
                  userId: userId,
                })),
              },
            },
          });
          console.log(`✅ Чат создан: ${chat.id}`);
        } catch (error: any) {
          console.error(`❌ Ошибка при создании чата:`, error.message);
        }
      } else {
        console.log('⚠️  Нет участников (кроме организатора) для создания чата');
      }
    }
  } else {
    console.log('❌ Событие "dyhhf" не найдено');
  }

  await prisma.$disconnect();
}

fixMissingEventChats()
  .catch((error) => {
    console.error('Ошибка:', error);
    process.exit(1);
  });

