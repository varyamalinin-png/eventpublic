// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Оптимизация производительности Metro
config.cacheStores = [
  // Используем файловый кеш для ускорения сборки
  new (require('metro-cache').FileStore)({
    root: path.join(__dirname, '.metro-cache'),
  }),
];

// Увеличиваем лимит памяти для Metro
config.maxWorkers = require('os').cpus().length;

// Оптимизация трансформации
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

// Исключаем react-native-maps и map.native.tsx для веб-платформы
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Если это веб-платформа и запрашивается react-native-maps, возвращаем пустой модуль
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      type: 'empty',
    };
  }
  
  // Если это веб-платформа и запрашивается map.native, возвращаем пустой модуль
  // Это предотвращает загрузку map.native.tsx при сборке для веба
  if (platform === 'web') {
    const requestingFile = context.originModulePath || '';
    const isMapFile = requestingFile.includes('map.tsx') || requestingFile.includes('map.web.tsx');
    
    if (isMapFile && (
      moduleName.includes('map.native') || 
      moduleName.endsWith('/map.native') ||
      moduleName.includes(path.join('app', 'map.native'))
    )) {
      return {
        type: 'empty',
      };
    }
  }
  
  // Используем стандартное разрешение для всех остальных случаев
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  // Fallback на стандартный resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

