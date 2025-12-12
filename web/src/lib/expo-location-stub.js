// Заглушка для expo-location
export const requestForegroundPermissionsAsync = async () => ({ status: 'granted' });
export const getCurrentPositionAsync = async () => ({
  coords: { latitude: 0, longitude: 0 },
});
export const reverseGeocodeAsync = async () => [];

export default {
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  reverseGeocodeAsync,
};

