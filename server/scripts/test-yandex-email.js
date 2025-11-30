/**
 * Тестовый скрипт для проверки отправки email через Yandex Cloud API
 */

const https = require('https');

// Получаем переменные окружения
const IAM_TOKEN = process.env.YANDEX_IAM_TOKEN;
const FROM_EMAIL = process.env.YANDEX_CLOUD_FROM_EMAIL || 'noreply@iventapp.ru';
const TEST_EMAIL = process.argv[2] || 'varya.malinina.2003@mail.ru';

if (!IAM_TOKEN) {
  console.error('❌ YANDEX_IAM_TOKEN не установлена!');
  process.exit(1);
}

if (!FROM_EMAIL) {
  console.error('❌ YANDEX_CLOUD_FROM_EMAIL не установлена!');
  process.exit(1);
}

console.log('🧪 Тестирование отправки email через Yandex Cloud API...\n');
console.log(`From: ${FROM_EMAIL}`);
console.log(`To: ${TEST_EMAIL}\n`);

const requestBody = {
  FromEmailAddress: FROM_EMAIL,
  Destination: {
    ToAddresses: [TEST_EMAIL],
  },
  Content: {
    Simple: {
      Subject: {
        Data: 'Тестовое письмо',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: 'Это тестовое письмо для проверки работы Yandex Cloud Email API.',
          Charset: 'UTF-8',
        },
        Html: {
          Data: '<p>Это <b>тестовое письмо</b> для проверки работы Yandex Cloud Email API.</p>',
          Charset: 'UTF-8',
        },
      },
    },
  },
};

const postData = JSON.stringify(requestBody);
const url = new URL('https://mail-api.cloud.yandex.net/v2/email/outbound-emails');

const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${IAM_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
  timeout: 30000,
};

console.log('📤 Отправка запроса...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Статус: ${res.statusCode} ${res.statusMessage}\n`);
    
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const result = JSON.parse(data);
        console.log('✅ Email успешно отправлен!');
        console.log(`Message ID: ${result.MessageId || 'N/A'}`);
        console.log(`Response:`, JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('✅ Email отправлен (не удалось распарсить ответ)');
        console.log('Response:', data);
      }
    } else {
      console.error('❌ Ошибка отправки email:');
      try {
        const errorJson = JSON.parse(data);
        console.error(JSON.stringify(errorJson, null, 2));
      } catch {
        console.error(data);
      }
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка сети:', error.message);
  console.error('Детали:', error);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.error('❌ Таймаут запроса');
  process.exit(1);
});

req.write(postData);
req.end();

