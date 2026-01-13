const path = require('path');
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-native-web'],
  outputFileTracingRoot: path.join(__dirname, '../'),
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
      // Алиасы для компонентов и утилит
      '@/components': path.resolve(__dirname, '../components'),
      '@/hooks': path.resolve(__dirname, '../hooks'),
      '@/constants': path.resolve(__dirname, '../constants'),
      // Алиасы для client
      '@/client': path.resolve(__dirname, '../client'),
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
    
    return config;
  },
  // Отключаем оптимизацию изображений для React Native Web
  images: {
    unoptimized: true,
  },
  // Игнорируем ошибки TypeScript при сборке
  typescript: {
    ignoreBuildErrors: true,
  },
  // Отключаем строгий ESLint для сборки
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
