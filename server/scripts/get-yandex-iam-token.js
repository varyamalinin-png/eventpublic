// Скрипт для получения IAM токена из приватного ключа сервисного аккаунта Yandex Cloud
// Использование: YANDEX_PRIVATE_KEY_FILE=/path/to/key.json node server/scripts/get-yandex-iam-token.js
//
// ⚠️  ВАЖНО: Никогда не храните приватный ключ в коде!
//     1. Скачайте JSON с ключом из Yandex Cloud Console → IAM → Сервисные аккаунты → Ключи
//     2. Положите файл key.json куда-нибудь НЕ в репозиторий
//     3. Установите переменные окружения:
//        export YANDEX_PRIVATE_KEY_FILE=/path/to/key.json
//        или
//        export YANDEX_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
//        export YANDEX_SERVICE_ACCOUNT_ID=ajeckfmnubc21egtqna6
//        export YANDEX_KEY_ID=aje8eigvd8q22nb3kj1g

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

// Читаем ключ из env или файла
let privateKey, serviceAccountId, keyId;

if (process.env.YANDEX_PRIVATE_KEY_FILE) {
  const keyData = JSON.parse(fs.readFileSync(process.env.YANDEX_PRIVATE_KEY_FILE, 'utf8'));
  privateKey = keyData.private_key;
  serviceAccountId = keyData.service_account_id;
  keyId = keyData.id;
} else if (process.env.YANDEX_PRIVATE_KEY && process.env.YANDEX_SERVICE_ACCOUNT_ID && process.env.YANDEX_KEY_ID) {
  privateKey = process.env.YANDEX_PRIVATE_KEY.replace(/\\n/g, '\n');
  serviceAccountId = process.env.YANDEX_SERVICE_ACCOUNT_ID;
  keyId = process.env.YANDEX_KEY_ID;
} else {
  console.error('❌ Не заданы параметры ключа. Укажите YANDEX_PRIVATE_KEY_FILE или YANDEX_PRIVATE_KEY + YANDEX_SERVICE_ACCOUNT_ID + YANDEX_KEY_ID');
  process.exit(1);
}

function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'PS256', typ: 'JWT', kid: keyId };
  const payload = {
    iss: serviceAccountId,
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iat: now,
    exp: now + 3600,
  };

  const headerBase64 = base64urlEncode(JSON.stringify(header));
  const payloadBase64 = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${headerBase64}.${payloadBase64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerBase64}.${payloadBase64}.${signature}`;
}

function getIamToken() {
  return new Promise((resolve, reject) => {
    const jwt = createJWT();
    const postData = JSON.stringify({ jwt });
    const options = {
      hostname: 'iam.api.cloud.yandex.net',
      port: 443,
      path: '/iam/v1/tokens',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data).iamToken); }
          catch (e) { reject(new Error(`Failed to parse response: ${e.message}`)); }
        } else {
          reject(new Error(`Failed to get IAM token: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔐 Получение IAM токена из приватного ключа...\n');
    const iamToken = await getIamToken();
    console.log('✅ IAM токен получен успешно!\n');
    console.log('📋 Добавьте эту переменную в переменные окружения на Yandex Cloud VM:\n');
    console.log(`YANDEX_IAM_TOKEN=${iamToken}\n`);
    console.log('⚠️  ВАЖНО: IAM токен действителен 12 часов!');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();
