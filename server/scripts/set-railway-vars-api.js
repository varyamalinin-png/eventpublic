/**
 * Установка переменных окружения в Railway через API
 */

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Получаем токен Railway из конфига
function getRailwayToken() {
  try {
    const configPath = path.join(process.env.HOME, '.railway', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.user?.token;
  } catch (error) {
    console.error('Ошибка чтения Railway конфига:', error.message);
    return null;
  }
}

// Получаем информацию о проекте
function getRailwayProjectInfo() {
  try {
    const configPath = path.join(process.env.HOME, '.railway', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const currentDir = process.cwd();
    const projectInfo = config.projects?.[currentDir] || config.projects?.[path.dirname(currentDir)];
    return projectInfo;
  } catch (error) {
    return null;
  }
}

// Получаем IAM токен Yandex
function getYandexIamToken() {
  try {
    const output = execSync('node scripts/get-yandex-iam-token.js', { encoding: 'utf-8', cwd: __dirname + '/..' });
    const match = output.match(/YANDEX_IAM_TOKEN=(.+)/);
    if (match) {
      return match[1].trim();
    }
    throw new Error('Не удалось извлечь токен');
  } catch (error) {
    throw new Error(`Ошибка получения IAM токена: ${error.message}`);
  }
}

// Получаем список сервисов через Railway API
function getServices(railwayToken, projectId, environmentId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.railway.app',
      port: 443,
      path: `/v1/projects/${projectId}/services`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${railwayToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Ошибка парсинга ответа: ${e.message}`));
          }
        } else {
          reject(new Error(`API ошибка: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Таймаут')); });
    req.end();
  });
}

// Устанавливаем переменную через Railway API
function setVariable(railwayToken, serviceId, variableName, variableValue) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      name: variableName,
      value: variableValue,
    });

    const options = {
      hostname: 'api.railway.app',
      port: 443,
      path: `/v1/services/${serviceId}/variables`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${railwayToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else if (res.statusCode === 409) {
          // Переменная уже существует, обновляем
          updateVariable(railwayToken, serviceId, variableName, variableValue)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`API ошибка: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Таймаут')); });
    req.write(postData);
    req.end();
  });
}

// Обновляем существующую переменную
function updateVariable(railwayToken, serviceId, variableName, variableValue) {
  return new Promise((resolve, reject) => {
    const putData = JSON.stringify({
      value: variableValue,
    });

    const options = {
      hostname: 'api.railway.app',
      port: 443,
      path: `/v1/services/${serviceId}/variables/${variableName}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${railwayToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(putData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          resolve({ success: true });
        } else {
          reject(new Error(`API ошибка обновления: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Таймаут')); });
    req.write(putData);
    req.end();
  });
}

async function main() {
  console.log('🚀 Установка переменных окружения через Railway API\n');

  // Получаем токен Railway
  const railwayToken = getRailwayToken();
  if (!railwayToken) {
    console.error('❌ Не удалось получить Railway токен. Запустите: railway login');
    process.exit(1);
  }

  // Получаем информацию о проекте
  const projectInfo = getRailwayProjectInfo();
  if (!projectInfo) {
    console.error('❌ Не удалось получить информацию о проекте');
    process.exit(1);
  }

  const projectId = projectInfo.project;
  const environmentId = projectInfo.environment;

  console.log(`📦 Проект: ${projectInfo.name} (${projectId})`);
  console.log(`🌍 Окружение: ${projectInfo.environmentName} (${environmentId})\n`);

  // Получаем сервисы
  console.log('🔍 Поиск сервиса eventpublic...');
  let services;
  try {
    services = await getServices(railwayToken, projectId, environmentId);
  } catch (error) {
    console.error('❌ Ошибка получения сервисов:', error.message);
    process.exit(1);
  }

  // Ищем сервис eventpublic или первый доступный
  const service = services.find(s => s.name === 'eventpublic' || s.name?.includes('event')) || services[0];
  if (!service) {
    console.error('❌ Сервис не найден');
    process.exit(1);
  }

  console.log(`✅ Найден сервис: ${service.name} (${service.id})\n`);

  // Получаем IAM токен Yandex
  console.log('🔐 Получение IAM токена Yandex...');
  let iamToken;
  try {
    iamToken = getYandexIamToken();
    console.log('✅ IAM токен получен\n');
  } catch (error) {
    console.error('❌ Ошибка получения IAM токена:', error.message);
    process.exit(1);
  }

  // Устанавливаем переменные
  const variables = {
    'YANDEX_IAM_TOKEN': iamToken,
    'YANDEX_CLOUD_FROM_EMAIL': 'noreply@iventapp.ru',
    'YANDEX_CLOUD_API_ENDPOINT': 'https://mail-api.cloud.yandex.net',
  };

  console.log('📝 Установка переменных окружения...\n');

  let successCount = 0;
  for (const [name, value] of Object.entries(variables)) {
    try {
      await setVariable(railwayToken, service.id, name, value);
      console.log(`✅ ${name} установлена`);
      successCount++;
    } catch (error) {
      console.error(`❌ Ошибка установки ${name}:`, error.message);
    }
  }

  console.log(`\n✅ Установлено переменных: ${successCount}/${Object.keys(variables).length}`);

  if (successCount === Object.keys(variables).length) {
    console.log('\n🎉 Все переменные успешно установлены!');
    console.log('\n⚠️  ВАЖНО:');
    console.log('   1. Перезапустите сервис в Railway для применения изменений');
    console.log('   2. IAM токен действителен 12 часов');
  }
}

main().catch(console.error);

