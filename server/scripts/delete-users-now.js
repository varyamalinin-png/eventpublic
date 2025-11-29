// СРОЧНОЕ УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllNow() {
  try {
    console.log('\n=== СРОЧНОЕ УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ===\n');
    
    const count = await prisma.user.count();
    console.log(`Всего пользователей: ${count}`);
    
    if (count === 0) {
      console.log('✅ База уже пустая\n');
      return;
    }
    
    // Показываем кого удаляем
    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true },
    });
    
    console.log('Пользователи для удаления:');
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email} (ID: ${u.id})`);
    });
    console.log('');
    
    // УДАЛЯЕМ ВСЕХ
    const result = await prisma.user.deleteMany({});
    console.log(`✅ УДАЛЕНО: ${result.count} пользователей\n`);
    
    // Проверка
    const remaining = await prisma.user.count();
    console.log(`Осталось пользователей: ${remaining}\n`);
    
    if (remaining === 0) {
      console.log('✅ БАЗА ОЧИЩЕНА!\n');
    }
    
  } catch (error) {
    console.error('❌ ОШИБКА:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllNow();
