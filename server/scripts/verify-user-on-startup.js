// Скрипт для автоматической верификации пользователя при старте Railway
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyUserOnStartup() {
  try {
    const email = 'varya.malinina.2003@mail.ru';
    const railwayId = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';
    
    console.log('[VerifyUser] ============================================');
    console.log('[VerifyUser] Начало верификации пользователя');
    console.log('[VerifyUser] Email:', email);
    console.log('[VerifyUser] ID:', railwayId);
    console.log('[VerifyUser] ============================================');
    
    // Проверяем, есть ли неверифицированные пользователи
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email },
          { id: railwayId },
        ],
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });
    
    console.log(`[VerifyUser] Найдено неверифицированных пользователей: ${users.length}`);
    
    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`[VerifyUser] ${index + 1}. ${user.email} (ID: ${user.id}) - emailVerified: ${user.emailVerified}`);
      });
      
      const result = await prisma.user.updateMany({
        where: {
          OR: [
            { email },
            { id: railwayId },
          ],
          emailVerified: false,
        },
        data: {
          emailVerified: true,
        },
      });
      
      console.log(`[VerifyUser] ✅ Верифицировано пользователей: ${result.count}`);
      
      // Проверяем результат
      const verified = await prisma.user.findMany({
        where: {
          OR: [{ email }, { id: railwayId }],
        },
        select: {
          id: true,
          email: true,
          emailVerified: true,
        },
      });
      
      verified.forEach((user) => {
        console.log(`[VerifyUser] ✅ ${user.email} (ID: ${user.id}) - emailVerified: ${user.emailVerified}`);
      });
    } else {
      console.log('[VerifyUser] ✅ Все пользователи уже верифицированы');
    }
    
    console.log('[VerifyUser] ============================================');
    
  } catch (error) {
    console.error('[VerifyUser] ❌ Ошибка:', error.message);
    console.error('[VerifyUser] Stack:', error.stack);
    // Не останавливаем запуск сервера при ошибке
  } finally {
    await prisma.$disconnect();
  }
}

// Всегда выполняем при запуске (скрипт вызывается из start:railway)
verifyUserOnStartup()
  .then(() => {
    console.log('[VerifyUser] ✅ Скрипт завершен успешно');
  })
  .catch((error) => {
    console.error('[VerifyUser] ❌ Ошибка при выполнении (игнорируется):', error.message);
  });
