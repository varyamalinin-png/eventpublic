// Список верифицированных логинов для входа
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function showVerifiedLogins() {
  try {
    const verifiedUsers = await prisma.user.findMany({
      where: { emailVerified: true },
      select: {
        email: true,
        username: true,
        id: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n✅ ВЕРИФИЦИРОВАННЫЕ ЛОГИНЫ ДЛЯ ВХОДА:\n');
    console.log('='.repeat(60));
    
    if (verifiedUsers.length === 0) {
      console.log('❌ Нет верифицированных пользователей\n');
    } else {
      verifiedUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ЛОГИН (Email): ${user.email}`);
        console.log(`   Username: ${user.username || 'нет'}`);
        console.log(`   ID: ${user.id}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\nВсего верифицированных: ${verifiedUsers.length}`);
    console.log('\n💡 Для входа используйте Email в качестве логина\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

showVerifiedLogins();
