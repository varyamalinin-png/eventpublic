import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция для проверки, является ли событие прошедшим
function isEventPast(startTime: Date, endTime: Date | null): boolean {
  const eventEndTime = endTime || startTime;
  return eventEndTime.getTime() < Date.now();
}

async function fixEventCounters() {
  console.log('🔍 Начинаем проверку и очистку счетчиков событий для всех пользователей...\n');

  try {
    // Получаем всех пользователей
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    console.log(`📊 Найдено пользователей: ${allUsers.length}\n`);

    let totalFixed = 0;
    let usersWithIssues = 0;

    for (const user of allUsers) {
      let userFixed = false;
      const issues: string[] = [];

      // 1. Проверяем события, где пользователь организатор
      const organizedEvents = await prisma.event.findMany({
        where: {
          organizerId: user.id,
        },
        include: {
          profile: {
            include: {
              participants: true,
            },
          },
        },
      });

      // Проверяем каждое событие, где пользователь организатор
      for (const event of organizedEvents) {
        // Проверяем, существует ли EventProfile для прошедших событий
        const isPast = isEventPast(event.startTime, event.endTime);
        
        if (isPast && !event.profile) {
          // Прошедшее событие без профиля - удаляем событие полностью
          // (так как organizerId обязательное поле и мы не можем его обнулить)
          issues.push(`  ❌ Прошедшее событие ${event.id} "${event.title}" без профиля - удаляем событие полностью`);
          await prisma.event.delete({
            where: { id: event.id },
          });
          userFixed = true;
        } else if (isPast && event.profile) {
          // Проверяем, есть ли пользователь в participants профиля
          const isParticipant = event.profile.participants.some(
            (p: any) => p.userId === user.id
          );
          
          if (!isParticipant) {
            // Пользователь не в списке участников - удаляем событие полностью
            issues.push(`  ❌ Пользователь не в participants прошедшего события ${event.id} "${event.title}" - удаляем событие полностью`);
            await prisma.event.delete({
              where: { id: event.id },
            });
            userFixed = true;
          }
        }
      }

      // 2. Проверяем memberships (участие в событиях)
      const memberships = await prisma.eventMembership.findMany({
        where: {
          userId: user.id,
          status: 'ACCEPTED',
        },
        include: {
          event: {
            include: {
              profile: {
                include: {
                  participants: {
                    select: {
                      userId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Проверяем каждое membership
      for (const membership of memberships) {
        const event = membership.event;
        
        if (!event) {
          // Событие не существует - удаляем membership
          issues.push(`  ❌ Membership ${membership.id} ссылается на несуществующее событие - удаляем`);
          await prisma.eventMembership.delete({
            where: { id: membership.id },
          });
          userFixed = true;
          continue;
        }

        const isPast = isEventPast(event.startTime, event.endTime);

        if (isPast) {
          // Для прошедших событий проверяем EventProfile
          if (!event.profile) {
            // Прошедшее событие без профиля - удаляем membership
            issues.push(`  ❌ Прошедшее событие ${event.id} "${event.title}" без профиля - удаляем membership ${membership.id}`);
            await prisma.eventMembership.delete({
              where: { id: membership.id },
            });
            userFixed = true;
          } else {
            // Проверяем, есть ли пользователь в participants профиля
            const isParticipant = event.profile.participants.some(
              (p: any) => p.userId === user.id
            );
            
            if (!isParticipant) {
              // Пользователь не в списке участников - удаляем membership
              issues.push(`  ❌ Пользователь не в participants прошедшего события ${event.id} "${event.title}" - удаляем membership ${membership.id}`);
              await prisma.eventMembership.delete({
                where: { id: membership.id },
              });
              userFixed = true;
            }
          }
        } else {
          // Для будущих событий проверяем, что событие не удалено
          // (если событие существует, membership валиден)
        }
      }

      if (userFixed) {
        usersWithIssues++;
        totalFixed += issues.length;
        console.log(`👤 Пользователь: ${user.username || user.name || user.email} (${user.id})`);
        issues.forEach(issue => console.log(issue));
        console.log('');
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Проверка завершена!`);
    console.log(`📊 Всего пользователей проверено: ${allUsers.length}`);
    console.log(`⚠️  Пользователей с проблемами: ${usersWithIssues}`);
    console.log(`🔧 Всего исправлений: ${totalFixed}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Ошибка при проверке счетчиков:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
fixEventCounters()
  .then(() => {
    console.log('✅ Скрипт успешно завершен');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });

