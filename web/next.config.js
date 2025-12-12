const path = require('path');
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-native-web'],
  outputFileTracingRoot: path.join(__dirname, '../'),
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
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
      })
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
    
    // Исключаем проблемные модули из обработки
    config.resolve.alias = {
      ...config.resolve.alias,
      '@expo/vector-icons': path.resolve(__dirname, 'src/lib/expo-vector-icons-stub.js'),
    };
    
    return config;
  },
  // Отключаем оптимизацию изображений для React Native Web
  images: {
    unoptimized: true,
  },
  // Настройки для статического экспорта (если нужно)
  output: 'standalone',
};

module.exports = nextConfig;

