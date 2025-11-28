// Скрипт для верификации email через Railway CLI
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyEmail(email) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    console.log(`✅ Email ${email} verified successfully!`);
    console.log(`User: ${user.username}, ID: ${user.id}`);
    return user;
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`❌ User with email ${email} not found`);
    } else {
      console.error(`❌ Error:`, error.message);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/verify-email.js <email>');
  console.log('Example: node scripts/verify-email.js user@example.com');
  process.exit(1);
}

verifyEmail(email).catch(() => process.exit(1));
