// Заглушка для expo-constants
export default {
  manifest: {
    extra: {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://iwent.ru/api',
    },
  },
  expoConfig: {
    extra: {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://iwent.ru/api',
    },
  },
};

