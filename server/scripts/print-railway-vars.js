/**
 * Вывод всех необходимых переменных для Railway
 * Эти значения нужно скопировать и установить через Railway Dashboard
 */

const { execSync } = require('child_process');

console.log('📋 Переменные окружения для Railway\n');
console.log('Скопируйте следующие переменные и установите их через Railway Dashboard:');
console.log('https://railway.app → проект → сервис eventpublic → Variables\n');

// Получаем IAM токен
let iamToken;
try {
  const output = execSync('node scripts/get-yandex-iam-token.js', { 
    encoding: 'utf-8',
    cwd: __dirname + '/..'
  });
  const match = output.match(/YANDEX_IAM_TOKEN=(.+)/);
  if (match) {
    iamToken = match[1].trim();
  }
} catch (error) {
  console.error('Ошибка получения токена:', error.message);
  process.exit(1);
}

console.log('='.repeat(80));
console.log('YANDEX_IAM_TOKEN');
console.log('='.repeat(80));
console.log(iamToken);
console.log('\n');

console.log('='.repeat(80));
console.log('YANDEX_CLOUD_FROM_EMAIL');
console.log('='.repeat(80));
console.log('noreply@iventapp.ru');
console.log('\n');

console.log('='.repeat(80));
console.log('YANDEX_CLOUD_API_ENDPOINT');
console.log('='.repeat(80));
console.log('https://mail-api.cloud.yandex.net');
console.log('\n');

console.log('='.repeat(80));
console.log('⚠️  ВАЖНО:');
console.log('='.repeat(80));
console.log('1. Скопируйте эти значения');
console.log('2. Перейдите на https://railway.app');
console.log('3. Выберите проект → сервис eventpublic → Variables');
console.log('4. Добавьте каждую переменную через + New Variable');
console.log('5. Перезапустите сервис после установки всех переменных');
console.log('6. IAM токен действителен 12 часов - обновите его завтра');

