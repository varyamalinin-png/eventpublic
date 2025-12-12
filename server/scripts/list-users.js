const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listUsers() {
  try {
    console.log(`\n👥 Список пользователей:\n`);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    console.log(`Всего пользователей: ${users.length}\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.name || 'без имени'}) - ${user.email}`);
    });

    // Ищем пользователя с похожим username
    console.log(`\n🔍 Поиск пользователей с "alan" в username:\n`);
    const alanUsers = await prisma.user.findMany({
      where: {
        username: {
          contains: 'alan',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    if (alanUsers.length > 0) {
      console.log(`Найдено пользователей: ${alanUsers.length}`);
      alanUsers.forEach((user) => {
        console.log(`  - ${user.username} (ID: ${user.id})`);
      });
    } else {
      console.log(`Пользователей с "alan" в username не найдено`);
    }

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();

