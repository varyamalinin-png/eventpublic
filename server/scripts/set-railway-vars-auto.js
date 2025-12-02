/**
 * Автоматическая установка переменных окружения в Railway
 * Использует Railway API напрямую
 */

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Получаем IAM токен Yandex
function getYandexIamToken() {
  try {
    const output = execSync('node scripts/get-yandex-iam-token.js', { encoding: 'utf-8' });
    const match = output.match(/YANDEX_IAM_TOKEN=(.+)/);
    if (match) {
      return match[1].trim();
    }
    throw new Error('Не удалось извлечь токен из вывода');
  } catch (error) {
    console.error('Ошибка получения IAM токена:', error.message);
    throw error;
  }
}

// Устанавливаем переменную через Railway CLI
function setRailwayVariable(name, value) {
  try {
    console.log(`Устанавливаю ${name}...`);
    
    // Пробуем через Railway CLI с указанием сервиса
    const commands = [
      `npx -y @railway/cli variables set ${name}="${value}" --service eventpublic`,
      `npx -y @railway/cli variables set ${name}="${value}"`,
    ];
    
    for (const cmd of commands) {
      try {
        execSync(cmd, { 
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, RAILWAY_ENVIRONMENT: 'production' }
        });
        console.log(`✅ ${name} установлена`);
        return true;
      } catch (err) {
        // Пробуем следующую команду
        continue;
      }
    }
    
    throw new Error('Не удалось установить переменную через CLI');
  } catch (error) {
    console.error(`❌ Ошибка установки ${name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Автоматическая настройка переменных окружения Railway\n');
  
  // Получаем IAM токен
  console.log('1. Получение IAM токена Yandex...');
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
  
  console.log('2. Установка переменных окружения в Railway...\n');
  
  let successCount = 0;
  for (const [name, value] of Object.entries(variables)) {
    if (setRailwayVariable(name, value)) {
      successCount++;
    }
  }
  
  console.log(`\n✅ Установлено переменных: ${successCount}/${Object.keys(variables).length}`);
  
  if (successCount === Object.keys(variables).length) {
    console.log('\n🎉 Все переменные успешно установлены!');
    console.log('\n⚠️  ВАЖНО:');
    console.log('   1. Перезапустите сервис в Railway для применения изменений');
    console.log('   2. IAM токен действителен 12 часов - настройте автоматическое обновление');
    console.log('   3. Проверьте работу через: node scripts/check-yandex-email-config.js');
  } else {
    console.log('\n⚠️  Некоторые переменные не удалось установить автоматически.');
    console.log('Установите их вручную через Railway Dashboard:');
    console.log('https://railway.app → проект → сервис eventpublic → Variables');
    console.log('\nЗначения:');
    for (const [name, value] of Object.entries(variables)) {
      if (name === 'YANDEX_IAM_TOKEN') {
        console.log(`${name}=${value.substring(0, 50)}...`);
      } else {
        console.log(`${name}=${value}`);
      }
    }
  }
}

main().catch(console.error);

