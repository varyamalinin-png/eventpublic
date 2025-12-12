const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findEgor() {
  try {
    console.log('🔍 Ищем пользователей с "egor" в username, email или name...');
    
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: 'egor', mode: 'insensitive' } },
          { email: { contains: 'egor', mode: 'insensitive' } },
          { name: { contains: 'egor', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true
      }
    });
    
    if (users.length === 0) {
      console.log('❌ Пользователи с "egor" не найдены');
      console.log('\n📋 Показываем всех пользователей (первые 20):');
      const allUsers = await prisma.user.findMany({
        take: 20,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      allUsers.forEach(u => {
        console.log(`  - ${u.username} (${u.email}) - ${u.name || 'без имени'} - роль: ${u.role}`);
      });
      return;
    }
    
    console.log(`✅ Найдено ${users.length} пользователь(ей):\n`);
    users.forEach(u => {
      console.log(`  - Username: ${u.username}`);
      console.log(`    Email: ${u.email}`);
      console.log(`    Name: ${u.name || 'не указано'}`);
      console.log(`    Role: ${u.role}`);
      console.log(`    ID: ${u.id}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findEgor();

