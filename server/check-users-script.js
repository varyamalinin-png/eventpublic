// Скрипт для проверки верифицированных пользователей
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVerifiedUsers() {
  try {
    console.log('\n=== ВСЕ ПОЛЬЗОВАТЕЛИ ===\n');
    
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: {
        emailVerified: 'desc',
      },
    });

    console.log(`Всего пользователей: ${allUsers.length}\n`);
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.username || 'нет username'})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Верифицирован: ${user.emailVerified ? '✅ ДА' : '❌ НЕТ'}`);
      console.log(`   Создан: ${user.createdAt}`);
      console.log('');
    });

    console.log('\n=== ВЕРИФИЦИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ ===\n');
    
    const verifiedUsers = allUsers.filter(u => u.emailVerified);
    
    if (verifiedUsers.length === 0) {
      console.log('❌ Нет верифицированных пользователей\n');
    } else {
      console.log(`Всего верифицированных: ${verifiedUsers.length}\n`);
      verifiedUsers.forEach((user, index) => {
        console.log(`${index + 1}. Email/Login: ${user.email}`);
        console.log(`   Username: ${user.username || 'нет'}`);
        console.log(`   ID: ${user.id}`);
        console.log('');
      });
    }

    console.log('\n=== НЕ ВЕРИФИЦИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ ===\n');
    
    const unverifiedUsers = allUsers.filter(u => !u.emailVerified);
    
    if (unverifiedUsers.length === 0) {
      console.log('✅ Все пользователи верифицированы\n');
    } else {
      console.log(`Всего не верифицированных: ${unverifiedUsers.length}\n`);
      unverifiedUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.username || 'нет username'})`);
        console.log(`   ID: ${user.id}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVerifiedUsers();
