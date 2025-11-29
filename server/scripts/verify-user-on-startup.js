// Скрипт для автоматической верификации пользователя при старте Railway
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyUserOnStartup() {
  try {
    const email = 'varya.malinina.2003@mail.ru';
    const railwayId = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';
    
    console.log('[VerifyUser] Проверяю пользователей для верификации...');
    
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
      },
    });
    
    if (users.length > 0) {
      console.log(`[VerifyUser] Найдено неверифицированных пользователей: ${users.length}`);
      
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
    } else {
      console.log('[VerifyUser] ✅ Все пользователи уже верифицированы');
    }
    
  } catch (error) {
    console.error('[VerifyUser] ⚠️ Ошибка при верификации (не критично):', error.message);
    // Не останавливаем запуск сервера при ошибке
  } finally {
    await prisma.$disconnect();
  }
}

// Выполняем только если это запуск на Railway (не локально)
if (process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway')) {
  verifyUserOnStartup().catch(() => {
    // Игнорируем ошибки - не критично для запуска сервера
  });
}
