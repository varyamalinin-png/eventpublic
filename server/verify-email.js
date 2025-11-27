// Скрипт для верификации email пользователя
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyUserEmail(email) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    console.log(`✅ Email verified for user: ${user.id}, email: ${user.email}`);
    return user;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || 'varya.malinina.2003@mail.ru';
verifyUserEmail(email);
