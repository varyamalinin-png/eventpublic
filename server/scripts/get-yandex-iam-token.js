// Скрипт для получения IAM токена из приватного ключа сервисного аккаунта Yandex Cloud
// Использование: node server/scripts/get-yandex-iam-token.js

const crypto = require('crypto');
const https = require('https');

// Приватный ключ сервисного аккаунта
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDikaSvH7f5Q+aD
gN1xH1A8oBBsjnbQS154EWWzUW0OLB+OOgH2GHSKgDG0bVHAQwngwcdxtgV7y/g5
22InK3jN8tsiaPDOKlWCAWs3cuC6TqDUvzhVsCwlNwlYY0xEHvsbh5fr8nouJ6yu
7t+OmrzhjFPAhO4JJA6UVpLuTl+6p0ESclXzWmqIfyfqAjzW+JxeLPTATvuRtMHe
hxljVd3q5UslWW06epZWcw7nEzV/s9CPk0IKqsrbWXl0EeWcjCYawURhxKdw6a8m
kg/BozDtc0MdBsKeQbwhB2/p8916w32TucjjWrRgZpQGrwLk22tLnf13g/3S13U9
q+aF8jl3AgMBAAECggEABUMAohiIez96cP9jJSdnA6FsADlmxPubHAq7Y+i2MagQ
q4rpVL/IpRbJELmhNmfYKOIXMaragb+A6kcQBnzZ9152fFwXi5IsHjLOPKFsWqdM
0OQH+OV4gPzAOM9FjCd0CXWir5YYBE5jkkR16KfrTwmlQElWBdxSgltoWiRz0K/a
f8sP38CNOQzgTfoPGBlQvXhq82+zR4spXp9Dxf99qnYVfdVo0zb5I7EHB4XXU/eH
OUc3sLgh2Rjy6qOTUgAH19xSOw3TmHjoxNwlgDqH+uxjW8LJvNcWvTWc5xZ+ROQN
TjKhKvSjg2alqXftgwS//VNkZSY3BRO38MejYL3LAQKBgQD44GwAYyNqXd1Hz7KU
x7HbjlAHuwCkZ/0uN6lSxKUq5b0AFs4BwgDuRlK+QFlDuuE9A7lv9e9Idcejo4lz
Zv4Q0Ng8Ksh/6azhw8qJqICjSME+D5lu4OhZX2IDyk9kgM8pWZOSykwn4W3FDijF
j3de6umU6R/Z10GZ22dGSXemQQKBgQDpDcR0tigI+tjRKGD4GKBuQw2iBzcCLlo9
kecg5iFzHL9YMLSvp5rmhYBnbxLyeVM3ktdNjNtfNFJA2+NH5O2ln1P95DiY2DmQ
3237GiOHAdDrzCQTjMTEmTgS3CC2TgAR6hjcr3W+nOJtZUAahnYLWxcFOjBOfPmY
sWSOrfwhtwKBgQDsY/YRtBjKileJQx2Dtd4ZBia8AQKOJnvT72i0RjX/9fE8aWzJ
PKW3rTIgpWxkKdiRJL15O+dJMx4qL0Z6R8Rg4o3RMG37GVBtrJPvhw6QiaWLNjPt
nlDzuuaVZQ9eDf83bm7+iYomgzfJaTaO2ENw875kA76OIqib5EtG9rdgQQKBgD0Z
rO3ka+6exYVgjru8ySLfVY2rUpKx0FrgC7amXxKs8MWQT27WBFh3m8iCaHdFs7mY
N/ZO/ZyiPQZgH+BTdrK7aOvhj60S01TWHyF8IuBca4fGh5bQiy339amMKM9i98W6
mDYTkk0dGIgRyZKqufwUL57hOJT7UvzjVTfLCZVVAoGBANSU0p+7x9+w93OslKFC
aG5o9yP1YvfKUY7zMm3rAKcPXTyKu+Dt59iMr5dT8+xPi969srp1aAixXghGfquq
Lh6jBDkj6LyBGDkpo4dmPIBG0IkDkSnyxLWKDIoc2lDXJDi7Lu6w99Rx3wOzMrBW
DXOD4+2g0G0MEotxfTPnSWoZ
-----END PRIVATE KEY-----`;

// ID сервисного аккаунта
const serviceAccountId = 'ajeckfmnubc21egtqna6';
// Key ID (из информации о ключе)
const keyId = 'aje8eigvd8q22nb3kj1g';

// Функция для base64url кодирования
function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Создаем JWT токен для получения IAM токена (PS256)
function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'PS256',
    typ: 'JWT',
    kid: keyId, // Key ID обязателен для Yandex Cloud
  };

  const payload = {
    iss: serviceAccountId,
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iat: now,
    exp: now + 3600, // 1 час
  };

  const headerBase64 = base64urlEncode(JSON.stringify(header));
  const payloadBase64 = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${headerBase64}.${payloadBase64}`;

  // Используем RSA-PSS для подписи (PS256)
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  
  // Подписываем с параметрами PSS
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

// Получаем IAM токен
function getIamToken() {
  return new Promise((resolve, reject) => {
    const jwt = createJWT();
    
    const postData = JSON.stringify({
      jwt: jwt,
    });

    const options = {
      hostname: 'iam.api.cloud.yandex.net',
      port: 443,
      path: '/iam/v1/tokens',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response.iamToken);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          reject(new Error(`Failed to get IAM token: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Главная функция
async function main() {
  try {
    console.log('🔐 Получение IAM токена из приватного ключа...\n');
    const iamToken = await getIamToken();
    console.log('✅ IAM токен получен успешно!\n');
<<<<<<< HEAD
    console.log('📋 Добавьте эту переменную в переменные окружения на Yandex Cloud VM:\n');
=======
    console.log('📋 Добавьте эту переменную в .env файл на Yandex Cloud VM:\n');
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
    console.log(`YANDEX_IAM_TOKEN=${iamToken}\n`);
    console.log('⚠️ ВАЖНО: IAM токен действителен 12 часов!');
    console.log('Для продакшена лучше использовать авторизованный ключ и автоматически обновлять токен.\n');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();

