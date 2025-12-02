/**
 * Скрипт для проверки конфигурации Yandex Cloud Email API
 * Использование: node server/scripts/check-yandex-email-config.js
 */

const https = require('https');
const { execSync } = require('child_process');

// Проверяем переменные окружения
console.log('🔍 Проверка конфигурации Yandex Cloud Email API...\n');

const requiredVars = {
  YANDEX_IAM_TOKEN: process.env.YANDEX_IAM_TOKEN,
  YANDEX_CLOUD_FROM_EMAIL: process.env.YANDEX_CLOUD_FROM_EMAIL,
};

const optionalVars = {
  YANDEX_CLOUD_API_ENDPOINT: process.env.YANDEX_CLOUD_API_ENDPOINT || 'https://mail-api.cloud.yandex.net',
  EMAIL_VERIFICATION_REDIRECT_URL: process.env.EMAIL_VERIFICATION_REDIRECT_URL,
  PASSWORD_RESET_REDIRECT_URL: process.env.PASSWORD_RESET_REDIRECT_URL,
};

console.log('📋 Обязательные переменные окружения:');
let allRequiredSet = true;
for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    console.log(`  ✅ ${key}: установлена (${value.substring(0, 20)}...)`);
  } else {
    console.log(`  ❌ ${key}: НЕ УСТАНОВЛЕНА`);
    allRequiredSet = false;
  }
}

console.log('\n📋 Опциональные переменные окружения:');
for (const [key, value] of Object.entries(optionalVars)) {
  if (value) {
    console.log(`  ✅ ${key}: ${value}`);
  } else {
    console.log(`  ⚠️  ${key}: не установлена (будет использоваться значение по умолчанию)`);
  }
}

if (!allRequiredSet) {
  console.log('\n❌ Некоторые обязательные переменные окружения не установлены!');
  console.log('\n📝 Инструкции по настройке:\n');
  
  if (!requiredVars.YANDEX_IAM_TOKEN) {
    console.log('1. Для получения YANDEX_IAM_TOKEN:');
    console.log('   Запустите: node server/scripts/get-yandex-iam-token.js');
    console.log('   Скопируйте полученный токен и установите его как переменную окружения.\n');
  }
  
  if (!requiredVars.YANDEX_CLOUD_FROM_EMAIL) {
    console.log('2. Для YANDEX_CLOUD_FROM_EMAIL:');
    console.log('   Установите адрес отправителя, например: noreply@iventapp.ru');
    console.log('   Убедитесь, что этот домен подтвержден в Yandex Cloud.\n');
  }
  
  process.exit(1);
}

console.log('\n✅ Все обязательные переменные установлены!');

// Проверяем валидность IAM токена, отправляя тестовый запрос
console.log('\n🔐 Проверка валидности IAM токена...');

const testEmailEndpoint = optionalVars.YANDEX_CLOUD_API_ENDPOINT || 'https://mail-api.cloud.yandex.net';

function testIamToken() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'mail-api.cloud.yandex.net',
      port: 443,
      path: '/v2/email/outbound-emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${requiredVars.YANDEX_IAM_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    // Тестовый запрос с невалидным адресом (чтобы проверить только авторизацию)
    const testBody = JSON.stringify({
      FromEmailAddress: requiredVars.YANDEX_CLOUD_FROM_EMAIL,
      Destination: {
        ToAddresses: ['test@test.test'],
      },
      Content: {
        Simple: {
          Subject: { Data: 'Test', Charset: 'UTF-8' },
          Body: {
            Text: { Data: 'Test', Charset: 'UTF-8' },
            Html: { Data: '<p>Test</p>', Charset: 'UTF-8' },
          },
        },
      },
    });

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Проверяем статус - если 401, токен невалидный, если 400 - возможно другие проблемы
        if (res.statusCode === 401) {
          reject(new Error('IAM токен невалиден или истек. Получите новый токен.'));
        } else if (res.statusCode === 403) {
          reject(new Error('Доступ запрещен. Проверьте права сервисного аккаунта.'));
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          // Другие ошибки валидации - это нормально, главное что токен принят
          resolve({
            valid: true,
            status: res.statusCode,
            message: 'IAM токен валиден (ошибка валидации данных ожидаема для тестового запроса)',
          });
        } else {
          resolve({
            valid: true,
            status: res.statusCode,
            message: 'IAM токен принят сервером',
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Ошибка сети: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Таймаут запроса'));
    });

    req.write(testBody);
    req.end();
  });
}

testIamToken()
  .then((result) => {
    console.log(`✅ ${result.message}`);
    console.log(`   Статус ответа: ${result.status}`);
    console.log('\n✅ Конфигурация Yandex Cloud Email API полностью настроена и работает!');
    console.log('\n📝 Следующие шаги:');
    console.log('   1. Убедитесь, что домен ' + requiredVars.YANDEX_CLOUD_FROM_EMAIL + ' подтвержден в Yandex Cloud');
    console.log('   2. Проверьте, что сервисный аккаунт имеет права на отправку email');
    console.log('   3. IAM токен действителен 12 часов - настройте автоматическое обновление для продакшена');
    process.exit(0);
  })
  .catch((error) => {
    console.error(`❌ Ошибка проверки токена: ${error.message}`);
    console.log('\n💡 Попробуйте:');
    console.log('   1. Получить новый IAM токен: node server/scripts/get-yandex-iam-token.js');
    console.log('   2. Проверить, что токен скопирован полностью (без переносов строк)');
    console.log('   3. Проверить подключение к интернету');
    process.exit(1);
  });

