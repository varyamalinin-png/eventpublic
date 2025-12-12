// Заглушка для expo-image-picker
export const launchImageLibraryAsync = async () => ({ cancelled: true });
export const launchCameraAsync = async () => ({ cancelled: true });
export const requestMediaLibraryPermissionsAsync = async () => ({ status: 'granted' });
export const requestCameraPermissionsAsync = async () => ({ status: 'granted' });

export default {
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
};
