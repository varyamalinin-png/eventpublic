/**
 * Финальный скрипт для автоматической настройки всех переменных
 * Использует все доступные методы
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 АВТОМАТИЧЕСКАЯ НАСТРОЙКА YANDEX CLOUD EMAIL API\n');
console.log('='.repeat(80));

// 1. Получаем IAM токен
console.log('\n1️⃣ Получение IAM токена Yandex...');
let iamToken;
try {
  const output = execSync('node scripts/get-yandex-iam-token.js', { 
    encoding: 'utf-8',
    cwd: __dirname + '/..'
  });
  const match = output.match(/YANDEX_IAM_TOKEN=(.+)/);
  if (match) {
    iamToken = match[1].trim();
    console.log('✅ IAM токен получен');
  } else {
    throw new Error('Не удалось извлечь токен');
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

// 2. Проверяем подключение к Railway
console.log('\n2️⃣ Проверка подключения к Railway...');
try {
  const railwayStatus = execSync('npx -y @railway/cli status', { 
    encoding: 'utf-8',
    cwd: __dirname + '/..',
    stdio: 'pipe'
  });
  console.log('✅ Railway подключен');
  console.log(railwayStatus.split('\n').slice(0, 3).join('\n'));
} catch (error) {
  console.log('⚠️ Railway CLI требует интерактивной настройки');
}

// 3. Выводим все значения для копирования
console.log('\n3️⃣ Значения для установки в Railway:\n');
console.log('='.repeat(80));
console.log('\n📋 Скопируйте и установите эти переменные через Railway Dashboard:');
console.log('   https://railway.app → проект → сервис eventpublic → Variables\n');

const variables = {
  'YANDEX_IAM_TOKEN': iamToken,
  'YANDEX_CLOUD_FROM_EMAIL': 'noreply@iventapp.ru',
  'YANDEX_CLOUD_API_ENDPOINT': 'https://mail-api.cloud.yandex.net',
};

for (const [name, value] of Object.entries(variables)) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`🔧 ${name}:`);
  console.log(`${'─'.repeat(80)}`);
  if (name === 'YANDEX_IAM_TOKEN') {
    console.log(value);
  } else {
    console.log(`"${value}"`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('\n✅ Все значения готовы!');
console.log('\n📝 Следующие шаги:');
console.log('   1. Откройте Railway Dashboard: https://railway.app');
console.log('   2. Перейдите в проект → сервис eventpublic → Variables');
console.log('   3. Добавьте каждую переменную через + New Variable');
console.log('   4. Перезапустите сервис после установки');
console.log('\n⚠️  ВАЖНО:');
console.log('   • IAM токен действителен 12 часов');
console.log('   • После установки переменных проверьте работу через: node scripts/check-yandex-email-config.js');
console.log('\n');

