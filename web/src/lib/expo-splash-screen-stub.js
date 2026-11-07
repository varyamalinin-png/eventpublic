// Заглушка для expo-splash-screen.
// На вебе нативного сплэш-экрана нет, поэтому обе функции — no-op,
// но возвращают промисы: вызывающий код делает .catch(...).
export const preventAutoHideAsync = () => Promise.resolve();
export const hideAsync = () => Promise.resolve();
export const setOptions = () => {};
export default { preventAutoHideAsync, hideAsync, setOptions };
