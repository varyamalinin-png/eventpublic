// Скрипт для выполнения SQL на Railway через API или переменные окружения
// Этот скрипт будет выполняться на Railway сервере

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function executeRailwaySQL() {
  try {
    console.log('\n=== ВЫПОЛНЕНИЕ SQL НА RAILWAY ===\n');
    console.log('Подключение к базе данных...\n');
    
    // Проверяем, к какой базе подключены
    const result = await prisma.$queryRaw`SELECT current_database() as db_name`;
    console.log(`Подключено к базе: ${result[0].db_name}\n`);
    
    const email = 'varya.malinina.2003@mail.ru';
    const railwayId = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';
    
    // Выполняем UPDATE через Prisma
    console.log('Выполняю UPDATE запрос...\n');
    
    const updateResult = await prisma.$executeRaw`
      UPDATE "User" 
      SET "emailVerified" = true 
      WHERE email = ${email} OR id = ${railwayId}
    `;
    
    console.log(`✅ Обновлено записей: ${updateResult}\n`);
    
    // Проверяем результат
    const users = await prisma.$queryRaw`
      SELECT id, email, username, "emailVerified"
      FROM "User"
      WHERE email = ${email} OR id = ${railwayId}
    `;
    
    console.log('Результат:\n');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username || 'нет'}`);
      console.log(`   emailVerified: ${user.emailVerified ? '✅ true' : '❌ false'}`);
      console.log('');
    });
    
    console.log('✅ SQL ЗАПРОС ВЫПОЛНЕН!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

executeRailwaySQL();
