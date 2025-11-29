// Верификация всех пользователей с email
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAllByEmail() {
  try {
    const email = 'varya.malinina.2003@mail.ru';
    
    console.log('\n=== ВЕРИФИКАЦИЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ С EMAIL ===\n');
    
    // Находим всех пользователей (на случай дубликатов)
    const users = await prisma.user.findMany({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
      },
    });

    console.log(`Найдено пользователей: ${users.length}\n`);
    
    for (const user of users) {
      console.log(`Пользователь: ${user.email} (ID: ${user.id})`);
      console.log(`  Текущий статус: emailVerified = ${user.emailVerified}`);
      
      if (!user.emailVerified) {
        console.log(`  ⚠️ Не верифицирован! Верифицирую...`);
        
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
          select: {
            id: true,
            email: true,
            emailVerified: true,
          },
        });
        
        console.log(`  ✅ Обновлен: emailVerified = ${updated.emailVerified}`);
      } else {
        console.log(`  ✅ Уже верифицирован`);
      }
      console.log('');
    }
    
    // Также проверим ID из логов Railway
    const railwayId = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';
    console.log(`\n=== ПРОВЕРКА ID ИЗ RAILWAY ЛОГОВ ===\n`);
    console.log(`Ищу пользователя с ID: ${railwayId}`);
    
    const railwayUser = await prisma.user.findUnique({
      where: { id: railwayId },
    });
    
    if (railwayUser) {
      console.log(`✅ Найден: ${railwayUser.email}`);
      if (!railwayUser.emailVerified) {
        console.log(`  ⚠️ Не верифицирован! Верифицирую...`);
        await prisma.user.update({
          where: { id: railwayId },
          data: { emailVerified: true },
        });
        console.log(`  ✅ Верифицирован`);
      }
    } else {
      console.log(`❌ Пользователь с ID ${railwayId} не найден в базе`);
      console.log(`   Это может означать, что Railway использует другую базу данных`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAllByEmail();
