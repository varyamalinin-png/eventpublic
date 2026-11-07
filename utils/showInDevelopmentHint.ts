import { Alert, Platform } from 'react-native';

/**
 * Подсказка «функция в разработке».
 *
 * На вебе Alert из react-native-web в этой сборке не показывается (в проекте
 * уже есть обходы через window.alert — например, в app/settings.tsx),
 * поэтому платформа разделена явно: иначе на вебе нажатие снова выглядело бы
 * как «ничего не произошло» — ровно то, что подсказка и должна убрать.
 */
export function showInDevelopmentHint(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    return;
  }
  Alert.alert(title, message);
}
