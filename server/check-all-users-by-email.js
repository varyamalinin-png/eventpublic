// Проверка всех пользователей с этим email
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const email = 'varya.malinina.2003@mail.ru';
    
    console.log('\n=== ВСЕ ПОЛЬЗОВАТЕЛИ С EMAIL ===\n');
    
    // Проверяем через Prisma
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email },
          { email: { contains: email.split('@')[0] } },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Найдено пользователей: ${users.length}\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username || 'нет'}`);
      console.log(`   emailVerified: ${user.emailVerified ? '✅ true' : '❌ false'}`);
      console.log(`   Создан: ${user.createdAt}`);
      console.log('');
    });

    // Проверяем конкретный ID из логов
    const logId = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';
    console.log(`\n=== ПРОВЕРКА ID ИЗ ЛОГОВ: ${logId} ===\n`);
    
    const logUser = await prisma.user.findUnique({
      where: { id: logId },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
      },
    });

    if (logUser) {
      console.log(`Найден пользователь:`);
      console.log(`  ID: ${logUser.id}`);
      console.log(`  Email: ${logUser.email}`);
      console.log(`  Username: ${logUser.username || 'нет'}`);
      console.log(`  emailVerified: ${logUser.emailVerified ? '✅ true' : '❌ false'}`);
      
      if (!logUser.emailVerified) {
        console.log(`\n⚠️ emailVerified = false! Нужно верифицировать.`);
        console.log(`\n=== ВЕРИФИЦИРУЮ ===\n`);
        
        const updated = await prisma.user.update({
          where: { id: logId },
          data: { emailVerified: true },
          select: {
            id: true,
            email: true,
            emailVerified: true,
          },
        });
        
        console.log(`✅ Обновлен:`);
        console.log(`  Email: ${updated.email}`);
        console.log(`  emailVerified: ${updated.emailVerified ? '✅ true' : '❌ false'}`);
      }
    } else {
      console.log(`❌ Пользователь с ID ${logId} не найден`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
