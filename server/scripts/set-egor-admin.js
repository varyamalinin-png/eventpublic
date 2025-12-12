const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setEgorAdmin() {
  try {
    console.log('🔍 Ищем пользователя egor...');
    
    // Ищем пользователя по username
    const user = await prisma.user.findUnique({
      where: { username: 'egor' }
    });
    
    if (!user) {
      console.error('❌ Пользователь с username "egor" не найден');
      console.log('💡 Попробуем найти по email...');
      
      // Попробуем найти по email
      const userByEmail = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { contains: 'egor', mode: 'insensitive' } },
            { name: { contains: 'egor', mode: 'insensitive' } }
          ]
        }
      });
      
      if (!userByEmail) {
        console.error('❌ Пользователь egor не найден ни по username, ни по email/name');
        return;
      }
      
      console.log(`✅ Найден пользователь: ${userByEmail.username} (${userByEmail.email})`);
      
      // Обновляем роль
      const updated = await prisma.user.update({
        where: { id: userByEmail.id },
        data: { role: 'ADMIN' }
      });
      
      console.log(`✅ Роль пользователя ${updated.username} обновлена на ADMIN`);
      console.log(`   ID: ${updated.id}`);
      console.log(`   Email: ${updated.email}`);
      console.log(`   Роль: ${updated.role}`);
      return;
    }
    
    console.log(`✅ Найден пользователь: ${user.username} (${user.email})`);
    console.log(`   Текущая роль: ${user.role}`);
    
    // Обновляем роль
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' }
    });
    
    console.log(`✅ Роль пользователя ${updated.username} обновлена на ADMIN`);
    console.log(`   ID: ${updated.id}`);
    console.log(`   Email: ${updated.email}`);
    console.log(`   Роль: ${updated.role}`);
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении роли:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setEgorAdmin();

