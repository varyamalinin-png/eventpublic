/**
 * Скрипт для проверки username и name пользователей в продакшн базе данных
 * 
 * Использование:
 * DATABASE_URL="postgresql://user:password@host:port/database" node scripts/check-users-usernames.js
 * 
 * Или установите DATABASE_URL в переменных окружения перед запуском
 */

const { PrismaClient } = require('@prisma/client');

// Используем DATABASE_URL из переменных окружения, если он установлен
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не установлен!');
  console.error('Установите DATABASE_URL в переменных окружения или передайте как аргумент:');
  console.error('DATABASE_URL="postgresql://..." node scripts/check-users-usernames.js');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function checkUsersUsernames() {
  try {
    console.log(`\n🔍 Проверка username и name пользователей\n`);
    console.log(`📡 Подключение к базе данных...\n`);

    // Сначала выведем всех пользователей для понимания структуры
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Список всех пользователей`);
    console.log(`${'='.repeat(60)}\n`);

    const allUsersList = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    console.log(`Всего пользователей в базе: ${allUsersList.length}\n`);
    allUsersList.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Username: ${user.username || 'NULL'}`);
      console.log(`   Name: ${user.name || 'NULL'}`);
      console.log(`   Email: ${user.email || 'NULL'}`);
      console.log('');
    });

    // Ищем пользователей nastya, varya и egor
    const usernamesToCheck = ['nastya', 'varya', 'egor'];
    
    for (const searchTerm of usernamesToCheck) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`👤 Поиск пользователя: ${searchTerm}`);
      console.log(`${'='.repeat(60)}\n`);

      // Находим пользователя по username, email или name
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { name: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (users.length === 0) {
        console.log(`❌ Пользователь с "${searchTerm}" не найден`);
        continue;
      }

      for (const user of users) {

        console.log(`✅ Пользователь найден:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username || 'NULL'}`);
        console.log(`   Name: ${user.name || 'NULL'}`);
        console.log(`   Email: ${user.email || 'NULL'}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   Updated: ${user.updatedAt}`);

        // Проверяем, есть ли проблемы с данными
        const hasUsername = user.username && user.username.trim() !== '' && user.username !== 'user';
        const hasName = user.name && user.name.trim() !== '' && user.name !== 'Пользователь';

        if (!hasUsername || !hasName) {
          console.log(`\n⚠️  ПРОБЛЕМА: У пользователя отсутствуют или некорректные данные:`);
          if (!hasUsername) {
            console.log(`   - Username: ${user.username || 'NULL'} (должен быть установлен и не равен "user")`);
          }
          if (!hasName) {
            console.log(`   - Name: ${user.name || 'NULL'} (должен быть установлен и не равен "Пользователь")`);
          }
        } else {
          console.log(`\n✅ Данные пользователя корректны`);
        }
      }
    }

    // Также проверим всех пользователей с username = "user" или name = "Пользователь"
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Поиск пользователей с проблемными данными`);
    console.log(`${'='.repeat(60)}\n`);

    // Ищем пользователей с username = "user" или name = "Пользователь"
    // Для nullable полей используем отдельные запросы
    const usersWithUserUsername = await prisma.user.findMany({
      where: { username: 'user' },
      select: { id: true, username: true, name: true, email: true },
    });
    
    const usersWithUserName = await prisma.user.findMany({
      where: { name: 'Пользователь' },
      select: { id: true, username: true, name: true, email: true },
    });
    
    // Объединяем результаты, убирая дубликаты
    const problematicUsersMap = new Map();
    [...usersWithUserUsername, ...usersWithUserName].forEach(user => {
      problematicUsersMap.set(user.id, user);
    });
    const problematicUsers = Array.from(problematicUsersMap.values());

    if (problematicUsers.length > 0) {
      console.log(`⚠️  Найдено ${problematicUsers.length} пользователей с проблемными данными:\n`);
      problematicUsers.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}`);
        console.log(`   Username: ${user.username || 'NULL'}`);
        console.log(`   Name: ${user.name || 'NULL'}`);
        console.log(`   Email: ${user.email || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log(`✅ Пользователей с проблемными данными не найдено`);
    }

    // Проверим всех пользователей для статистики
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Статистика по всем пользователям`);
    console.log(`${'='.repeat(60)}\n`);

    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    const usersWithUsername = allUsers.filter(u => u.username && u.username !== 'user');
    const usersWithName = allUsers.filter(u => u.name && u.name !== 'Пользователь');
    const usersWithBoth = allUsers.filter(u => 
      u.username && u.username !== 'user' && 
      u.name && u.name !== 'Пользователь'
    );

    console.log(`Всего пользователей: ${allUsers.length}`);
    console.log(`С корректным username: ${usersWithUsername.length}`);
    console.log(`С корректным name: ${usersWithName.length}`);
    console.log(`С корректными username И name: ${usersWithBoth.length}`);
    console.log(`С проблемными данными: ${allUsers.length - usersWithBoth.length}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    if (error.code === 'P1001') {
      console.error('❌ Не удалось подключиться к базе данных. Проверьте DATABASE_URL.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkUsersUsernames();

