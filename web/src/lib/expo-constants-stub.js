// Заглушка для expo-constants
export default {
  manifest: {
    extra: {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://iwent.ru',
    },
  },
  expoConfig: {
    extra: {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://iwent.ru',
    },
  },
};

