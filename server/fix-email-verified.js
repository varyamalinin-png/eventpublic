// Скрипт для проверки и исправления emailVerified
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAndFixEmailVerified() {
  try {
    const email = 'varya.malinina.2003@mail.ru';
    
    console.log(`\n=== ПРОВЕРКА И ИСПРАВЛЕНИЕ emailVerified ===\n`);
    
    // Читаем пользователя
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });
    
    if (!user) {
      console.log(`❌ Пользователь не найден: ${email}`);
      return;
    }
    
    console.log(`Найден пользователь:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  emailVerified (текущее значение): ${user.emailVerified}`);
    console.log(`  Тип: ${typeof user.emailVerified}`);
    console.log(`  emailVerified === true: ${user.emailVerified === true}`);
    console.log(`  emailVerified === false: ${user.emailVerified === false}`);
    
    // Принудительно устанавливаем true
    console.log(`\n=== УСТАНОВКА emailVerified = true ===\n`);
    
    const updated = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });
    
    console.log(`✅ Обновлен:`);
    console.log(`  Email: ${updated.email}`);
    console.log(`  emailVerified (новое значение): ${updated.emailVerified}`);
    console.log(`  Тип: ${typeof updated.emailVerified}`);
    console.log(`  emailVerified === true: ${updated.emailVerified === true}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixEmailVerified();
