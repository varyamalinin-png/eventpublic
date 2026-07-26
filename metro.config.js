// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Настройка разрешения путей для поддержки алиаса @
// Поддержка как при запуске из client/, так и из корня проекта
const projectRoot = path.resolve(__dirname);
const workspaceRoot = path.resolve(__dirname, '..');

// Добавляем корневую директорию в watchFolders, чтобы Metro мог отслеживать файлы из app/ и components/
// Также настраиваем projectRoot для работы с файлами из корня проекта
config.watchFolders = [projectRoot];
config.projectRoot = projectRoot;

// Убедимся, что Metro может отслеживать файлы в projectRoot
if (!config.resolver.sourceExts) {
  config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json'];
}

config.resolver = {
  ...config.resolver,
  alias: {
    '@': workspaceRoot,
    '@/client': projectRoot,
  },
  // Добавляем дополнительные пути для поиска модулей
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
  },
  // Настраиваем resolver для поиска модулей в корне проекта
  resolveRequest: null, // Будет переопределен ниже
};

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
  
  // Обработка алиаса @/client для поддержки путей из папки app/
  if (moduleName.startsWith('@/')) {
    const aliasPath = moduleName.replace('@/', '');
    if (aliasPath.startsWith('client/')) {
      // @/client/... -> client/...
      const actualPath = path.resolve(workspaceRoot, aliasPath);
      // Проверяем, что файл существует и находится в правильном месте
      const fs = require('fs');
      if (fs.existsSync(actualPath)) {
        return {
          type: 'sourceFile',
          filePath: actualPath,
        };
      }
      // Если файл не найден, пробуем найти в projectRoot
      const projectPath = path.resolve(projectRoot, aliasPath.replace('client/', ''));
      if (fs.existsSync(projectPath)) {
        return {
          type: 'sourceFile',
          filePath: projectPath,
        };
      }
    } else {
      // @/... -> сначала пробуем в projectRoot (client/), потом в workspaceRoot
      const fs = require('fs');
      // Сначала проверяем в projectRoot
      const projectPath = path.resolve(projectRoot, aliasPath);
      if (fs.existsSync(projectPath)) {
        return {
          type: 'sourceFile',
          filePath: projectPath,
        };
      }
      // Если не нашли в projectRoot, ищем в workspaceRoot
      const workspacePath = path.resolve(workspaceRoot, aliasPath);
      if (fs.existsSync(workspacePath)) {
        return {
          type: 'sourceFile',
          filePath: workspacePath,
        };
      }
      // Если не нашли нигде, используем projectPath как fallback (для совместимости)
      return {
        type: 'sourceFile',
        filePath: projectPath,
      };
    }
  }
  
  // Обработка импортов из корня проекта (например, ../components/ThemedText)
  // Проверяем относительные пути, которые могут указывать на корень проекта
  if (moduleName.startsWith('../') || moduleName.startsWith('./')) {
    const requestingFile = context.originModulePath || '';
    const requestingDir = path.dirname(requestingFile);
    const resolvedPath = path.resolve(requestingDir, moduleName);
    
    // Если путь указывает на корень проекта (вне client/), проверяем его существование
    if (resolvedPath.startsWith(workspaceRoot) && !resolvedPath.startsWith(projectRoot)) {
      // Это файл из корня проекта
      // Используем стандартный resolver, но с дополнительными путями
      if (defaultResolver) {
        try {
          return defaultResolver(context, moduleName, platform);
        } catch (e) {
          // Если стандартный resolver не нашел файл, пытаемся найти в корне проекта
          const fs = require('fs');
          const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
          for (const ext of possibleExtensions) {
            const fullPath = resolvedPath + ext;
            if (fs.existsSync(fullPath)) {
              return {
                type: 'sourceFile',
                filePath: fullPath,
              };
            }
          }
          throw e;
        }
      }
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

