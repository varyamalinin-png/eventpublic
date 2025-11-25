const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Добавление полей для блокировки пользователей...');
  
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✅ Поле isBlocked добавлено');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
    `);
    console.log('✅ Поле blockedAt добавлено');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blockedById" TEXT;
    `);
    console.log('✅ Поле blockedById добавлено');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blockReason" TEXT;
    `);
    console.log('✅ Поле blockReason добавлено');

    console.log('✅ Все поля успешно добавлены!');
  } catch (error) {
    console.error('❌ Ошибка при добавлении полей:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

