/**
 * Скрипт для исправления username и name пользователей в продакшн базе данных
 * 
 * Использование:
 * DATABASE_URL="postgresql://user:password@host:port/database" node scripts/fix-users-usernames.js
 * 
 * Или установите DATABASE_URL в переменных окружения перед запуском
 */

const { PrismaClient } = require('@prisma/client');

// Используем DATABASE_URL из переменных окружения, если он установлен
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не установлен!');
  console.error('Установите DATABASE_URL в переменных окружения или передайте как аргумент:');
  console.error('DATABASE_URL="postgresql://..." node scripts/fix-users-usernames.js');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function fixUsersUsernames() {
  try {
    console.log(`\n🔧 Исправление username и name пользователей\n`);
    console.log(`📡 Подключение к базе данных...\n`);

    // Находим всех пользователей
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    console.log(`Всего пользователей в базе: ${allUsers.length}\n`);

    let fixedCount = 0;

    for (const user of allUsers) {
      let needsUpdate = false;
      const updates = {};

      // Проверяем username
      if (!user.username || user.username.trim() === '' || user.username === 'user') {
        // Пытаемся извлечь username из email
        if (user.email) {
          const emailUsername = user.email.split('@')[0];
          if (emailUsername && emailUsername.trim() !== '') {
            updates.username = emailUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            needsUpdate = true;
            console.log(`  🔧 ${user.email}: username будет установлен в "${updates.username}" (из email)`);
          }
        }
        
        // Если не удалось извлечь из email, используем name
        if (!updates.username && user.name && user.name.trim() !== '' && user.name !== 'Пользователь') {
          updates.username = user.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '_');
          needsUpdate = true;
          console.log(`  🔧 ${user.email}: username будет установлен в "${updates.username}" (из name)`);
        }
      }

      // Проверяем name
      if (!user.name || user.name.trim() === '' || user.name === 'Пользователь') {
        // Пытаемся использовать username
        if (user.username && user.username.trim() !== '' && user.username !== 'user') {
          updates.name = user.username.charAt(0).toUpperCase() + user.username.slice(1);
          needsUpdate = true;
          console.log(`  🔧 ${user.email}: name будет установлен в "${updates.name}" (из username)`);
        }
        
        // Если не удалось использовать username, используем email
        if (!updates.name && user.email) {
          const emailUsername = user.email.split('@')[0];
          if (emailUsername && emailUsername.trim() !== '') {
            updates.name = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
            needsUpdate = true;
            console.log(`  🔧 ${user.email}: name будет установлен в "${updates.name}" (из email)`);
          }
        }
      }

      if (needsUpdate) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
          fixedCount++;
          console.log(`  ✅ ${user.email}: обновлено`);
        } catch (error) {
          console.error(`  ❌ ${user.email}: ошибка при обновлении - ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Исправлено пользователей: ${fixedCount} из ${allUsers.length}`);

    // Проверяем результат
    console.log(`\n📊 Проверка результата:\n`);
    const usersAfterFix = await prisma.user.findMany({
      where: {
        OR: [
          { username: 'user' },
          { name: 'Пользователь' },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    if (usersAfterFix.length > 0) {
      console.log(`⚠️  Осталось пользователей с проблемными данными: ${usersAfterFix.length}`);
      usersAfterFix.forEach((user) => {
        console.log(`  - ${user.email}: username="${user.username}", name="${user.name}"`);
      });
    } else {
      console.log(`✅ Все пользователи имеют корректные данные`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    if (error.code === 'P1001') {
      console.error('❌ Не удалось подключиться к базе данных. Проверьте DATABASE_URL.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixUsersUsernames();

