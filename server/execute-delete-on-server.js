// Скрипт для выполнения на Railway сервере
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAll() {
  try {
    console.log('Удаляю всех пользователей...');
    const result = await prisma.user.deleteMany({});
    console.log(`✅ Удалено: ${result.count} пользователей`);
    const remaining = await prisma.user.count();
    console.log(`Осталось: ${remaining} пользователей`);
  } catch (error) {
    console.error('Ошибка:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAll();
