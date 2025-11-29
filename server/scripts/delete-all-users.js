// Скрипт для удаления всех пользователей из базы данных
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllUsers() {
  try {
    console.log('\n=== УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ===\n');
    
    // Сначала проверим, сколько пользователей
    const count = await prisma.user.count();
    console.log(`Всего пользователей в базе: ${count}\n`);
    
    if (count === 0) {
      console.log('✅ База данных уже пустая\n');
      return;
    }
    
    // Показываем список пользователей перед удалением
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
      },
    });
    
    console.log('Пользователи для удаления:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.username || 'нет username'}) - ID: ${user.id}`);
    });
    console.log('');
    
    // Удаляем всех пользователей
    // Используем deleteMany для удаления всех записей
    const result = await prisma.user.deleteMany({});
    
    console.log(`✅ Удалено пользователей: ${result.count}\n`);
    
    // Проверяем результат
    const remaining = await prisma.user.count();
    console.log(`Осталось пользователей: ${remaining}\n`);
    
    if (remaining === 0) {
      console.log('✅ База данных очищена! Теперь можно регистрироваться заново.\n');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllUsers();
