// Глобальные типы для React Native/Expo переменных
declare global {
  interface Window {
    __DEV__?: boolean;
  }
  
  const __DEV__: boolean;
}

export {};

