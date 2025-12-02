const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    const migrationPath = path.join(__dirname, 'prisma/migrations/20250119190000_add_recurring_events_and_tags/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Разделяем SQL на отдельные команды
    const commands = sql.split(';').filter(cmd => cmd.trim().length > 0);
    
    for (const command of commands) {
      const trimmed = command.trim();
      if (trimmed) {
        try {
          await prisma.$executeRawUnsafe(trimmed);
          console.log('✓ Applied:', trimmed.substring(0, 50) + '...');
        } catch (error) {
          // Игнорируем ошибки "already exists" и подобные
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('⚠ Skipped (already exists):', trimmed.substring(0, 50) + '...');
          } else {
            console.error('✗ Error:', error.message);
            console.error('Command:', trimmed.substring(0, 100));
          }
        }
      }
    }
    
    console.log('\n✅ Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

