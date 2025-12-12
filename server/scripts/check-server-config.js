/**
 * Скрипт для проверки конфигурации на сервере Yandex Cloud VM
 * Проверяет все переменные окружения и тестирует Yandex Cloud API
 */

const https = require('https');

console.log('🔍 Проверка конфигурации на сервере...\n');

// Проверяем переменные окружения
const requiredVars = {
  YANDEX_IAM_TOKEN: process.env.YANDEX_IAM_TOKEN,
  YANDEX_CLOUD_FROM_EMAIL: process.env.YANDEX_CLOUD_FROM_EMAIL,
};

console.log('📋 Переменные окружения:');
let allSet = true;
for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    const displayValue = key === 'YANDEX_IAM_TOKEN' 
      ? `${value.substring(0, 30)}... (длина: ${value.length})`
      : value;
    console.log(`  ✅ ${key}: ${displayValue}`);
  } else {
    console.log(`  ❌ ${key}: НЕ УСТАНОВЛЕНА`);
    allSet = false;
  }
}

if (!allSet) {
  console.log('\n❌ Некоторые переменные не установлены!');
  process.exit(1);
}

// Тестируем подключение к Yandex Cloud API
console.log('\n🔐 Тестирование подключения к Yandex Cloud API...');

const testConnection = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'mail-api.cloud.yandex.net',
      port: 443,
      path: '/v2/email/outbound-emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.YANDEX_IAM_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    const testBody = JSON.stringify({
      FromEmailAddress: process.env.YANDEX_CLOUD_FROM_EMAIL,
      Destination: {
        ToAddresses: ['test@test.test'],
      },
      Content: {
        Simple: {
          Subject: { Data: 'Test', Charset: 'UTF-8' },
          Body: {
            Text: { Data: 'Test', Charset: 'UTF-8' },
          },
        },
      },
    });

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Проверяем статус - если 401, токен невалидный
        if (res.statusCode === 401) {
          reject(new Error('IAM токен невалиден или истек'));
        } else if (res.statusCode === 403) {
          reject(new Error('Доступ запрещен. Проверьте права сервисного аккаунта'));
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          // Другие ошибки валидации - это нормально, главное что токен принят
          resolve({ valid: true, status: res.statusCode });
        } else {
          resolve({ valid: true, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Ошибка сети: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Таймаут подключения'));
    });

    req.write(testBody);
    req.end();
  });
};

testConnection()
  .then((result) => {
    console.log(`✅ Подключение к Yandex Cloud API успешно!`);
    console.log(`   Статус: ${result.status}`);
    console.log('\n✅ Конфигурация корректна!');
    process.exit(0);
  })
  .catch((error) => {
    console.error(`❌ Ошибка подключения: ${error.message}`);
    console.log('\n💡 Возможные причины:');
    console.log('   1. IAM токен истек (действителен 12 часов)');
    console.log('   2. Проблемы с сетью на Yandex Cloud VM');
    console.log('   3. Неправильные права сервисного аккаунта');
    process.exit(1);
  });

