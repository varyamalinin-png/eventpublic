// Metro config для корневой директории проекта
// Используется когда Xcode запускает проект из корня
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Определяем рабочую директорию - client/ если есть, иначе корень
const projectRoot = __dirname;
const clientRoot = path.resolve(projectRoot, 'client');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(clientRoot);

// Настройка разрешения путей для поддержки импортов из app/ и client/
config.projectRoot = clientRoot;
config.watchFolders = [projectRoot, clientRoot];

config.resolver = {
  ...config.resolver,
  alias: {
    '@': projectRoot,
    '@/client': clientRoot,
  },
  // Добавляем дополнительные пути для поиска модулей
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
  },
};

// Обработка импортов @/client для файлов в папке app/
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Если это веб-платформа и запрашивается react-native-maps, возвращаем пустой модуль
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      type: 'empty',
    };
  }
  
  // Обработка алиаса @/client для поддержки путей из папки app/
  if (moduleName.startsWith('@/')) {
    const aliasPath = moduleName.replace('@/', '');
    if (aliasPath.startsWith('client/')) {
      // @/client/... -> client/...
      const actualPath = path.resolve(clientRoot, aliasPath.replace('client/', ''));
      return {
        type: 'sourceFile',
        filePath: actualPath,
      };
    } else {
      // @/... -> корень проекта/...
      const actualPath = path.resolve(projectRoot, aliasPath);
      return {
        type: 'sourceFile',
        filePath: actualPath,
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

