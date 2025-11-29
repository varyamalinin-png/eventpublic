// Скрипт для удаления пользователей И настройки (будет выполнен на Railway)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAndConfigure() {
  try {
    console.log('\n=== УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЕЙ ===\n');
    
    const count = await prisma.user.count();
    console.log(`Всего пользователей: ${count}`);
    
    if (count > 0) {
      const result = await prisma.user.deleteMany({});
      console.log(`✅ Удалено: ${result.count} пользователей`);
    } else {
      console.log('✅ База уже пустая');
    }
    
    const remaining = await prisma.user.count();
    console.log(`Осталось: ${remaining} пользователей\n`);
    
    console.log('\n=== ПРОВЕРКА SMTP ===\n');
    console.log(`SMTP_HOST: ${process.env.SMTP_HOST || 'НЕ НАСТРОЕН'}`);
    console.log(`SMTP_PORT: ${process.env.SMTP_PORT || 'НЕ НАСТРОЕН'}`);
    console.log(`SMTP_USER: ${process.env.SMTP_USER ? 'НАСТРОЕН' : 'НЕ НАСТРОЕН'}`);
    console.log(`SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? 'НАСТРОЕН' : 'НЕ НАСТРОЕН'}\n`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAndConfigure();
