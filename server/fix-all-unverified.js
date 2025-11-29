// Верифицировать всех пользователей с неверифицированным email
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAllUnverified() {
  try {
    console.log('\n=== ВЕРИФИКАЦИЯ ВСЕХ НЕ ВЕРИФИЦИРОВАННЫХ ===\n');
    
    // Находим всех неверифицированных
    const unverified = await prisma.user.findMany({
      where: { emailVerified: false },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    console.log(`Найдено неверифицированных: ${unverified.length}\n`);
    
    if (unverified.length > 0) {
      const result = await prisma.user.updateMany({
        where: { emailVerified: false },
        data: { emailVerified: true },
      });
      
      console.log(`✅ Верифицировано пользователей: ${result.count}\n`);
      
      unverified.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.username || 'нет username'})`);
      });
    } else {
      console.log('✅ Все пользователи уже верифицированы!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllUnverified();
