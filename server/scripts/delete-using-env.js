// Удаление пользователей используя DATABASE_URL из окружения Railway
const { PrismaClient } = require('@prisma/client');

// Prisma автоматически использует DATABASE_URL из process.env
const prisma = new PrismaClient();

async function deleteAll() {
  try {
    console.log('\n=== УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ===\n');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'настроен' : 'НЕ НАЙДЕН');
    
    const count = await prisma.user.count();
    console.log(`Всего пользователей: ${count}`);
    
    if (count === 0) {
      console.log('✅ База уже пустая');
      return;
    }
    
    const result = await prisma.user.deleteMany({});
    console.log(`✅ Удалено: ${result.count} пользователей`);
    
    const remaining = await prisma.user.count();
    console.log(`Осталось: ${remaining} пользователей`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAll();
