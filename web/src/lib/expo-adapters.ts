// Адаптеры для Expo модулей в Next.js

// Адаптер для expo-router
export const useRouter = () => {
  const { useRouter: nextRouter } = require('next/navigation');
  const router = nextRouter();
  
  return {
    push: (href: string) => router.push(href),
    replace: (href: string) => router.replace(href),
    back: () => router.back(),
    canGoBack: () => true,
  };
};

export const useLocalSearchParams = () => {
  const { useSearchParams } = require('next/navigation');
  const searchParams = useSearchParams();
  const params: Record<string, string> = {};
  
  searchParams.forEach((value: string, key: string) => {
    params[key] = value;
  });
  
  return params;
};

export const Redirect = ({ href }: { href: string }) => {
  const { redirect } = require('next/navigation');
  redirect(href);
  return null;
};

// Адаптер для expo-haptics
export const Haptics = {
  notificationAsync: async () => {
    // No-op для веба
  },
  impactAsync: async () => {
    // No-op для веба
  },
};

// Адаптер для expo-image-manipulator
export const ImageManipulator = {
  manipulateAsync: async (uri: string, actions: any[]) => {
    // Возвращаем оригинальный URI для веба
    return { uri };
  },
};

// Адаптер для expo-secure-store
export const SecureStore = {
  getItemAsync: async (key: string) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItemAsync: async (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  deleteItemAsync: async (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};

