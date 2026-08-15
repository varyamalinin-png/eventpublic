const path = require('path');
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-native-web'],
  outputFileTracingRoot: path.join(__dirname, '../'),
  // Сжатие gzip для ответов сервера
  compress: true,
  // Убираем лишний заголовок
  poweredByHeader: false,
  // Оптимизированный минификатор
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Создаем единый объект алиасов
    const aliases = {
      // React Native -> React Native Web (используем абсолютный путь)
      'react-native$': path.resolve(__dirname, 'node_modules/react-native-web'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native-web'),
      // Заглушки для Expo модулей
      'expo-router': path.resolve(__dirname, 'src/lib/expo-router-stub.js'),
      'expo-haptics': path.resolve(__dirname, 'src/lib/expo-haptics-stub.js'),
      'expo-image-manipulator': path.resolve(__dirname, 'src/lib/expo-image-manipulator-stub.js'),
      'expo-secure-store': path.resolve(__dirname, 'src/lib/expo-secure-store-stub.js'),
      'react-native-gesture-handler': path.resolve(__dirname, 'src/lib/react-native-gesture-handler-stub.js'),
      'expo-constants': path.resolve(__dirname, 'src/lib/expo-constants-stub.js'),
      'expo-modules-core': path.resolve(__dirname, 'src/lib/expo-modules-core-stub.js'),
      'expo-image-picker': path.resolve(__dirname, 'src/lib/expo-image-picker-stub.js'),
      'expo-linear-gradient': path.resolve(__dirname, 'src/lib/expo-linear-gradient-stub.js'),
      'expo-auth-session': path.resolve(__dirname, 'src/lib/expo-auth-session-stub.js'),
      'expo-web-browser': path.resolve(__dirname, 'src/lib/expo-web-browser-stub.js'),
      // Алиасы для компонентов и утилит
      '@/components': path.resolve(__dirname, '../components'),
      '@/hooks': path.resolve(__dirname, '../hooks'),
      '@/constants': path.resolve(__dirname, '../constants'),
      // Алиасы для client
      '@/client': path.resolve(__dirname, '../client'),
      // Веб-компоненты (PageLoading и т.д.)
      '@/web': path.resolve(__dirname, 'src'),
      // Заглушки для проблемных модулей
      '@react-native-community/datetimepicker': path.resolve(__dirname, 'src/lib/datetimepicker-stub.js'),
      'expo-av': path.resolve(__dirname, 'src/lib/expo-av-stub.js'),
      'expo-location': path.resolve(__dirname, 'src/lib/expo-location-stub.js'),
      '@expo/vector-icons': path.resolve(__dirname, 'src/lib/expo-vector-icons-stub.js'),
      'react-native-webview': path.resolve(__dirname, 'src/lib/react-native-webview-stub.js'),
      '@/components/ThemedText': path.resolve(__dirname, 'src/lib/themed-text-stub.js'),
      '@/components/ThemedView': path.resolve(__dirname, 'src/lib/themed-view-stub.js'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/lib/async-storage-stub.js'),
      'expo-file-system': path.resolve(__dirname, 'src/lib/expo-file-system-stub.js'),
      'expo-image': path.resolve(__dirname, 'src/lib/expo-image-stub.js'),
      'expo-apple-authentication': path.resolve(__dirname, 'src/lib/expo-apple-authentication-stub.js'),
      'socket.io-client': path.resolve(__dirname, 'src/lib/socket-io-client-stub.js'),
    };
    
    config.resolve.alias = {
      ...config.resolve.alias,
      ...aliases,
    };
    
    config.resolve.extensions = [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      ...config.resolve.extensions,
    ];
    
    // Определяем глобальные переменные для React Native/Expo (и для сервера, и для клиента)
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        '__DEV__': JSON.stringify(process.env.NODE_ENV !== 'production'),
        'process.env.EXPO_PUBLIC_STORAGE_URL': JSON.stringify(process.env.NEXT_PUBLIC_STORAGE_URL || process.env.EXPO_PUBLIC_STORAGE_URL),
      }),
      new webpack.NormalModuleReplacementPlugin(
        /^expo-file-system\/legacy$/,
        path.resolve(__dirname, 'src/lib/expo-file-system-stub.js')
      ),
      // На вебе всегда используем TopBar.web.tsx (иконка фильтра — слайдеры, без эмодзи)
      new webpack.NormalModuleReplacementPlugin(
        /components[\\/]TopBar$/,
        path.resolve(__dirname, '../client/components/TopBar.web.tsx')
      )
    );
    
    // Исключаем нативные модули для веба
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    // Игнорируем проблемные модули
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    
    // Добавляем правило для обработки TTF файлов (шрифты)
    config.module.rules.push({
      test: /\.(ttf|otf|eot|woff|woff2)$/,
      type: 'asset/resource',
    });

    // Оптимизация чанков для продакшена
    if (!isServer && config.mode === 'production') {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          chunks: 'all',
          maxSize: 200_000,        // Разбиваем чанки > 200KB
          minSize: 20_000,
          cacheGroups: {
            ...(config.optimization?.splitChunks?.cacheGroups || {}),
            // react-native-web в отдельный кэшируемый чанк
            rnweb: {
              test: /[\\/]node_modules[\\/](react-native-web)[\\/]/,
              name: 'rn-web',
              chunks: 'all',
              priority: 20,
            },
            // Остальные vendor-библиотеки
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },
  images: {
    // Включаем оптимизацию изображений для next/image
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      { protocol: 'https', hostname: 'iwent.ru' },
      { protocol: 'https', hostname: 'www.iwent.ru' },
      { protocol: 'https', hostname: 'iventapp.ru' },
      { protocol: 'https', hostname: 'www.iventapp.ru' },
      { protocol: 'https', hostname: '**.storage.yandexcloud.net' },
    ],
  },
  // Игнорируем ошибки TypeScript при сборке
  typescript: {
    ignoreBuildErrors: true,
  },
  // Отключаем строгий ESLint для сборки
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Cache headers for static assets
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
