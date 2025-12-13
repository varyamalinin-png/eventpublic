// Скрипт для исправления failed migration
console.log('========================================');
console.log('Исправление failed migration Prisma');
console.log('========================================\n');

console.log('Для исправления выполните на Yandex Cloud VM:');
console.log('npx prisma migrate resolve --rolled-back 20251110_auth_oauth_email\n');
console.log('Или через PostgreSQL на Yandex Cloud VM:');
console.log('DELETE FROM "_prisma_migrations" WHERE migration_name = \'20251110_auth_oauth_email\' AND finished_at IS NULL;\n');
console.log('========================================');
