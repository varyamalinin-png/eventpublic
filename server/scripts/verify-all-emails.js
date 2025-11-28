// Скрипт для верификации всех email без верификации
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAllEmails() {
  try {
    const result = await prisma.user.updateMany({
      where: { emailVerified: false },
      data: { emailVerified: true },
    });
    console.log(`✅ Verified ${result.count} email(s) successfully!`);
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyAllEmails().catch(() => process.exit(1));
