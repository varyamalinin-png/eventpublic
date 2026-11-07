// Заглушка для expo-notifications.
//
// Пуши — нативная история: в вебе их нет, а хук usePushNotifications живёт в
// общем коде (client/hooks) и импортируется веб-сборкой вместе со всем
// остальным. Сам хук на вебе выходит по Platform.OS === 'web', но webpack
// всё равно должен уметь разрешить импорт — иначе сборка веба падает.
// См. CLAUDE.md, раздел про слой заглушек.
export const setNotificationHandler = () => {};
export const getPermissionsAsync = async () => ({ status: 'denied' });
export const requestPermissionsAsync = async () => ({ status: 'denied' });
export const getDevicePushTokenAsync = async () => ({ type: 'web', data: '' });
export const getExpoPushTokenAsync = async () => ({ data: '' });
export const addNotificationReceivedListener = () => ({ remove: () => {} });
export const addNotificationResponseReceivedListener = () => ({ remove: () => {} });
export const removeNotificationSubscription = () => {};
export const setBadgeCountAsync = async () => false;
