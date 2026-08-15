/**
 * Скрипт для удаления папок событий пользователя "egor"
 * 
 * Использование:
 * 
 * Для локальной базы данных:
 * node scripts/delete-egor-event-folders.js
 * 
 * Для продакшн базы данных (Yandex Cloud):
 * DATABASE_URL="postgresql://postgres:PASSWORD@c-xxxxx.rw.mdb.yandexcloud.net:6432/event_app?sslmode=require" node scripts/delete-egor-event-folders.js
 * 
 * Или установите DATABASE_URL в переменных окружения перед запуском
 */

const { PrismaClient } = require('@prisma/client');

// Используем DATABASE_URL из переменных окружения, если он установлен
const databaseUrl = process.env.DATABASE_URL;

const prisma = databaseUrl
  ? new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })
  : new PrismaClient();

async function deleteEgorEventFolders() {
  try {
    console.log('🔍 Ищем пользователя "egor"...\n');

    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: 'egor', mode: 'insensitive' } },
          { email: { contains: 'egor', mode: 'insensitive' } },
          { name: { contains: 'egor', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      console.log('❌ Пользователь "egor" не найден');
      console.log('\n📋 Показываем всех пользователей (первые 20):');
      const allUsers = await prisma.user.findMany({
        take: 20,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
        },
        orderBy: { createdAt: 'desc' }
      });
      
      allUsers.forEach(u => {
        console.log(`  - ${u.username} (${u.email}) - ${u.name || 'без имени'}`);
      });
      return;
    }

    console.log(`✅ Найден пользователь:`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || 'не указано'}`);
    console.log(`   ID: ${user.id}\n`);

    // Находим все папки событий пользователя
    const folders = await prisma.eventFolder.findMany({
      where: {
        ownerId: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            events: true,
          },
        },
      },
    });

    if (folders.length === 0) {
      console.log('✅ У пользователя нет папок событий');
      return;
    }

    console.log(`📁 Найдено папок событий: ${folders.length}\n`);
    folders.forEach((folder, index) => {
      console.log(`   ${index + 1}. "${folder.name}"`);
      console.log(`      ID: ${folder.id}`);
      console.log(`      Событий в папке: ${folder._count.events}`);
      console.log(`      Создана: ${folder.createdAt.toISOString()}`);
      if (folder.description) {
        console.log(`      Описание: ${folder.description}`);
      }
      console.log('');
    });

    // Подтверждение удаления
    console.log('⚠️  ВНИМАНИЕ: Будут удалены все папки событий пользователя!');
    console.log('   Связанные события НЕ будут удалены, только связи с папками.\n');

    // Удаляем все папки событий
    // EventFolderEvent записи удалятся автоматически из-за onDelete: Cascade
    const deleteResult = await prisma.eventFolder.deleteMany({
      where: {
        ownerId: user.id,
      },
    });

    console.log(`✅ Успешно удалено папок событий: ${deleteResult.count}`);
    console.log(`   Все связанные записи (EventFolderEvent) также удалены автоматически.\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    if (error.message) {
      console.error('   Сообщение:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteEgorEventFolders();
