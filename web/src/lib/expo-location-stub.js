// Заглушка для expo-location
export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};
export const requestForegroundPermissionsAsync = async () => ({ status: 'granted' });
export const getCurrentPositionAsync = async () => ({
  coords: { latitude: 0, longitude: 0 },
});
export const reverseGeocodeAsync = async () => [];

export default {
  Accuracy,
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  reverseGeocodeAsync,
};

