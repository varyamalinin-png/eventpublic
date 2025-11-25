const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    const sqlPath = path.join(__dirname, 'apply-notification-types.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Applying notification types migration...');
    await prisma.$executeRawUnsafe(sql);
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

