// Дополнительная конфигурация webpack для Next.js
module.exports = {
  webpack: (config, { isServer }) => {
    // Исключаем проблемные Expo модули
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
      'expo-router': require.resolve('./expo-router-stub.js'),
      'expo-haptics': require.resolve('./expo-haptics-stub.js'),
      'expo-image-manipulator': require.resolve('./expo-image-manipulator-stub.js'),
      'expo-secure-store': require.resolve('./expo-secure-store-stub.js'),
    };

    // Исключаем нативные модули
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

