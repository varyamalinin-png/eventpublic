// Автоматическая настройка: удаление пользователей
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function autoSetup() {
  try {
    console.log('\n=== АВТОМАТИЧЕСКАЯ НАСТРОЙКА ===\n');
    
    // 1. Удаляем всех пользователей
    console.log('1. Удаляю всех пользователей...');
    const count = await prisma.user.count();
    console.log(`   Всего пользователей: ${count}`);
    
    if (count > 0) {
      const result = await prisma.user.deleteMany({});
      console.log(`   ✅ Удалено: ${result.count}`);
    } else {
      console.log('   ✅ База уже пустая');
    }
    
    const remaining = await prisma.user.count();
    console.log(`   Осталось: ${remaining} пользователей\n`);
    
    console.log('2. Проверяю конфигурацию SMTP...');
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    
    console.log(`   SMTP_HOST: ${smtpHost || 'НЕ НАСТРОЕН'}`);
    console.log(`   SMTP_PORT: ${smtpPort || 'НЕ НАСТРОЕН'}`);
    console.log(`   SMTP_USER: ${smtpUser ? 'НАСТРОЕН' : 'НЕ НАСТРОЕН'}`);
    console.log(`   SMTP_PASSWORD: ${smtpPassword ? 'НАСТРОЕН' : 'НЕ НАСТРОЕН'}\n`);
    
    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      console.log('   ✅ SMTP настроен правильно');
    } else {
      console.log('   ⚠️ SMTP не настроен. Настройте переменные окружения на Yandex Cloud VM.');
    }
    
    console.log('\n✅ НАСТРОЙКА ЗАВЕРШЕНА\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

autoSetup();
