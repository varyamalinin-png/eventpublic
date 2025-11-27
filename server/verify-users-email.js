// Временно отключаем проверку emailVerified для всех пользователей
// Это позволит войти пользователям, которые не верифицировали email
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAllUsers() {
  try {
    const result = await prisma.user.updateMany({
      where: { emailVerified: false },
      data: { emailVerified: true },
    });
    console.log(`✅ Verified ${result.count} users`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyAllUsers();
