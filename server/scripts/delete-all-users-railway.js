// Скрипт для удаления всех пользователей на Railway
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllUsers() {
  try {
    console.log('\n=== УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ===\n');
    
    const count = await prisma.user.count();
    console.log(`Всего пользователей: ${count}`);
    
    if (count === 0) {
      console.log('✅ База уже пустая');
      return;
    }
    
    const result = await prisma.user.deleteMany({});
    console.log(`✅ Удалено: ${result.count} пользователей`);
    
    const remaining = await prisma.user.count();
    console.log(`Осталось: ${remaining} пользователей\n`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllUsers();
