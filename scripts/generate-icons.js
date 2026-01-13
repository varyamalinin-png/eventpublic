const fs = require('fs');
const path = require('path');

// Проверяем наличие исходного файла иконки
const sourceIconPath = path.join(__dirname, '../assets/icon.png');

if (!fs.existsSync(sourceIconPath)) {
  console.error('❌ Файл assets/icon.png не найден!');
  console.log('📝 Пожалуйста, поместите ваш логотип в assets/icon.png (1024x1024 PNG)');
  process.exit(1);
}

console.log('✅ Файл icon.png найден');
console.log('📱 Для генерации иконок используйте команду:');
console.log('   npx expo prebuild');
console.log('');
console.log('Или установите @expo/image-utils для ручной генерации:');
console.log('   npm install -g @expo/image-utils');

